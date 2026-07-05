// Executes queued place notes against the public market account. User wallets
// create and collateralize the notes; this service only consumes them, so the
// market contract derives reserve movement from assets it receives atomically.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { MARKET_ID_HEX, MIDEN_CLI, PLACE_NOTE_ROOTS, POLL_INTERVAL_MS } from "./config.js";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OPERATOR = resolve(ROOT, "operator");

async function executeQueuedNotes(): Promise<void> {
  await run(MIDEN_CLI, ["sync"], { cwd: OPERATOR });
  const { stdout: list } = await run(
    MIDEN_CLI,
    ["notes", "--list", "consumable", "--account-id", MARKET_ID_HEX],
    { cwd: OPERATOR },
  );
  const candidates = [...new Set(list.match(/0x[0-9a-f]{64}/gi) ?? [])];
  const placeNotes: string[] = [];
  for (const noteId of candidates) {
    const { stdout: details } = await run(MIDEN_CLI, ["notes", "--show", noteId], { cwd: OPERATOR });
    const root = details.match(/Script Root\s+(0x[0-9a-f]{64})/i)?.[1]?.toLowerCase();
    if (root && PLACE_NOTE_ROOTS.has(root)) placeNotes.push(noteId);
  }
  if (!placeNotes.length) {
    console.log("[market-operator] no queued Subrosa notes");
    return;
  }
  const { stdout } = await run(
    MIDEN_CLI,
    ["consume-notes", "--account", MARKET_ID_HEX, "--force", ...placeNotes],
    { cwd: OPERATOR },
  );
  if (stdout.trim()) console.log(stdout.trim());
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  do {
    try {
      await executeQueuedNotes();
    } catch (error) {
      console.error("[market-operator]", error instanceof Error ? error.message : error);
    }
    if (!once) await new Promise((resolveDelay) => setTimeout(resolveDelay, POLL_INTERVAL_MS));
  } while (!once);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
