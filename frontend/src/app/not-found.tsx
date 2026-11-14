import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <main id="main" className="page-shell"><div className="checkout-problem"><p className="eyebrow text-bitcoin">404</p><h1>This link took a wrong turn.</h1><p>Head back to your workspace to create or find an invoice.</p><Link className="btn-primary" href="/"><ArrowLeft size={15} />Back to MezoPay</Link></div></main>;
}
