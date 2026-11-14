import type { Metadata } from "next";
import { InvoiceDashboard } from "@/components/InvoiceDashboard";
import { WalletBalance } from "@/components/WalletBalance";

export const metadata: Metadata = { title: "My Invoices" };

export default function InvoicesPage() {
  return <main id="main" className="page-shell">
    <div className="workspace-header"><section className="hero" aria-labelledby="invoices-heading">
      <h1 id="invoices-heading">My invoices</h1><p>Payment requests and MUSD payments for your connected wallet.</p>
    </section><WalletBalance /></div>
    <InvoiceDashboard />
  </main>;
}
