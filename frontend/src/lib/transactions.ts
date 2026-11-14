import { parseAbi, parseEventLogs, type Address, type Hash, type TransactionReceipt } from "viem";

export type TransactionKind = "create" | "approve" | "pay";
export type PendingTransaction = { scope: string; hash: Hash; kind: TransactionKind };
export const TRANSACTION_STORAGE_KEY = "mezopay.pending-transactions.v1";

function validScope(scope: string) {
  if (/^create:0x[0-9a-fA-F]{40}$/.test(scope)) return true;
  const match = /^checkout:([1-9]\d{0,77}):0x[0-9a-fA-F]{40}$/.exec(scope);
  return !!match && BigInt(match[1]) < 1n << 256n;
}

export function readPendingTransactions(value: string | null): PendingTransaction[] {
  try {
    const entries: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry): entry is PendingTransaction =>
      !!entry && typeof entry === "object" && typeof entry.scope === "string" &&
      validScope(entry.scope) && typeof entry.hash === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(entry.hash) && ["create", "approve", "pay"].includes(entry.kind));
  } catch { return []; }
}

const events = parseAbi([
  "event InvoiceCreated(uint256 indexed id, address indexed creator, uint256 amount, string title)",
  "event InvoicePaid(uint256 indexed id, address indexed creator, address indexed payer, uint256 amount)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

// Also protects restored transactions from being mistaken for their cancelled
// replacements: a successful receipt alone does not prove the intended action.
export function receiptMatchesTransaction(pending: PendingTransaction, receipt: TransactionReceipt, invoiceAddress: Address, musdAddress: Address) {
  const parts = pending.scope.split(":");
  const account = parts.at(-1)?.toLowerCase();
  const target = pending.kind === "approve" ? musdAddress : invoiceAddress;
  if (!validScope(pending.scope) || receipt.status !== "success" || receipt.from.toLowerCase() !== account || receipt.to?.toLowerCase() !== target.toLowerCase()) return false;
  const logs = receipt.logs.filter((log) => log.address.toLowerCase() === target.toLowerCase());
  if (pending.kind === "create") return parts[0] === "create" && parseEventLogs({ abi: events, eventName: "InvoiceCreated", logs }).some((event) => event.args.creator.toLowerCase() === account);
  if (parts[0] !== "checkout") return false;
  if (pending.kind === "approve") return parseEventLogs({ abi: events, eventName: "Approval", logs }).some((event) => event.args.owner.toLowerCase() === account && event.args.spender.toLowerCase() === invoiceAddress.toLowerCase());
  return parseEventLogs({ abi: events, eventName: "InvoicePaid", logs }).some((event) => event.args.payer.toLowerCase() === account && event.args.id === BigInt(parts[1]));
}
