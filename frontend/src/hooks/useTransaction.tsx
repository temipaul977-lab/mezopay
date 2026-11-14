"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Hash, TransactionReceipt } from "viem";
import { MEZOPAY_ADDRESS, MUSD_ADDRESS, mezoTestnet } from "@/config/wagmi";
import { errorMessage } from "@/lib/invoices";
import { readPendingTransactions, receiptMatchesTransaction, TRANSACTION_STORAGE_KEY, type PendingTransaction, type TransactionKind } from "@/lib/transactions";

type State = {
  phase: "idle" | "wallet" | "confirming" | "success" | "error" | "unknown";
  hash?: Hash;
  error?: string;
  receipt?: TransactionReceipt;
  kind?: TransactionKind;
  confirmedAt?: number;
};
const idle: State = { phase: "idle" };
type Context = {
  states: Record<string, State>;
  ready: boolean;
  run: (scope: string, kind: TransactionKind, send: () => Promise<Hash>, confirmed?: (receipt: TransactionReceipt) => void) => Promise<void>;
  reset: (scope: string) => void;
  recheck: (scope: string) => void;
};
const TransactionContext = createContext<Context | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const client = usePublicClient({ chainId: mezoTestnet.id });
  const queryClient = useQueryClient();
  const [states, setStates] = useState<Record<string, State>>({});
  const [ready, setReady] = useState(false);
  const entries = useRef<Record<string, State>>({});
  const watching = useRef(new Set<string>());

  const update = useCallback((scope: string, state: State) => {
    entries.current = { ...entries.current, [scope]: state };
    setStates(entries.current);
    const pending = Object.entries(entries.current).flatMap(([key, entry]) =>
      entry.hash && entry.kind && ["confirming", "unknown"].includes(entry.phase)
        ? [{ scope: key, hash: entry.hash, kind: entry.kind }] : []);
    try { sessionStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(pending)); } catch { /* Storage may be disabled. Route-level tracking still works. */ }
  }, []);

  const watch = useCallback(async (pending: PendingTransaction, confirmed?: (receipt: TransactionReceipt) => void) => {
    if (!client || watching.current.has(pending.scope)) return;
    watching.current.add(pending.scope);
    let hash = pending.hash;
    let differentCall = false;
    update(pending.scope, { phase: "confirming", hash, kind: pending.kind });
    try {
      const receipt = await client.waitForTransactionReceipt({
        hash, confirmations: 1, timeout: 120_000,
        onReplaced: (replacement) => {
          hash = replacement.transactionReceipt.transactionHash;
          differentCall ||= replacement.reason !== "repriced";
          update(pending.scope, { phase: "confirming", hash, kind: pending.kind });
        },
      });
      if (differentCall || receipt.status !== "success") {
        update(pending.scope, { phase: "error", hash, kind: pending.kind,
          error: differentCall ? "The wallet cancelled or replaced this transaction. Review the explorer before continuing." : "The transaction failed. The invoice was not changed. Network gas may still have been charged." });
        return;
      }
      if (!receiptMatchesTransaction(pending, receipt, MEZOPAY_ADDRESS, MUSD_ADDRESS)) {
        update(pending.scope, { phase: "error", hash: receipt.transactionHash, kind: pending.kind,
          error: "The transaction confirmed, but it does not contain the expected invoice or approval event. Review it in the explorer before continuing." });
        return;
      }
      update(pending.scope, { phase: "success", hash: receipt.transactionHash, receipt, kind: pending.kind, confirmedAt: Date.now() });
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "readContract" || query.queryKey[0] === "readContracts" });
      confirmed?.(receipt);
    } catch (cause) {
      // A timeout/RPC error does not mean the submitted transaction failed.
      update(pending.scope, { phase: "unknown", hash, kind: pending.kind,
        error: `Confirmation is unavailable. Your transaction may still complete. ${errorMessage(cause)}` });
    } finally { watching.current.delete(pending.scope); }
  }, [client, queryClient, update]);

  useEffect(() => {
    if (!client) return;
    let pending: PendingTransaction[] = [];
    try { pending = readPendingTransactions(sessionStorage.getItem(TRANSACTION_STORAGE_KEY)); } catch { /* Optional storage. */ }
    for (const entry of pending) void watch(entry);
    setReady(true);
  }, [client, watch]);

  async function run(scope: string, kind: TransactionKind, send: () => Promise<Hash>, confirmed?: (receipt: TransactionReceipt) => void) {
    if (!ready || Object.values(entries.current).some((entry) => ["wallet", "confirming", "unknown"].includes(entry.phase))) return;
    update(scope, { phase: "wallet", kind });
    try {
      if (!client) throw new Error("Mezo Testnet is unavailable. Try again shortly.");
      const hash = await send();
      await watch({ scope, kind, hash }, confirmed);
    } catch (cause) { update(scope, { phase: "error", kind, error: errorMessage(cause) }); }
  }

  function reset(scope: string) {
    if (["wallet", "confirming", "unknown"].includes(entries.current[scope]?.phase)) return;
    update(scope, idle);
  }

  return <TransactionContext.Provider value={{ states, ready, run, reset, recheck: (scope) => {
    const entry = entries.current[scope];
    if (entry?.hash && entry.kind) void watch({ scope, hash: entry.hash, kind: entry.kind });
  } }}>{children}</TransactionContext.Provider>;
}

export function useTransactionActivity() {
  const context = useContext(TransactionContext);
  if (!context) throw new Error("TransactionProvider is required");
  return context;
}

export function useTransaction(scope: string) {
  const context = useTransactionActivity();
  const state = context.states[scope] ?? idle;
  const publicClient = usePublicClient({ chainId: mezoTestnet.id });
  return {
    ...state, publicClient,
    busy: !context.ready || Object.values(context.states).some((entry) => ["wallet", "confirming", "unknown"].includes(entry.phase)),
    run: (send: () => Promise<Hash>, confirmed?: (receipt: TransactionReceipt) => void, kind: TransactionKind = "create") => context.run(scope, kind, send, confirmed),
    reset: () => context.reset(scope),
    recheck: () => context.recheck(scope),
  };
}
