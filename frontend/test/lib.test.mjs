import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as viem from "viem";

// Exercise the actual TypeScript helpers without adding a test-runner dependency.
globalThis.__mezopayTestViem = viem;
async function load(source) {
  const input = fs.readFileSync(new URL(source, import.meta.url), "utf8");
  const output = ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/import\s*\{([^}]+)\}\s*from\s*"viem";/g, "const {$1} = globalThis.__mezopayTestViem;");
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}
const { parseMusd, musdAmount, parseInvoiceId, invoiceDate, errorMessage } = await load("../src/lib/invoices.ts");
const { readPendingTransactions, receiptMatchesTransaction } = await load("../src/lib/transactions.ts");
const creator = "0x1111111111111111111111111111111111111111";
const invoiceAddress = "0x3a9bD911dD099F1e8fB30070527891AE1d89a80f";
const musdAddress = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const hash = `0x${"a".repeat(64)}`;

test("MUSD amounts preserve every decimal and reject rounding/exponent input", () => {
  assert.equal(parseMusd("25"), 25n * 10n ** 18n);
  assert.equal(parseMusd("0.000000000000000001"), 1n);
  assert.equal(musdAmount(parseMusd("123456789.123456789123456789")), "123456789.123456789123456789");
  for (const amount of ["0", "-1", "1e18", "1,000", "1.0000000000000000001", "9".repeat(1000), "", "0.0"]) assert.throws(() => parseMusd(amount));
  assert.throws(() => parseMusd((1n << 256n).toString()));
});

test("invoice URLs accept only valid positive uint256 IDs", () => {
  assert.equal(parseInvoiceId("42"), 42n);
  assert.equal(parseInvoiceId(((1n << 256n) - 1n).toString()), (1n << 256n) - 1n);
  for (const id of ["0", "-1", "1.5", "01", " 1", "abc", (1n << 256n).toString()]) assert.equal(parseInvoiceId(id), null);
});

test("damaged or unrelated session data cannot restore a wallet operation", () => {
  const entry = { scope: `checkout:42:${creator}`, kind: "pay", hash };
  assert.deepEqual(readPendingTransactions(JSON.stringify([entry])), [entry]);
  for (const value of ["broken", "null", "{}", JSON.stringify([{ ...entry, hash: "0x123" }]), JSON.stringify([{ ...entry, kind: "transfer" }]), JSON.stringify([{ ...entry, scope: "checkout:abc:no-wallet" }])]) assert.deepEqual(readPendingTransactions(value), []);
});

const events = viem.parseAbi([
  "event InvoiceCreated(uint256 indexed id, address indexed creator, uint256 amount, string title)",
  "event InvoicePaid(uint256 indexed id, address indexed creator, address indexed payer, uint256 amount)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);
function log(eventName, args, values, parameters, address) {
  return { address, topics: viem.encodeEventTopics({ abi: events, eventName, args }), data: viem.encodeAbiParameters(parameters, values) };
}

test("payment confirmation must match contract, payer, ID, and successful receipt", () => {
  const pending = { scope: `checkout:42:${creator}`, kind: "pay", hash };
  const receipt = { status: "success", from: creator, to: invoiceAddress, logs: [log("InvoicePaid", { id: 42n, creator, payer: creator }, [25n], [{ type: "uint256" }], invoiceAddress)] };
  assert.equal(receiptMatchesTransaction(pending, receipt, invoiceAddress, musdAddress), true);
  for (const changed of [{ ...receipt, status: "reverted" }, { ...receipt, to: creator }, { ...receipt, from: musdAddress }, { ...receipt, logs: [] }]) assert.equal(receiptMatchesTransaction(pending, changed, invoiceAddress, musdAddress), false);
  assert.equal(receiptMatchesTransaction({ ...pending, scope: `checkout:43:${creator}` }, receipt, invoiceAddress, musdAddress), false);
});

test("creation and approval receipts are distinct and verify their emitters", () => {
  const created = { status: "success", from: creator, to: invoiceAddress, logs: [log("InvoiceCreated", { id: 42n, creator }, [25n, "Audit"], [{ type: "uint256" }, { type: "string" }], invoiceAddress)] };
  assert.equal(receiptMatchesTransaction({ scope: `create:${creator}`, kind: "create", hash }, created, invoiceAddress, musdAddress), true);
  const approval = { status: "success", from: creator, to: musdAddress, logs: [log("Approval", { owner: creator, spender: invoiceAddress }, [25n], [{ type: "uint256" }], musdAddress)] };
  assert.equal(receiptMatchesTransaction({ scope: `checkout:42:${creator}`, kind: "approve", hash }, approval, invoiceAddress, musdAddress), true);
  assert.equal(receiptMatchesTransaction({ scope: `checkout:42:${creator}`, kind: "pay", hash }, approval, invoiceAddress, musdAddress), false);
});

test("user rejection is actionable and dates include a timezone", () => {
  assert.match(errorMessage(new viem.UserRejectedRequestError(new Error("rejected"))), /Nothing was submitted/);
  assert.match(invoiceDate(1735689600n), /2025/);
  assert.match(invoiceDate(1735689600n), /[A-Z]{2,}|GMT/);
});
