import { parseAbi } from "viem";
import deployment from "./MezoPayInvoices.json";

// Literal signatures preserve viem's argument/result inference. At runtime we use
// the exact ABI exported by the Phase 1 deployment, including its constructor.
const invoiceInterface = parseAbi([
  "function createInvoice(uint256 amount, string title, string memo) returns (uint256 invoiceId)",
  "function payInvoice(uint256 invoiceId)",
  "function getInvoice(uint256 id) view returns ((uint256 id, address creator, address payer, uint256 amount, string title, string memo, bool paid, uint256 createdAt, uint256 paidAt))",
  "function getCreatorInvoices(address creator) view returns (uint256[])",
  "function getPayerInvoices(address payer) view returns (uint256[])",
  "function totalInvoices() view returns (uint256)",
  "function musdToken() view returns (address)",
  "event InvoiceCreated(uint256 indexed id, address indexed creator, uint256 amount, string title)",
  "event InvoicePaid(uint256 indexed id, address indexed creator, address indexed payer, uint256 amount)",
]);

export const invoiceAbi = deployment.abi as unknown as typeof invoiceInterface;

export const musdAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
