"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, FileText, RefreshCw, Wallet } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { MEZOPAY_ADDRESS, mezoTestnet } from "@/config/wagmi";
import { invoiceAbi } from "@/contracts/abis";
import { errorMessage, musdAmount } from "@/lib/invoices";
import { ErrorNotice, ExplorerLink, Spinner, StatusBadge } from "./ui";

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

  return <section id="dashboard" className="dashboard-section" aria-labelledby="dashboard-heading">
    <div className="section-heading"><h2 id="dashboard-heading" className="text-lg font-semibold tracking-tight">My invoices</h2>
      <button className="btn-ghost" onClick={() => { void created.refetch(); void paid.refetch(); }} disabled={!address || active.isFetching} aria-label="Refresh invoices">
        <RefreshCw size={15} className={active.isFetching && address ? "animate-spin" : ""} /><span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
    <div className="panel overflow-hidden p-0">
      <div className="dashboard-toolbar"><div role="tablist" aria-label="Invoice lists" className="tabs">
        <button id="created-tab" role="tab" aria-selected={tab === "created"} aria-controls="invoice-tabpanel" className={`tab ${tab === "created" ? "tab-active" : ""}`}
          onClick={() => { setTab("created"); setPage(0); }}><ArrowUpRight size={15} />Created by Me<span className="tab-count">{created.data?.length ?? "—"}</span></button>
        <button id="paid-tab" role="tab" aria-selected={tab === "paid"} aria-controls="invoice-tabpanel" className={`tab ${tab === "paid" ? "tab-active" : ""}`}
          onClick={() => { setTab("paid"); setPage(0); }}><ArrowDownLeft size={15} />Paid by Me<span className="tab-count">{paid.data?.length ?? "—"}</span></button>
      </div></div>
      <div id="invoice-tabpanel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
        {!isConnected ? <div className="empty-state"><span className="empty-icon"><Wallet size={26} /></span><h3>Make yourself at home.</h3><p>Connect your wallet to see the invoices you&apos;ve created and paid.</p><Link href="/" className="inline-flex items-center gap-2 text-sm text-bitcoin">Start with your first invoice<ArrowRight size={14} /></Link></div>
          : active.isPending ? <div className="empty-state" role="status"><Spinner /><p>Loading your invoices from Mezo Testnet…</p></div>
          : active.isError ? <div className="p-6"><ErrorNotice>Could not load invoices. {errorMessage(active.error)}</ErrorNotice><button className="btn-secondary mt-4" onClick={() => void active.refetch()}>Try again</button></div>
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
  if (isError) return <li className="invoice-card"><p className="text-sm text-amber-300">Could not load invoice #{id.toString()}.</p><button onClick={() => void refetch()} className="btn-secondary mt-3">Retry</button></li>;
  if (!invoice) return <li className="invoice-card" role="status"><span className="flex items-center gap-2 text-sm text-slate-400"><Spinner />Loading invoice #{id.toString()}…</span></li>;
  return <li className="invoice-card rounded-2xl">
    <div className="invoice-card-heading"><span className="invoice-card-id">INV #{id.toString().padStart(4, "0")}</span><StatusBadge paid={invoice.paid} /></div>
    <Link href={`/pay/${id}`} className="invoice-card-main"><h3>{invoice.title}</h3><p className="invoice-card-amount">{musdAmount(invoice.amount)}<span>MUSD</span></p></Link>
    <div className="invoice-card-actions"><ExplorerLink value={MEZOPAY_ADDRESS} type="address">Contract</ExplorerLink><Link href={`/pay/${id}`}>View invoice<ArrowRight size={15} /><span className="sr-only">{id.toString()}</span></Link></div>
  </li>;
}
