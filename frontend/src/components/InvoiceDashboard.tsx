"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, FileText, RefreshCw, Wallet } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { MEZOPAY_ADDRESS, mezoTestnet } from "@/config/wagmi";
import { invoiceAbi } from "@/contracts/abis";
import { errorMessage, musdAmount } from "@/lib/invoices";
import { ErrorNotice, ExplorerLink, Spinner, StatusBadge } from "./ui";
import { WalletButton } from "./WalletButton";

const PAGE_SIZE = 6;

export function InvoiceDashboard() {
  const { address } = useAccount();
  return <Dashboard key={address ?? "disconnected"} />;
}

function Dashboard() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<"created" | "paid">("created");
  const [page, setPage] = useState(0);
  const created = useReadContract({
    address: MEZOPAY_ADDRESS, abi: invoiceAbi, functionName: "getCreatorInvoices",
    args: address ? [address] : undefined, chainId: mezoTestnet.id,
    query: { enabled: !!address && isConnected, refetchInterval: 15_000 },
  });
  const paid = useReadContract({
    address: MEZOPAY_ADDRESS, abi: invoiceAbi, functionName: "getPayerInvoices",
    args: address ? [address] : undefined, chainId: mezoTestnet.id,
    query: { enabled: !!address && isConnected, refetchInterval: 15_000 },
  });
  const active = tab === "created" ? created : paid;
  const ids = [...(active.data ?? [])].reverse();
  const pages = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
  useEffect(() => { if (page >= pages) setPage(pages - 1); }, [page, pages]);
  function switchTab(next: "created" | "paid") { setTab(next); setPage(0); }
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "created" : event.key === "End" ? "paid" : tab === "created" ? "paid" : "created";
    switchTab(next);
    document.getElementById(`${next}-tab`)?.focus();
  }

  return <section id="dashboard" className="dashboard-section" aria-labelledby="dashboard-heading">
    <div className="section-heading"><div><h2 id="dashboard-heading" className="text-lg font-semibold tracking-tight">Invoice history</h2><p className="mt-1 text-xs text-slate-400">Updates every 15 seconds</p></div>
      <button className="btn-ghost" onClick={() => { void created.refetch(); void paid.refetch(); }} disabled={!address || active.isFetching} aria-label="Refresh invoices">
        <RefreshCw size={15} className={active.isFetching && address ? "animate-spin" : ""} /><span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
    <div className="panel overflow-hidden p-0">
      <div className="dashboard-toolbar"><div role="tablist" aria-label="Invoice lists" className="tabs">
        <button id="created-tab" role="tab" aria-selected={tab === "created"} aria-controls="invoice-tabpanel" className={`tab ${tab === "created" ? "tab-active" : ""}`}
          tabIndex={tab === "created" ? 0 : -1} onKeyDown={tabKeys} onClick={() => switchTab("created")}><ArrowUpRight size={15} />Created by me<span className="tab-count">{created.data?.length ?? "—"}</span></button>
        <button id="paid-tab" role="tab" aria-selected={tab === "paid"} aria-controls="invoice-tabpanel" className={`tab ${tab === "paid" ? "tab-active" : ""}`}
          tabIndex={tab === "paid" ? 0 : -1} onKeyDown={tabKeys} onClick={() => switchTab("paid")}><ArrowDownLeft size={15} />Paid by me<span className="tab-count">{paid.data?.length ?? "—"}</span></button>
      </div></div>
      <div id="invoice-tabpanel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
        {isConnected && active.isRefetchError && active.data !== undefined && <p className="warning-notice m-3" role="status">Refresh failed. Showing the last loaded invoices.<button className="ml-2 underline" onClick={() => void active.refetch()}>Retry</button></p>}
        {!isConnected ? <div className="empty-state"><span className="empty-icon"><Wallet size={26} /></span><h3>Connect to see your invoices</h3><p>Only invoices created or paid by your connected wallet appear here.</p><WalletButton /></div>
          : active.isPending ? <div className="empty-state" role="status"><Spinner /><p>Loading your invoices from Mezo Testnet…</p></div>
          : active.isError && !active.data ? <div className="p-6"><ErrorNotice>Could not load invoices. {errorMessage(active.error)}</ErrorNotice><button className="btn-secondary mt-4" onClick={() => void active.refetch()}>Try again</button></div>
          : !ids.length ? <div className="empty-state"><span className="empty-icon"><FileText size={25} /></span><h3>{tab === "created" ? "Your next invoice starts here." : "No payments just yet."}</h3><p>{tab === "created" ? "Create a MUSD payment link from the New Invoice tab. It will appear here once confirmed." : "Invoices you pay with this wallet will appear here automatically."}</p><Link href="/" className="btn-secondary">New Invoice<ArrowRight size={14} /></Link></div>
          : <>
            <ul className="invoice-list" aria-label={tab === "created" ? "Created invoices" : "Paid invoices"}>
              {ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((id) => <InvoiceRow key={id.toString()} id={id} />)}
            </ul>
            <div className="table-pagination"><span>{ids.length} invoice{ids.length === 1 ? "" : "s"} · Newest first</span><div className="flex items-center gap-3">
              <button className="btn-ghost p-1" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button>
              <span>Page {page + 1} of {pages}</span><button className="btn-ghost p-1" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button>
            </div></div>
          </>}
      </div>
    </div>
  </section>;
}

function InvoiceRow({ id }: { id: bigint }) {
  const { data: invoice, isError, refetch } = useReadContract({
    address: MEZOPAY_ADDRESS, abi: invoiceAbi, functionName: "getInvoice", args: [id],
    chainId: mezoTestnet.id, query: { refetchInterval: 15_000 },
  });
  if (isError && !invoice) return <li className="invoice-card"><p className="text-sm text-amber-300">Could not load invoice #{id.toString()}.</p><button onClick={() => void refetch()} className="btn-secondary mt-3">Retry</button></li>;
  if (!invoice) return <li className="invoice-card" role="status"><span className="flex items-center gap-2 text-sm text-slate-400"><Spinner />Loading invoice #{id.toString()}…</span></li>;
  return <li className="invoice-card rounded-2xl">
    {isError && <p className="mb-3 text-xs text-amber-300">Refresh failed. Status may have changed.<button className="ml-2 min-h-12 underline" onClick={() => void refetch()}>Retry</button></p>}
    <div className="invoice-card-heading"><span className="invoice-card-id">INV #{id.toString().padStart(4, "0")}</span><StatusBadge paid={invoice.paid} /></div>
    <Link href={`/pay/${id}`} className="invoice-card-main"><h3>{invoice.title}</h3><p className="invoice-card-amount">{musdAmount(invoice.amount)}<span>MUSD</span></p></Link>
    <div className="invoice-card-actions"><ExplorerLink value={MEZOPAY_ADDRESS} type="address">Invoice contract</ExplorerLink><Link href={`/pay/${id}`}>View invoice<ArrowRight size={15} /><span className="sr-only">{id.toString()}</span></Link></div>
  </li>;
}
