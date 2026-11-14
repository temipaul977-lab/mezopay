import type { Metadata } from "next";
import { InvoiceDashboard } from "@/components/InvoiceDashboard";
import { WalletBalance } from "@/components/WalletBalance";

export const metadata: Metadata = { title: "My Invoices" };

export default function InvoicesPage() {
  return <main id="main" className="page-shell">
    <section className="hero" aria-labelledby="invoices-heading">
      <h1 id="invoices-heading">Your activity.</h1><p>Keep track of every request and payment.</p>
    </section>
    <WalletBalance /><InvoiceDashboard />
  </main>;
}
