import { BaseError, UserRejectedRequestError, formatUnits, parseUnits, type Address } from "viem";

export type Invoice = {
  id: bigint;
  creator: Address;
  payer: Address;
  amount: bigint;
  title: string;
  memo: string;
  paid: boolean;
  createdAt: bigint;
  paidAt: bigint;
};

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function musdAmount(amount: bigint) {
  // Never round invoice amounts or convert them through a JavaScript Number.
  return formatUnits(amount, 18);
}

export function parseMusd(input: string): bigint {
  const value = input.trim();
  if (value.length > 100 || !/^\d+(\.\d{1,18})?$/.test(value)) {
    throw new Error("Enter a positive MUSD amount with at most 18 decimal places.");
  }
  const amount = parseUnits(value, 18);
  if (amount <= 0n || amount > (1n << 256n) - 1n) {
    throw new Error("Enter a positive MUSD amount within the supported range.");
  }
  return amount;
}

export function parseInvoiceId(value: string): bigint | null {
  if (!/^[1-9]\d*$/.test(value) || value.length > 78) return null;
  const id = BigInt(value);
  return id <= (1n << 256n) - 1n ? id : null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof BaseError) {
    if (error.walk((cause) => cause instanceof UserRejectedRequestError) instanceof UserRejectedRequestError) {
      return "Request declined in your wallet. Nothing was submitted. You can try again when ready.";
    }
    return error.shortMessage;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function invoiceDate(timestamp: bigint) {
  const date = new Date(Number(timestamp) * 1000);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}
