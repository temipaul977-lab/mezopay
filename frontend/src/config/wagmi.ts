// The main entry exports the core injected connector without loading the
// optional Coinbase, Base, and WalletConnect SDK connector barrel.
import { createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";

export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" },
  },
  testnet: true,
});

export const MEZOPAY_ADDRESS = "0x3a9bD911dD099F1e8fB30070527891AE1d89a80f" as const;
export const MUSD_ADDRESS = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503" as const;
export const EXPLORER_URL = "https://explorer.test.mezo.org";

export const config = createConfig({
  chains: [mezoTestnet],
  connectors: [injected()],
  transports: { [mezoTestnet.id]: http("https://rpc.test.mezo.org") },
  ssr: true,
});
