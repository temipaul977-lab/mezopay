import { CreateInvoice } from "@/components/CreateInvoice";
import { WalletBalance } from "@/components/WalletBalance";

export default function Home() {
  return <main id="main" className="page-shell">
    <section className="hero" aria-labelledby="hero-heading">
      <h1 id="hero-heading">Request a payment.</h1>
      <p>Send a link. Get paid in Bitcoin-backed MUSD.</p>
    </section>
    <WalletBalance /><CreateInvoice />
  </main>;
}
