# MezoPay contracts — Phase 1

CommonJS Hardhat project using Solidity 0.8.24, optimizer (200 runs), and the London EVM target. Local tests also run on the London hardfork.

```powershell
cd contracts
npm.cmd ci --cache ../.npm-cache
npx.cmd hardhat test
```

Invoices start at ID 1. Amounts use 18-decimal MUSD units. A payer must approve this invoice contract to spend the amount before calling `payInvoice`. The full amount moves directly from payer to creator. Failed transfers revert the payment; a reentrancy guard protects the token interaction. Missing invoice IDs revert in both `getInvoice` and `payInvoice`.

## Deploy when ready

Copy `.env.example` to `.env`, replace the placeholder with the deployer's private key, and fund that wallet with testnet BTC for gas. Never commit `.env`.

```powershell
npm.cmd run deploy:mezo
```

The script requires Mezo Testnet (chain ID 31611) and uses RPC `https://rpc.test.mezo.org`. Native gas is BTC (18 decimals). The MUSD token is fixed to `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` (18 decimals).

After a successful deployment, the script logs the address and `https://explorer.test.mezo.org/address/<ADDRESS>`, then creates `../frontend/src/contracts/MezoPayInvoices.json` with `address`, `abi`, `chainId`, `musdToken`, and `explorerUrl`. No frontend is built by Phase 1, and the deployment JSON is created only after an actual deployment.
