/**
 * Extract a `command` string from opaque tool-call `input` payloads.
 *
 * Multiple callsites previously had their own copy of this logic.
 * The canonical implementation lives here.
 */
import { toRecord } from "./normalize";

export function getCommandFromInput(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "";
  const command = record.command;
  return typeof command === "string" ? command.trim() : "";
}
