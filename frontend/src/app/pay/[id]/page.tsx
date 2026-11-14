import type { Metadata } from "next";
import { Checkout } from "@/components/Checkout";

export const metadata: Metadata = {
  title: "Pay an invoice",
  description: "View and pay a Bitcoin-backed MUSD invoice directly on Mezo Testnet.",
};

export default function PaymentPage({ params }: { params: { id: string } }) {
  return <main id="main" className="page-shell"><Checkout invoiceId={params.id} /></main>;
}
