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
    <div className="section-heading"><div><p className="eyebrow text-slate-500">YOUR WORKSPACE</p><h2 id="dashboard-heading" className="mt-2 text-2xl font-semibold tracking-tight">Your invoices, in one place.</h2></div>
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
      </div><span className="hidden items-center gap-2 text-[11px] text-slate-500 md:flex"><span className="h-1.5 w-1.5 rounded-full bg-mint" />Refreshes every 15s</span></div>
      <div id="invoice-tabpanel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
        {!isConnected ? <div className="empty-state"><span className="empty-icon"><Wallet size={26} /></span><h3>Make yourself at home.</h3><p>Connect your wallet to see the invoices you&apos;ve created and paid.</p><a href="#create" className="inline-flex items-center gap-2 text-sm text-bitcoin">Start with your first invoice<ArrowRight size={14} /></a></div>
          : active.isPending ? <div className="empty-state" role="status"><Spinner /><p>Loading your invoices from Mezo Testnet…</p></div>
          : active.isError ? <div className="p-6"><ErrorNotice>Could not load invoices. {errorMessage(active.error)}</ErrorNotice><button className="btn-secondary mt-4" onClick={() => void active.refetch()}>Try again</button></div>
          : !ids.length ? <div className="empty-state"><span className="empty-icon"><FileText size={25} /></span><h3>{tab === "created" ? "Your next invoice starts here." : "No payments just yet."}</h3><p>{tab === "created" ? "Create your first MUSD payment link above. It will appear here once confirmed." : "Invoices you pay with this wallet will appear here automatically."}</p></div>
          : <>
            <div className="overflow-x-auto"><table className="invoice-table"><thead><tr><th>INVOICE</th><th>AMOUNT</th><th>STATUS</th><th className="text-right">DETAILS</th></tr></thead>
              <tbody>{ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((id) => <InvoiceRow key={id.toString()} id={id} />)}</tbody>
            </table></div>
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
  if (isError) return <tr><td colSpan={4}><div className="flex flex-wrap justify-between gap-3 text-sm text-amber-300">Could not load invoice #{id.toString()}.<button onClick={() => void refetch()} className="underline">Retry</button></div></td></tr>;
  if (!invoice) return <tr><td colSpan={4}><span className="flex items-center gap-2 text-slate-500"><Spinner />Loading invoice #{id.toString()}…</span></td></tr>;
  return <tr>
    <td><Link href={`/pay/${id}`} className="group flex items-center gap-3"><span className={`row-icon ${invoice.paid ? "text-mint" : "text-bitcoin"}`}><FileText size={18} /></span>
      <span className="min-w-0"><span className="block max-w-64 truncate font-medium text-slate-200 group-hover:text-bitcoin">{invoice.title}</span><span className="mt-1 block font-mono text-[11px] text-slate-500">INV #{id.toString().padStart(4, "0")}</span></span></Link></td>
    <td><span className="break-all font-mono text-sm text-slate-200">{musdAmount(invoice.amount)}</span><span className="ml-1.5 text-xs text-slate-500">MUSD</span></td>
    <td><StatusBadge paid={invoice.paid} /></td>
    <td><div className="flex items-center justify-end gap-4"><ExplorerLink value={MEZOPAY_ADDRESS} type="address" className="text-xs text-slate-500"><span className="hidden lg:inline">Contract</span></ExplorerLink><Link href={`/pay/${id}`} className="flex items-center gap-1 text-xs text-slate-300 hover:text-bitcoin">View<ArrowRight size={13} /><span className="sr-only">invoice {id.toString()}</span></Link></div></td>
  </tr>;
}
