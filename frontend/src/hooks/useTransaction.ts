"use client";

import { useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Hash, TransactionReceipt } from "viem";
import { mezoTestnet } from "@/config/wagmi";
import { errorMessage } from "@/lib/invoices";

export function useTransaction() {
  const publicClient = usePublicClient({ chainId: mezoTestnet.id });
  const queryClient = useQueryClient();
  const active = useRef(false);
  const [phase, setPhase] = useState<"idle" | "wallet" | "confirming" | "success" | "error">("idle");
  const [hash, setHash] = useState<Hash>();
  const [error, setError] = useState<string>();

  async function run(send: () => Promise<Hash>, onConfirmed?: (receipt: TransactionReceipt) => void) {
    if (active.current) return;
    active.current = true;
    setError(undefined);
    setHash(undefined);
    setPhase("wallet");
    let submitted = false;
    try {
      if (!publicClient) throw new Error("Mezo Testnet RPC is unavailable. Please try again.");
      const txHash = await send();
      submitted = true;
      setHash(txHash);
      setPhase("confirming");
      let replacedWithDifferentCall = false;
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        onReplaced: (replacement) => {
          setHash(replacement.transactionReceipt.transactionHash);
          if (replacement.reason !== "repriced") replacedWithDifferentCall = true;
        },
      });
      if (replacedWithDifferentCall) throw new Error("Transaction was cancelled or replaced with a different wallet transaction.");
      if (receipt.status !== "success") throw new Error("Transaction reverted. No invoice change was committed.");
      setHash(receipt.transactionHash);
      setPhase("success");
      // Refresh wallet balances, invoice lists, allowance, and invoice receipts.
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "readContract" || query.queryKey[0] === "readContracts",
      });
      onConfirmed?.(receipt);
    } catch (cause) {
      setPhase("error");
      setError(`${errorMessage(cause)}${submitted ? " Check the transaction in the explorer before retrying." : ""}`);
    } finally {
      active.current = false;
    }
  }

  function reset() {
    if (active.current) return;
    setPhase("idle");
    setHash(undefined);
    setError(undefined);
  }

  return { run, reset, phase, hash, error, publicClient, busy: phase === "wallet" || phase === "confirming" };
}
