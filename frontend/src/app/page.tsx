import { ArrowUpRight, Bitcoin, CircleDollarSign, Link2, Zap } from "lucide-react";
import { CreateInvoice } from "@/components/CreateInvoice";
import { InvoiceDashboard } from "@/components/InvoiceDashboard";

export default function Home() {
  return <main id="main" className="page-shell">
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-copy"><div className="network-label"><span className="h-1.5 w-1.5 rounded-full bg-mint" />LIVE ON MEZO TESTNET<span className="mx-1 text-slate-600">/</span><span className="text-slate-400">BUILT FOR BITCOIN</span></div>
        <h1 id="hero-heading">Good work.<br /><span className="hero-highlight">Better payments.</span></h1>
        <p>Create a link. Send an invoice. Get paid in Bitcoin-backed MUSD.<br className="hidden md:block" />Simple for your clients. Straight to your wallet.</p>
        <div className="hero-benefits"><span><CircleDollarSign size={15} />Zero protocol fees</span><span><Zap size={15} />Direct settlement</span><span><Link2 size={15} />One shareable link</span></div>
      </div>
      <div className="hero-emblem" aria-hidden="true"><span className="orbit orbit-outer" /><span className="orbit orbit-inner" /><div className="bitcoin-core"><Bitcoin size={66} strokeWidth={1.5} /></div><span className="orbit-token">m<span className="orbit-arrow"><ArrowUpRight size={16} /></span></span><span className="emblem-caption">BITCOIN ROOTS. EVERYDAY PAYMENTS.</span></div>
    </section>
    <CreateInvoice />
    <InvoiceDashboard />
    <div className="bottom-note"><span className="text-bitcoin">A little less friction.</span> A lot more possibility. <span className="ml-2 text-slate-600">That&apos;s the Mezo way.</span></div>
  </main>;
}
