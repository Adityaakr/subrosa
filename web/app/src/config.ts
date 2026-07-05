// Subrosa web app configuration.

export const APP_NAME = "Subrosa";

// Miden SDK — testnet RPC. Proving is DELEGATED to the testnet prover by
// default: keys, execution and private state stay in the browser; only the
// heavy STARK proof generation is offloaded (fully-local in-browser proving is
// available via VITE_MIDEN_PROVER=local but is very CPU-heavy and can stall).
export const MIDEN_RPC_URL = import.meta.env.VITE_MIDEN_RPC_URL ?? "testnet";
export const MIDEN_PROVER =
  (import.meta.env.VITE_MIDEN_PROVER as "local" | "testnet" | "devnet") ?? "testnet";

export const EXPLORER_BASE_URL = "https://testnet.midenscan.com";

// The market accounts deployed on testnet (public reserves) + the collateral faucet.
export const MARKET_ID_HEX = "0xabbba77bce4bc6d1795be21b30fa5e";
export const ETH_MARKET_ID_HEX = "0x72d3ac938ff65611194c3e21d118e9";
export const FED_MARKET_ID_HEX = "0xca646b034eb701311909b674f207ac";
export const OBX_FAUCET_HEX = "0x1201d9f8819d5220778535e4e2f08a";

// StorageValue slot names exported by the market component.
export const SLOT_YES = "market::market::yes_reserve";
export const SLOT_NO = "market::market::no_reserve";
export const SLOT_VOL = "market::market::total_volume";
export const SLOT_RES = "market::market::resolution";

export type Market = {
  id: string;
  live?: boolean; // backed by the on-chain market account (odds read live)
  category: string;
  color: string;
  question: string;
  closes: string;
  volume: string;
  yesPct?: number; // static fallback odds (%) for display-only markets
};

export const MARKETS: Market[] = [
  {
    id: "miden-mainnet",
    live: true,
    category: "Sports",
    color: "#FF5500",
    question: "Will Morocco win the 2026 FIFA World Cup?",
    closes: "15d",
    volume: "0 OBX",
  },
  {
    id: "eth-4k",
    live: true,
    category: "Crypto",
    color: "#066EFF",
    question: "Will Ethereum reach $2,000 in July?",
    closes: "26d",
    volume: "0 OBX",
  },
  {
    id: "fed-sep",
    live: true,
    category: "Macro",
    color: "#A300D6",
    question: "Fed rate cut by September 2026 meeting?",
    closes: "73d",
    volume: "0 OBX",
  },
];
