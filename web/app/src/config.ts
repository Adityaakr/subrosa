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

// The market account deployed on testnet (public reserves) + its collateral faucet.
export const MARKET_ID_HEX = "0x5ff0303f0b795d1039ca5b51d8480b";
export const OBX_FAUCET_HEX = "0x1201d9f8819d5220778535e4e2f08a";

// StorageValue slot names exported by the market component.
export const SLOT_YES = "miden_market::market::yes_reserve";
export const SLOT_NO = "miden_market::market::no_reserve";
export const SLOT_VOL = "miden_market::market::total_volume";
export const SLOT_RES = "miden_market::market::resolution";

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
    category: "Infra",
    color: "#FF5500",
    question: "Will Miden mainnet launch before Aug 1?",
    closes: "47d",
    volume: "$126k",
  },
  {
    id: "eth-4000",
    category: "Crypto",
    color: "#066EFF",
    question: "Will ETH close above $4,000 on Jul 31?",
    closes: "45d",
    volume: "$412k",
    yesPct: 63,
  },
  {
    id: "fed-cut",
    category: "Macro",
    color: "#A300D6",
    question: "Will the Fed cut rates in September?",
    closes: "93d",
    volume: "$908k",
    yesPct: 45,
  },
];
