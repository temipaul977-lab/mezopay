"use client";

import { useTransactionActivity } from "@/hooks/useTransaction";
import { ExplorerLink, Spinner } from "./ui";

export function TransactionActivity() {
  const { states, recheck } = useTransactionActivity();
  const active = Object.entries(states).find(([, state]) => ["wallet", "confirming", "unknown"].includes(state.phase));
  if (!active) return null;
  const [scope, state] = active;
  const label = state.kind === "create" ? "Invoice creation" : state.kind === "approve" ? "MUSD approval" : "Invoice payment";
  return <aside className="transaction-activity" role="status" aria-live="polite">
    <div className="flex items-start gap-3">{state.phase !== "unknown" && <Spinner />}<div>
      <p className="font-semibold">{label}: {state.phase === "wallet" ? "waiting for your wallet" : state.phase === "unknown" ? "confirmation unavailable" : "waiting for confirmation"}</p>
      <p className="mt-1">{state.phase === "unknown" ? "Do not submit again until the transaction status is known." : "You can switch tabs. We will keep tracking this transaction."}</p>
      <div className="flex flex-wrap items-center gap-4">{state.hash && <ExplorerLink value={state.hash}>View transaction</ExplorerLink>}{state.phase === "unknown" && <button className="text-bitcoin underline" onClick={() => recheck(scope)}>Check confirmation</button>}</div>
    </div></div>
  </aside>;
}
