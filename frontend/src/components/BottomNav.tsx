"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilePlus2, ReceiptText } from "lucide-react";

const tabs = [
  { href: "/", label: "New Invoice", icon: FilePlus2 },
  { href: "/invoices", label: "My Invoices", icon: ReceiptText },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return <nav className="bottom-nav fixed bottom-0" aria-label="App navigation">
    {tabs.map(({ href, label, icon: Icon }) => {
      const active = pathname === href;
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`bottom-tab min-h-12 ${active ? "bottom-tab-active" : ""}`}>
        <Icon size={22} strokeWidth={active ? 2.3 : 1.7} aria-hidden="true" />
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}
