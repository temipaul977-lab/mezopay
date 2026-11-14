"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, CircleAlert, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { BaseError, ContractFunctionRevertedError, zeroAddress } from "viem";
import { MEZOPAY_ADDRESS, MUSD_ADDRESS, mezoTestnet } from "@/config/wagmi";
import { invoiceAbi, musdAbi } from "@/contracts/abis";
import { useTransaction } from "@/hooks/useTransaction";
import { errorMessage, invoiceDate, musdAmount, parseInvoiceId, shortAddress, type Invoice } from "@/lib/invoices";
import { ErrorNotice, ExplorerLink, Spinner } from "./ui";
import { WalletButton } from "./WalletButton";

export function Checkout({ invoiceId }: { invoiceId: string }) {
  const id = parseInvoiceId(invoiceId);
  const invoiceQuery = useReadContract({
    address: MEZOPAY_ADDRESS, abi: invoiceAbi, functionName: "getInvoice", args: [id ?? 0n],
    chainId: mezoTestnet.id,
    query: { enabled: id !== null, refetchInterval: 10_000, retry: 1 },
  });
  const { address, chainId } = useAccount();

  if (id === null) return <CheckoutProblem title="That invoice ID doesn’t look right." description="Invoice IDs are positive whole numbers. Check the payment link and try again." />;
  if (invoiceQuery.isPending) return <div className="checkout-loading" role="status"><Spinner /><h1>Opening invoice #{id.toString()}…</h1><p>Reading directly from Mezo Testnet. No wallet needed.</p></div>;
  if (invoiceQuery.isError) {
    const reverted = invoiceQuery.error instanceof BaseError
      ? invoiceQuery.error.walk((cause) => cause instanceof ContractFunctionRevertedError)
      : undefined;
    const missing = reverted instanceof ContractFunctionRevertedError && reverted.reason?.includes("Invoice does not exist");
    return <CheckoutProblem title={missing ? "Invoice not found." : "We couldn’t load this invoice."}
      description={missing ? "Check the invoice number with the sender. This invoice does not exist on Mezo Testnet." : `The network may be unavailable. ${errorMessage(invoiceQuery.error)}`}
      retry={() => void invoiceQuery.refetch()} />;
  }
  const invoice = invoiceQuery.data;
  if (!invoice || invoice.creator === zeroAddress) return <CheckoutProblem title="Invoice not found." description="This invoice does not exist on Mezo Testnet. Check the link with its sender." />;

  return <div className="checkout-shell">
    <Link href="/" className="back-link"><ArrowLeft size={15} />Back to MezoPay</Link>
    <div className="mb-7 mt-8 text-center"><p className="eyebrow text-bitcoin">A SIMPLE WAY TO SETTLE UP</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{invoice.paid ? "All settled." : "You’re one payment away."}</h1><p className="mt-3 text-sm text-slate-400">Your invoice. Your wallet. Direct on Mezo.</p></div>
    <article className="checkout-receipt rounded-2xl" aria-labelledby="invoice-title">
      <div className={`receipt-topline ${invoice.paid ? "bg-mint" : "bg-bitcoin"}`} />
      <div className="receipt-body">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 font-mono text-xs text-slate-400"><FileText size={16} />INVOICE #{invoice.id.toString().padStart(4, "0")}</span>
          <span className={`status ${invoice.paid ? "status-paid" : "status-pending"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{invoice.paid ? "PAID" : "AWAITING PAYMENT"}</span></div>
        <div className="receipt-total"><p className="text-xs text-slate-500">{invoice.paid ? "Amount paid" : "Amount due"}</p><div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-3"><span className="checkout-amount">{musdAmount(invoice.amount)}</span><span className="text-xl font-medium text-slate-400">MUSD</span></div><h2 id="invoice-title" className="mt-4 break-words text-lg font-medium text-slate-200">{invoice.title}</h2></div>
        <dl className="receipt-details">
          <div><dt>Recipient</dt><dd><ExplorerLink value={invoice.creator} type="address" className="break-all font-mono text-xs">{invoice.creator}</ExplorerLink></dd></div>
          <div><dt>Created</dt><dd>{invoiceDate(invoice.createdAt)}</dd></div>
          <div><dt>Network</dt><dd><span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-mint" />Mezo Testnet</span></dd></div>
          <div><dt>Protocol fee</dt><dd className="text-mint">0 MUSD · 100% to recipient</dd></div>
          {invoice.memo && <div className="!block"><dt className="mb-2">Memo / Notes</dt><dd className="memo-text">{invoice.memo}</dd></div>}
          {invoice.paid && <>
            <div><dt>Paid by</dt><dd><ExplorerLink value={invoice.payer} type="address" className="break-all font-mono text-xs">{invoice.payer}</ExplorerLink></dd></div>
            <div><dt>Paid at</dt><dd>{invoiceDate(invoice.paidAt)}</dd></div>
          </>}
        </dl>
        {invoice.paid ? <div className="paid-confirmation" role="status"><span className="success-orb"><CheckCheck size={28} /></span><h3>Payment received.</h3><p>The full invoice amount was settled directly to the recipient.</p></div> : null}
        <CheckoutActions key={`${invoice.id}:${address ?? "disconnected"}:${chainId}`} invoice={invoice} refresh={() => void invoiceQuery.refetch()} />
        {invoiceQuery.isRefetchError && <p role="status" className="mt-4 text-xs text-amber-300">Latest refresh failed. Displaying the last confirmed invoice state.</p>}
      </div>
      <div className="receipt-bottom"><ShieldCheck size={14} /><span>Secured on Mezo · Bitcoin-backed MUSD</span></div>
    </article>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-500"><ExplorerLink value={MEZOPAY_ADDRESS} type="address">Invoice contract</ExplorerLink><ExplorerLink value={MUSD_ADDRESS} type="address">MUSD token</ExplorerLink></div>
    <p className="mt-5 text-center text-xs text-slate-600">Mezo Testnet · Testnet assets only · BTC is used for network gas</p>
  </div>;
}

function CheckoutActions({ invoice, refresh }: { invoice: Invoice; refresh: () => void }) {
  const { address, chainId, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const transaction = useTransaction();
  const [action, setAction] = useState<"approve" | "pay">("approve");
  const allowance = useReadContract({
    address: MUSD_ADDRESS, abi: musdAbi, functionName: "allowance",
    args: address ? [address, MEZOPAY_ADDRESS] : undefined, chainId: mezoTestnet.id,
    query: { enabled: !!address && !invoice.paid, refetchInterval: 10_000 },
  });
  const balance = useReadContract({
    address: MUSD_ADDRESS, abi: musdAbi, functionName: "balanceOf",
    args: address ? [address] : undefined, chainId: mezoTestnet.id,
    query: { enabled: !!address && !invoice.paid, refetchInterval: 10_000 },
  });
  const approved = allowance.data !== undefined && allowance.data >= invoice.amount;
  const insufficientBalance = balance.data !== undefined && balance.data < invoice.amount;
  const wrongChain = chainId !== mezoTestnet.id;
  const readsReady = allowance.data !== undefined && balance.data !== undefined && !allowance.isError && !balance.isError;

  async function approve() {
    if (!address || wrongChain || !transaction.publicClient || invoice.paid) return;
    const client = transaction.publicClient;
    setAction("approve");
    await transaction.run(async () => {
      const { request, result } = await client.simulateContract({
        address: MUSD_ADDRESS, abi: musdAbi, functionName: "approve",
        args: [MEZOPAY_ADDRESS, invoice.amount], account: address,
      });
      if (!result) throw new Error("The MUSD token did not accept the approval.");
      return writeContractAsync({ ...request, chainId: mezoTestnet.id });
    }, () => { void allowance.refetch(); });
  }

  async function pay() {
    if (!address || wrongChain || !approved || insufficientBalance || !transaction.publicClient || invoice.paid) return;
    const client = transaction.publicClient;
    setAction("pay");
    await transaction.run(async () => {
      const { request } = await client.simulateContract({
        address: MEZOPAY_ADDRESS, abi: invoiceAbi, functionName: "payInvoice",
        args: [invoice.id], account: address,
      });
      return writeContractAsync({ ...request, chainId: mezoTestnet.id });
    }, () => { refresh(); void balance.refetch(); });
  }

  if (invoice.paid) return transaction.hash ? <div className="mt-5 text-center text-sm text-mint"><ExplorerLink value={transaction.hash}>View payment transaction</ExplorerLink></div> : null;

  return <section className="checkout-actions" aria-label="Pay invoice">
    <div className="checkout-steps"><span className={approved ? "step-complete" : "step-current"}><span>{approved ? <Check size={12} /> : "1"}</span>Approve MUSD</span><div /><span className={approved ? "step-current" : ""}><span>2</span>Pay invoice</span></div>
    {!isConnected || !address ? <div className="checkout-connect"><h3>Ready when you are.</h3><p>Connect your wallet to pay this invoice with MUSD.</p><WalletButton /></div>
      : wrongChain ? <div className="checkout-connect"><CircleAlert size={24} className="mx-auto text-amber-300" /><h3>Switch to Mezo Testnet</h3><p>Your invoice is on Mezo Testnet. Switch networks to continue.</p><WalletButton compact /></div>
      : <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>Paying from <span className="font-mono text-slate-200">{shortAddress(address)}</span></span><span title={balance.data !== undefined ? `${musdAmount(balance.data)} MUSD` : undefined}>Balance: <span className="text-slate-200">{balance.data === undefined ? "…" : musdAmount(balance.data)} MUSD</span></span></div>
        {(allowance.isError || balance.isError) && <ErrorNotice>Could not read your MUSD balance or allowance. <button className="underline" onClick={() => { void allowance.refetch(); void balance.refetch(); }}>Retry</button></ErrorNotice>}
        {insufficientBalance && <div className="warning-notice">You need {musdAmount(invoice.amount)} MUSD to pay this invoice. Add testnet MUSD to your wallet, then refresh your balance.<button className="mt-2 block underline" onClick={() => void balance.refetch()}>Refresh balance</button></div>}
        {transaction.error && <ErrorNotice>{transaction.error}</ErrorNotice>}
        {!approved ? <>
          <button className="btn-primary w-full py-3.5" disabled={transaction.busy || !readsReady} onClick={() => void approve()}>
            {transaction.busy || !readsReady ? <Spinner /> : <ShieldCheck size={17} />}
            {transaction.phase === "wallet" && transaction.busy ? "Confirm approval in wallet…" : transaction.phase === "confirming" ? "Confirming MUSD approval…" : !readsReady ? "Checking MUSD allowance…" : "Step 1: Approve MUSD"}
          </button><p className="text-center text-xs leading-5 text-slate-500">Approve exactly {musdAmount(invoice.amount)} MUSD for this invoice. Approval alone does not pay the invoice.</p>
        </> : <>
          <div className="flex items-center gap-2 text-xs text-mint"><Check size={14} />MUSD spending approved</div>
          <button className="btn-primary w-full py-3.5" disabled={transaction.busy || insufficientBalance || !readsReady} onClick={() => void pay()}>
            {transaction.busy ? <Spinner /> : <LockKeyhole size={16} />}
            {transaction.busy && transaction.phase === "wallet" ? "Confirm payment in wallet…" : transaction.busy ? "Confirming your payment…" : `Step 2: Pay ${musdAmount(invoice.amount)} MUSD Now`}
            {!transaction.busy && <ArrowRight size={16} />}
          </button>
        </>}
        {transaction.hash && <div className="text-center text-xs text-slate-300" role="status"><ExplorerLink value={transaction.hash}>
          {transaction.phase === "confirming" ? "Waiting for confirmation" : action === "pay" ? "View payment transaction" : "View approval transaction"}
        </ExplorerLink></div>}
        {transaction.phase === "success" && action === "pay" && <p className="text-center text-xs text-mint" role="status">Payment confirmed. Refreshing your receipt…<button className="ml-2 underline" onClick={refresh}>Refresh</button></p>}
        <p className="text-center text-[11px] text-slate-500">Zero protocol fee. Keep a little testnet BTC for network gas.</p>
      </div>}
  </section>;
}

function CheckoutProblem({ title, description, retry }: { title: string; description: string; retry?: () => void }) {
  return <div className="checkout-problem"><span className="empty-icon"><FileText size={28} /></span><h1>{title}</h1><p>{description}</p><div className="flex flex-wrap justify-center gap-3">{retry && <button className="btn-primary" onClick={retry}>Try again</button>}<Link href="/" className="btn-secondary"><ArrowLeft size={15} />Back to MezoPay</Link></div></div>;
}
