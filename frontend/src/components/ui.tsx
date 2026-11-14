"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, Check, Copy, Loader2 } from "lucide-react";
import { EXPLORER_URL } from "@/config/wagmi";

export function Spinner() {
  return <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />;
}

export function StatusBadge({ paid }: { paid: boolean }) {
  return <span className={`status ${paid ? "status-paid" : "status-pending"}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />{paid ? "PAID" : "PENDING"}
  </span>;
}

export function ExplorerLink({ value, type = "tx", children, className = "" }: {
  value: string;
  type?: "tx" | "address";
  children: ReactNode;
  className?: string;
}) {
  return <a href={`${EXPLORER_URL}/${type}/${value}`} target="_blank" rel="noopener noreferrer"
    className={`inline-flex items-center gap-1.5 transition-colors hover:text-bitcoin ${className}`}>
    {children}<ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span className="sr-only"> (opens in a new tab)</span>
  </a>;
}

export function CopyButton({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setFailed(true);
    }
  }
  return <div>
    <button type="button" onClick={copy} className="btn-secondary whitespace-nowrap">
      {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied!" : label}
    </button>
    <span className="sr-only" role="status">{copied ? "Copied to clipboard" : ""}</span>
    {failed && <p role="alert" className="mt-2 text-xs text-amber-300">Copy unavailable. Select and copy the link manually.</p>}
  </div>;
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return <div role="alert" className="error-notice">{children}</div>;
}
