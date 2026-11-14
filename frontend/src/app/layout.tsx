import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { TransactionActivity } from "@/components/TransactionActivity";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MezoPay — Bitcoin-backed MUSD invoicing", template: "%s | MezoPay" },
  description: "Create a MUSD invoice. Share a payment link. Get paid directly on Mezo Testnet, with zero protocol fees.",
};

export const viewport: Viewport = { themeColor: "#0B0F19", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>
    <Providers><div className="app-shell mx-auto min-h-screen pb-24">
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar /><TransactionActivity />{children}<Footer /><BottomNav />
    </div></Providers>
  </body></html>;
}
