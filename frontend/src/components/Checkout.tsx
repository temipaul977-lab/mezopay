"use client";

import Link from "next/link";
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
  if (invoiceQuery.isError && !invoiceQuery.data) {
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
    <div className="checkout-heading"><h1>{invoice.paid ? "Invoice paid" : "Review your invoice"}</h1><p>{invoice.paid ? "The MUSD payment is confirmed on Mezo Testnet." : "Check the amount and recipient before connecting your wallet."}</p></div>
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
          <div><dt>MezoPay fee</dt><dd className="text-mint">0 MUSD · Full amount to recipient</dd></div>
          <div><dt>Network gas</dt><dd>Paid separately in testnet BTC</dd></div>
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
      <div className="receipt-bottom"><ShieldCheck size={14} /><span>Payment recorded on Mezo Testnet</span></div>
    </article>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-500"><ExplorerLink value={MEZOPAY_ADDRESS} type="address">Invoice contract</ExplorerLink><ExplorerLink value={MUSD_ADDRESS} type="address">MUSD token</ExplorerLink></div>
    <p className="mt-5 text-center text-xs text-slate-600">Mezo Testnet · Testnet assets only · BTC is used for network gas</p>
  </div>;
}

function CheckoutActions({ invoice, refresh }: { invoice: Invoice; refresh: () => void }) {
  const { address, chainId, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const transaction = useTransaction(`checkout:${invoice.id}:${address?.toLowerCase() ?? "disconnected"}`);
  const action = transaction.kind;
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
  const approvalUpdating = action === "approve" && transaction.phase === "success" && allowance.dataUpdatedAt <= (transaction.confirmedAt ?? 0);
  const paymentConfirmed = action === "pay" && transaction.phase === "success";

  async function approve() {
    if (!address || wrongChain || !transaction.publicClient || invoice.paid) return;
    const client = transaction.publicClient;
    await transaction.run(async () => {
      const { request, result } = await client.simulateContract({
        address: MUSD_ADDRESS, abi: musdAbi, functionName: "approve",
        args: [MEZOPAY_ADDRESS, invoice.amount], account: address,
      });
      if (!result) throw new Error("The MUSD token did not accept the approval.");
      return writeContractAsync({ ...request, chainId: mezoTestnet.id });
    }, () => { void allowance.refetch(); }, "approve");
  }

  async function pay() {
    if (!address || wrongChain || !approved || insufficientBalance || !transaction.publicClient || invoice.paid) return;
    const client = transaction.publicClient;
    await transaction.run(async () => {
      const { request } = await client.simulateContract({
        address: MEZOPAY_ADDRESS, abi: invoiceAbi, functionName: "payInvoice",
        args: [invoice.id], account: address,
      });
      return writeContractAsync({ ...request, chainId: mezoTestnet.id });
    }, () => { refresh(); void balance.refetch(); }, "pay");
  }

  if (invoice.paid) return transaction.hash && action === "pay" && transaction.phase === "success" ? <div className="mt-5 text-center text-sm text-mint"><ExplorerLink value={transaction.hash}>View payment transaction</ExplorerLink></div> : null;

  return <section className="checkout-actions" aria-label="Pay invoice">
    <div className="checkout-steps"><span className={approved ? "step-complete" : "step-current"}><span>{approved ? <Check size={12} /> : "1"}</span>Approve MUSD</span><div /><span className={approved ? "step-current" : ""}><span>2</span>Pay invoice</span></div>
    {!isConnected || !address ? <div className="checkout-connect"><h3>Connect to pay</h3><p>You need MUSD for the invoice and testnet BTC for gas. You may need to approve MUSD before submitting your payment.</p><WalletButton /></div>
      : wrongChain ? <div className="checkout-connect"><CircleAlert size={24} className="mx-auto text-amber-300" /><h3>Switch to Mezo Testnet</h3><p>Your invoice is on Mezo Testnet. Switch networks to continue.</p><WalletButton compact /></div>
      : <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>Paying from <span className="font-mono text-slate-200">{shortAddress(address)}</span></span><span title={balance.data !== undefined ? `${musdAmount(balance.data)} MUSD` : undefined}>Balance: <span className="text-slate-200">{balance.data === undefined ? "…" : musdAmount(balance.data)} MUSD</span></span></div>
        {(allowance.isError || balance.isError) && <ErrorNotice>Could not read your MUSD balance or allowance. <button className="underline" onClick={() => { void allowance.refetch(); void balance.refetch(); }}>Retry</button></ErrorNotice>}
        {insufficientBalance && <div className="warning-notice">Insufficient MUSD. This invoice requires {musdAmount(invoice.amount)} MUSD. Your wallet has {musdAmount(balance.data ?? 0n)} MUSD.<button className="mt-2 block underline" onClick={() => void balance.refetch()}>Refresh balance after adding testnet MUSD</button></div>}
        {transaction.error && <ErrorNotice>{transaction.error}</ErrorNotice>}
        {!approved ? <>
          <button className="btn-primary w-full py-3.5" disabled={transaction.busy || !readsReady || insufficientBalance || approvalUpdating} onClick={() => void approve()}>
            {transaction.busy || !readsReady || approvalUpdating ? <Spinner /> : <ShieldCheck size={17} />}
            {transaction.phase === "wallet" ? "Confirm approval in wallet…" : transaction.phase === "confirming" ? "Waiting for approval confirmation…" : transaction.phase === "unknown" ? "Check confirmation above" : transaction.busy ? "Another transaction is in progress" : approvalUpdating ? "Updating MUSD allowance…" : !readsReady ? allowance.isError || balance.isError ? "Balance check unavailable" : "Checking balance and approval…" : "1. Approve MUSD"}
          </button><p className="text-center text-xs leading-5 text-slate-400">Allow the invoice contract to spend up to {musdAmount(invoice.amount)} MUSD. Approval is a separate transaction; it does not pay the invoice.</p>
        </> : <>
          <div className="flex items-center gap-2 text-xs text-mint"><Check size={14} />MUSD spending approved</div>
          <div className="payment-summary"><span>You will send</span><strong>{musdAmount(invoice.amount)} MUSD</strong><span>To <span className="font-mono">{shortAddress(invoice.creator)}</span> · Network gas is separate.</span></div>
          <button className="btn-primary w-full py-3.5" disabled={transaction.busy || insufficientBalance || !readsReady || paymentConfirmed} onClick={() => void pay()}>
            {transaction.busy ? <Spinner /> : <LockKeyhole size={16} />}
            {transaction.phase === "wallet" ? "Confirm in wallet…" : transaction.phase === "confirming" ? "Waiting for confirmation…" : transaction.phase === "unknown" ? "Check confirmation above" : transaction.busy ? "Another transaction is in progress" : paymentConfirmed ? "Payment confirmed" : `Pay ${musdAmount(invoice.amount)} MUSD`}
            {!transaction.busy && <ArrowRight size={16} />}
          </button>
        </>}
        {transaction.hash && <div className="text-center text-xs text-slate-300" role="status"><ExplorerLink value={transaction.hash}>
          {transaction.phase === "confirming" ? "Waiting for confirmation" : action === "pay" ? "View payment transaction" : "View approval transaction"}
        </ExplorerLink></div>}
        {transaction.phase === "success" && action === "pay" && <p className="text-center text-xs text-mint" role="status">Payment confirmed. Refreshing your receipt…<button className="ml-2 underline" onClick={refresh}>Refresh</button></p>}
        <p className="text-center text-xs text-slate-400">MezoPay fee: 0 MUSD. Approval and payment each use testnet BTC for gas.</p>
      </div>}
  </section>;
}

function CheckoutProblem({ title, description, retry }: { title: string; description: string; retry?: () => void }) {
  return <div className="checkout-problem"><span className="empty-icon"><FileText size={28} /></span><h1>{title}</h1><p>{description}</p><div className="flex flex-wrap justify-center gap-3">{retry && <button className="btn-primary" onClick={retry}>Try again</button>}<Link href="/" className="btn-secondary"><ArrowLeft size={15} />Back to MezoPay</Link></div></div>;
}
