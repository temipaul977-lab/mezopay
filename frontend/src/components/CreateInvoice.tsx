"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCheck, ChevronDown, FilePlus2, Link2, LockKeyhole } from "lucide-react";
import { parseEventLogs } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { MEZOPAY_ADDRESS, mezoTestnet } from "@/config/wagmi";
import { invoiceAbi } from "@/contracts/abis";
import { useTransaction } from "@/hooks/useTransaction";
import { errorMessage, parseMusd, shortAddress } from "@/lib/invoices";
import { CopyButton, ErrorNotice, ExplorerLink, Spinner } from "./ui";
import { WalletButton } from "./WalletButton";

export function CreateInvoice() {
  return <InvoiceComposer />;
}

function InvoiceComposer() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const transaction = useTransaction(`create:${address?.toLowerCase() ?? "disconnected"}`);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [formError, setFormError] = useState<string>();
  const [draftReady, setDraftReady] = useState(false);
  const preview = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => { if (preview.current) preview.current.open = query.matches; };
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem("mezopay.invoice-draft.v1") ?? "null");
      if (draft && typeof draft.title === "string" && typeof draft.amount === "string" && typeof draft.memo === "string") {
        setTitle(draft.title.slice(0, 160)); setAmount(draft.amount.slice(0, 100)); setMemo(draft.memo.slice(0, 2000));
      }
    } catch { /* A missing draft does not prevent creating an invoice. */ }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    try { sessionStorage.setItem("mezopay.invoice-draft.v1", JSON.stringify({ title, amount, memo })); } catch { /* Optional draft storage. */ }
  }, [draftReady, title, amount, memo]);
  const created = useMemo(() => {
    if (!transaction.receipt || !address) return undefined;
    const events = parseEventLogs({ abi: invoiceAbi, eventName: "InvoiceCreated",
      logs: transaction.receipt.logs.filter((log) => log.address.toLowerCase() === MEZOPAY_ADDRESS.toLowerCase()) });
    const event = events.find((log) => log.args.creator.toLowerCase() === address.toLowerCase());
    if (!event) return undefined;
    const id = event.args.id.toString();
    return { id, url: `${window.location.origin}/pay/${id}` };
  }, [transaction.receipt, address]);
  const wrongChain = isConnected && chainId !== mezoTestnet.id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    if (!address || wrongChain || !transaction.publicClient) return;
    try {
      const parsedAmount = parseMusd(amount);
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("Give your invoice a title.");
      const client = transaction.publicClient;
      await transaction.run(async () => {
        const { request } = await client.simulateContract({
          address: MEZOPAY_ADDRESS, abi: invoiceAbi, functionName: "createInvoice",
          args: [parsedAmount, cleanTitle, memo.trim()], account: address,
        });
        return writeContractAsync({ ...request, chainId: mezoTestnet.id });
      });
    } catch (cause) {
      setFormError(errorMessage(cause));
    }
  }

  return <section id="create" className="composer-grid" aria-labelledby="create-heading">
    <div className="panel composer-panel rounded-2xl">
      <div className="panel-heading">
        <span className="icon-tile"><FilePlus2 size={20} /></span>
        <div><h2 id="create-heading">Invoice details</h2><p>Choose the amount your client will pay.</p></div>
      </div>
      {created ? <div className="space-y-6 py-2" role="status">
        <div className="success-orb"><CheckCheck size={30} /></div>
        <div><p className="eyebrow text-mint">INVOICE #{created.id} · CONFIRMED</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Your payment link is ready.</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Share it with your client. They can view the invoice before connecting a wallet.</p></div>
        <div className="rounded-xl border border-mint/20 bg-mint/5 p-4">
          <label htmlFor="share-link" className="field-label">Shareable Checkout Link</label>
          <input id="share-link" readOnly value={created.url} onFocus={(event) => event.target.select()} className="input-field mb-3 font-mono text-xs" />
          <div className="flex flex-wrap gap-3"><CopyButton value={created.url} label="Copy Link" />
            <Link className="btn-primary" href={`/pay/${created.id}`}>Open Checkout Page<ArrowRight size={15} /></Link></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          {transaction.hash && <ExplorerLink value={transaction.hash} className="text-slate-400">View transaction</ExplorerLink>}
          <button className="text-bitcoin hover:text-orange-300" onClick={() => {
            setTitle(""); setAmount(""); setMemo(""); setFormError(undefined); transaction.reset();
          }}>Create another invoice</button>
        </div>
      </div> : <form onSubmit={submit} className="space-y-5">
        <div><label htmlFor="invoice-title" className="field-label">Invoice Title <span className="text-bitcoin">*</span></label>
          <input id="invoice-title" className="input-field" placeholder="e.g. Smart contract audit" required maxLength={160}
            value={title} onChange={(event) => setTitle(event.target.value)} disabled={transaction.busy} />
        </div>
        <div><label htmlFor="invoice-amount" className="field-label">Amount (MUSD) <span className="text-bitcoin">*</span></label>
          <div className="relative"><input id="invoice-amount" className="input-field amount-input pr-24" placeholder="25.00" required inputMode="decimal"
            autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={transaction.busy} aria-describedby="amount-hint" />
            <span className="input-suffix"><span className="token-mini">$</span>MUSD</span></div>
          <p id="amount-hint" className="mt-2 text-xs text-slate-400">Paid in MUSD tokens, not BTC. You receive the full amount.</p>
        </div>
        <div><label htmlFor="invoice-memo" className="field-label">Memo / Notes <span className="ml-1 font-normal text-slate-500">(optional)</span></label>
          <textarea id="invoice-memo" className="input-field min-h-24 resize-y" placeholder="Add a reference or payment details" maxLength={2000} aria-describedby="memo-hint"
            value={memo} onChange={(event) => setMemo(event.target.value)} disabled={transaction.busy} />
          <p id="memo-hint" className="mt-2 text-xs text-slate-400">Invoice titles and notes are public. Do not include private information.</p>
        </div>
        {(formError || transaction.error) && <ErrorNotice>{formError || transaction.error}</ErrorNotice>}
        {!isConnected ? <div className="connect-prompt"><WalletButton /><span>Connect your wallet to create a payment link.</span></div> : <>
          {wrongChain && <p className="text-sm text-amber-300">Switch to Mezo Testnet using the wallet controls above.</p>}
          <button type="submit" className="btn-primary w-full py-3.5" disabled={transaction.busy || wrongChain || !transaction.publicClient || transaction.phase === "success"}>
            {transaction.busy ? <Spinner /> : <Link2 size={17} />}
            {transaction.phase === "wallet" ? "Confirm invoice in wallet…" : transaction.phase === "confirming" ? "Waiting for confirmation…" : transaction.phase === "unknown" ? "Check confirmation above" : transaction.busy ? "Another transaction is in progress" : "Create payment link"}
            {!transaction.busy && <ArrowRight size={17} className="ml-auto" />}
          </button>
        </>}
        {transaction.hash && <div className="text-xs text-slate-400" role="status"><ExplorerLink value={transaction.hash}>
          {transaction.phase === "confirming" ? "Waiting for confirmation" : "View creation transaction"}
        </ExplorerLink></div>}
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400"><LockKeyhole size={12} />MezoPay fee: 0 MUSD. Creating an invoice uses testnet BTC for gas.</p>
      </form>}
    </div>
    <details ref={preview} className="preview-details rounded-2xl">
    <summary>Preview your invoice<ChevronDown size={18} /></summary>
    <aside className="preview-column" aria-label="Invoice preview">
      <div className="preview-label"><span className="h-1.5 w-1.5 rounded-full bg-bitcoin" />LIVE PREVIEW<span className="ml-auto">YOUR CLIENT&apos;S VIEW</span></div>
      <div className="receipt-preview">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><span className="token-logo">m</span>MezoPay</div><span className="preview-pill">PAYMENT REQUEST</span></div>
        <div className="my-7 border-t border-dashed border-white/10" />
        <p className="text-xs text-slate-500">You&apos;ve received an invoice for</p>
        <h3 className="mt-2 break-words text-lg font-medium text-slate-200">{title.trim() || "Invoice title"}</h3>
        <div className="my-5 flex items-baseline gap-2"><span className="preview-amount">{amount || "0.00"}</span><span className="text-sm text-slate-400">MUSD</span></div>
        <div className="preview-row"><span>Recipient</span><span className="font-mono">{address ? shortAddress(address) : "Your wallet address"}</span></div>
        <div className="preview-row"><span>Network</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-mint" />Mezo Testnet</span></div>
        <div className="preview-row"><span>MezoPay fee</span><span className="text-mint">0 MUSD</span></div>
        {memo.trim() && <p className="mt-4 max-h-20 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">{memo}</p>}
        <div className="preview-pay"><LockKeyhole size={14} />Pay with MUSD<ArrowRight size={15} /></div>
        <p className="mt-3 text-center text-[10px] text-slate-500">Preview only · Your live invoice is created onchain</p>
      </div>
    </aside>
    </details>
  </section>;
}
