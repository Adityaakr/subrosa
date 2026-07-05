// Lightweight, best-effort status snapshot for the autonomous loop. Written to
// agent/.agent-status.json each tick so the run is observable (and can later
// feed a UI) without standing up a server. Never throws — status is diagnostic.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); // agent/
const STATUS_PATH = resolve(ROOT, ".agent-status.json");

export type AgentStatus = {
  updatedAt: string;
  brain: string;
  enabled: boolean;
  dryRun: boolean;
  capObx: string;
  maxTrades: number;
  budgetObx: string;
  tradesPlaced: number;
  budgetSpentObx: string;
  lastOdds: { yes: string; no: string; resolution: string; yesPct: number | null };
  polymarket: { slug: string; conditionId: string; yesPct: number; updatedAt: string | null } | null;
  lastDecision: string | null;
  lastTx: string | null;
  halted: string | null;
};

export async function writeStatus(s: AgentStatus): Promise<void> {
  try {
    await writeFile(STATUS_PATH, JSON.stringify(s, null, 2));
  } catch {
    /* diagnostic only — ignore write failures */
  }
}
