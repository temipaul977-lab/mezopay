# MezoPay

Bitcoin-backed MUSD payment links and invoices for the Mezo Buildathon, **Access & Distribution** track. Create an invoice, share its checkout URL, and receive MUSD directly from the payer. The protocol charges zero fees; BTC network gas still applies.

## Live Mezo Testnet deployment

| Setting | Value |
| --- | --- |
| Network | Mezo Testnet |
| Chain ID | `31611` (`0x7b7b`) |
| RPC | `https://rpc.test.mezo.org` |
| Gas currency | Bitcoin (`BTC`, 18 decimals) |
| Invoice contract | [`0x3a9bD911dD099F1e8fB30070527891AE1d89a80f`](https://explorer.test.mezo.org/address/0x3a9bD911dD099F1e8fB30070527891AE1d89a80f) |
| MUSD token | [`0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`](https://explorer.test.mezo.org/address/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503) |
| MUSD units | 18 decimals; symbol `MUSD` |
| Explorer | [Mezo Explorer](https://explorer.test.mezo.org) |

This application uses **testnet assets**. It integrates the official testnet MUSD ERC-20; it does not mint MUSD or manage BTC collateral.

## Local frontend setup

Use Node.js 20.9+ and npm. From the repository root:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open [localhost:3000](http://localhost:3000). On macOS/Linux, use `npm` in place of `npm.cmd`. No environment variables, WalletConnect project ID, backend, or API keys are needed. The first successful install creates `frontend/package-lock.json`; commit it and use `npm ci` for subsequent reproducible installs.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

These commands operate inside `frontend/`. The contract project is separate and does not need to be rebuilt or redeployed to run the frontend.

## Use the app

1. Install/unlock MetaMask, Rabby, or another injected EVM wallet. Connect it and use **Switch to Mezo Testnet** if prompted. The chain definition includes the RPC and BTC gas currency so compatible wallets can add the network.
2. Keep testnet BTC in the wallet for transaction gas. To pay, also hold enough testnet MUSD at the token address above.
3. On `/`, enter a title, a positive MUSD amount (up to 18 decimal places), and optional memo. Create the payment link and confirm the transaction in your wallet.
4. Once the transaction receipt confirms, the app decodes `InvoiceCreated` from the invoice contract, displays the exact invoice ID, and offers a copyable `/pay/<id>` checkout URL.
5. Anyone with that URL can view the invoice without connecting a wallet. The payer connects on Mezo Testnet, approves the **exact invoice amount** of MUSD if needed, waits for approval confirmation, then submits the payment.
6. After the payment receipt confirms, the invoice refreshes to **PAID**, with payer and timestamp. The current transaction has a direct explorer link. Reopened paid invoices display the onchain payment details; this app does not index historical transaction hashes.

The dashboard separates invoices **Created by Me** and **Paid by Me**. Lists are ordered newest first and paginated; invoice details, balances, and allowances refresh periodically and after confirmed transactions. Explorer links in dashboard rows open the deployed invoice contract; individual invoice details open the checkout page.

Use a publicly reachable frontend origin when sharing with other people: a `localhost` link works only on the machine running the development server. Invoice titles and memos are public onchain data.

## Architecture

```text
frontend/
  src/app/                      Next.js App Router layouts, providers, pages
    page.tsx                    Invoice creator and wallet dashboard
    pay/[id]/page.tsx           Shareable checkout route
  src/components/               Wallet UI, composer, dashboard, receipt
  src/config/wagmi.ts           Fixed chain, RPC, addresses, injected connector
  src/contracts/
    MezoPayInvoices.json        Phase 1 deployment artifact and exact ABI
    abis.ts                     Artifact ABI with typed viem signatures; MUSD ABI
  src/hooks/useTransaction.tsx  Shared transaction tracking and reload recovery
  src/lib/invoices.ts           Bigint amount/ID validation and display helpers
contracts/                      Existing Phase 1 Hardhat project (unchanged)
```

Next.js 14, React 18, TypeScript, and Tailwind provide the UI. Wagmi v2 manages wallet connections and writes; viem handles encoding, simulation, and receipts; TanStack Query manages reads and cache refreshes. Public reads explicitly use chain `31611`, independently of the wallet's active chain. Writes require Mezo Testnet and are simulated before requesting a signature. Missing/invalid IDs, rejected signatures, failed receipts, unavailable RPC reads, insufficient MUSD, and wrong-network states are surfaced in the UI. No invoice or balance is mocked.

Amounts remain `bigint` in 18-decimal token units. Checkout reads `allowance(payer, invoiceContract)` on MUSD and requests `approve(invoiceContract, invoice.amount)` only when necessary. `payInvoice(id)` then invokes the contract's MUSD `transferFrom(payer, creator, amount)`. MUSD flows directly to the creator, and the frontend never holds funds or private keys.

The deployed contract was compiled in Phase 1 with Solidity 0.8.24 and `evmVersion: "london"`. Phase 2 only adds the frontend and this README; it makes no changes under `contracts/`.

## Manual verification

- Open a valid `/pay/<id>` link with no wallet connected; confirm recipient, amount, title, and memo match the contract.
- Create a small invoice; confirm the generated link's ID matches `InvoiceCreated` and the dashboard shows it.
- Use a second wallet with BTC gas and MUSD. With insufficient allowance, approve first; confirm payment becomes available only after the allowance updates.
- Pay, verify the explorer receipt, the creator's MUSD increase, and the **PAID** state in both wallets' dashboards.
- Reopen a paid link, try an invalid/missing ID, reject a signature, and switch the connected wallet to another chain to check the recovery states.

Full TypeScript checking and a production build require installed frontend dependencies. Network-restricted environments can prepare all source/config files without installing; run the validation commands above once package downloads are available.

## Frontend UX and regression checks

The UI uses native system fonts and exact decimal token amounts. Phones use a bottom navigation bar and wallet selection sheet. At desktop widths the app expands into a workspace with side navigation and an invoice preview. **My Invoices** is available at `/invoices`.

Invoice drafts and submitted transaction hashes are kept in session storage for the current browser tab. Pending confirmations survive app navigation and page reloads; an unknown confirmation status blocks another submission until it is checked. Confirmed receipts must contain the expected contract event, payer/creator, and invoice ID. These records contain no private keys. If browser storage is disabled, tracking still survives in-app navigation, but cannot survive a reload.

`npm test` checks decimal precision, invalid IDs, transaction restoration data, rejected wallet requests, and receipt identity. After `npm run build`, run `npm run test:browser` for browser regression checks with a **simulated injected wallet and RPC**. The browser suite checks mobile/desktop layouts, keyboard navigation, draft retention, transaction recovery after reload, approval/payment, insufficient balance, wrong-network recovery, and stale-read handling. It does not submit live transactions.

The browser suite uses an installed Chrome/Chromium, Node.js 22+, and free local ports 3100 and 9227. Set `BROWSER_BIN` if Chrome is not in its default location. It creates an isolated browser profile and screenshots under ignored `frontend/.qa/`, starts its own production server, and closes both after the checks. Its isolated headless browser runs without the Chrome sandbox to support restricted development environments; it only visits the local test app. The test fixture is confined to `frontend/test/` and is not included in production application code.

See [the frontend review](frontend/REVIEW.md) for the findings, research sources, and verification limits.
