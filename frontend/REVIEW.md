# Frontend review

The protocol constants and deployed contracts are unchanged. This review focuses on the Next.js application and its wallet/payment interactions.

The application now fills the browser viewport at all widths. Desktop uses a fixed full-height sidebar, a workspace toolbar, and an invoice editor beside its preview. Mobile uses edge-to-edge app chrome and bottom navigation. There is no centered device frame, outer gradient, or surrounding canvas. The balance summary only appears after connecting a wallet. Optional notes expand on demand to keep the primary action accessible.

The visual references are [Stripe Invoicing](https://stripe.com/invoicing) for a task-focused desktop workspace and [Strike](https://strike.me/) for the direct payment presentation. MezoPay keeps its own Bitcoin-orange and slate palette. Typography uses SF Pro through Apple's system font and Segoe UI Variable/Text on Windows, with native system fallbacks; no remote font request is needed.

| Finding | Change |
| --- | --- |
| Wallet connection or chain changes erased invoice input | Composer no longer remounts on wallet changes; the current-tab draft survives route changes and reloads |
| Pending transactions lost their UI when navigating | Transaction tracking lives above the routes and restores submitted hashes from session storage |
| A confirmation timeout looked like a failed payment | Unknown status is explicit, retains the explorer link, and blocks a repeat submission until rechecked |
| A successful replacement transaction could be mistaken for an invoice/payment | Receipts must match the intended contract, account, event, and invoice ID |
| A confirmed payment could briefly leave another Pay button enabled | Payment actions disable immediately after confirmation while the receipt refreshes |
| A failed RPC refresh hid a previously loaded invoice | Cached invoice data remains visible with a stale-status warning |
| Connecting always chose the first wallet | Native dialog/sheet lists detected injected wallets, shows missing-wallet instructions, and provides explicit address-copy/disconnect actions |
| Approval could be misread as a payment or invoice-specific permission | Copy describes a separate ERC-20 spending permission and separates MUSD amount, MezoPay fee, and BTC network gas |
| Small text, unclear pending labels, and a phone-only desktop presentation | Native system-font stack, clearer contrast, tabular amounts, Paid/Unpaid badges, desktop side navigation and preview, mobile bottom navigation |
| Tabs and clipboard fallback lacked complete recovery/accessibility | Arrow/Home/End keyboard navigation, semantic dialogs, focus management, and a selectable value when clipboard access fails |

Drafts are stored only for the current browser tab, not uploaded to a backend. Public invoice titles and memos are identified as public before submission. No fiat conversion, gas-price quote, fake balance, revenue summary, expiry, or refund promise has been added.

## UX sources

- [NN/g: Ten usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) — visible system status, plain-language actions, error prevention and recovery.
- [Android: Responsive navigation](https://developer.android.com/develop/ui/views/layout/build-responsive-navigation) — bottom navigation at compact widths and leading-edge navigation when space allows.
- [W3C: Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — usable target size and spacing. Primary controls here are at least 48 CSS pixels tall.

These principles inform the implementation; they are not a claim that the application has completed a formal WCAG audit.

## Verification

- `npm test`: helper and receipt-identity regression tests.
- `npm run typecheck` and `npm run build`: TypeScript and production compilation.
- `npm run test:browser`: isolated Chrome with simulated wallet/RPC, including public invoice reads, rejected requests, wrong-network recovery, insufficient balance, pending reload recovery, approval/payment, and stale receipt preservation. Checks 320px, 390px, 768px, 1280px, and 1920px layouts, including full-viewport shell width; screenshots are under `.qa/`.

Live RPC requests were denied by the workspace network policy (`EACCES`). Browser transactions use deterministic fixtures; no wallet funds were spent. An actual Mezo Testnet payment still requires a wallet with testnet MUSD and BTC. Historical transaction hashes are not indexed by this app; reopened paid invoices show the recorded payer, amount, and timestamp.
