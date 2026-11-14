import { CreateInvoice } from "@/components/CreateInvoice";
import { WalletBalance } from "@/components/WalletBalance";

export default function Home() {
  return <main id="main" className="page-shell">
    <section className="hero" aria-labelledby="hero-heading">
      <h1 id="hero-heading">New invoice</h1>
      <p>Create a MUSD payment link on Mezo Testnet.</p>
      <p className="testnet-note">Testnet assets only. No real money is transferred.</p>
    </section>
    <WalletBalance /><CreateInvoice />
  </main>;
}
