#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/dev/reindex-sessions.mjs [--dry-run] [--state-dir <path>] [--agent <agentId> ...]",
      "",
      "Options:",
      "  --dry-run           Preview changes without writing sessions.json",
      "  --state-dir <path>  OpenClaw state dir (default: ~/.openclaw)",
      "  --agent <agentId>   Restrict to one or more agents (default: all under agents/)",
      "  -h, --help          Show this help",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    stateDir: "",
    agents: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--state-dir") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("Missing value for --state-dir");
      }
      options.stateDir = next;
      i += 1;
      continue;
    }
    if (arg === "--agent") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("Missing value for --agent");
      }
      options.agents.push(next.trim());
      i += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadStore(storePath) {
  if (!fs.existsSync(storePath)) return {};
  const raw = fs.readFileSync(storePath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`Invalid sessions.json shape: ${storePath}`);
  }
  return parsed;
}

function extractSessionIdFromFileName(fileName) {
  if (!fileName.endsWith(".jsonl")) return "";
  const stem = fileName.slice(0, -".jsonl".length);
  const topicMarker = "-topic-";
  const markerIndex = stem.indexOf(topicMarker);
  if (markerIndex > 0) {
    return stem.slice(0, markerIndex).trim();
  }
  return stem.trim();
}

function toTimestampMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const ts = Date.parse(value);
    if (Number.isFinite(ts)) return ts;
  }
  return null;
}

function readTranscriptUpdatedAt(filePath, fallbackMs) {
  try {
    const lines = fs
      .readFileSync(filePath, "utf-8")
      .split(/\r?\n/)
      .filter((line) => line.trim());
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      try {
        const parsed = JSON.parse(line);
        if (isRecord(parsed)) {
          const message = isRecord(parsed.message) ? parsed.message : null;
          const fromMessage = message ? toTimestampMs(message.timestamp) : null;
          if (fromMessage != null) return fromMessage;

          const fromEntry = toTimestampMs(parsed.timestamp);
          if (fromEntry != null) return fromEntry;
        }
      } catch {
        // Ignore malformed line.
      }
    }
  } catch {
    // Ignore read failures and use fallback.
  }
  return fallbackMs;
}

function ensureUniqueKey(store, baseKey) {
  if (!store[baseKey]) return baseKey;
  let i = 2;
  while (store[`${baseKey}-${i}`]) {
    i += 1;
  }
  return `${baseKey}-${i}`;
}

function reindexAgentSessions({ sessionsDir, agentId, dryRun }) {
  const storePath = path.join(sessionsDir, "sessions.json");
  const store = loadStore(storePath);
  const entries = Object.entries(store);
  const indexedSessionIds = new Set(
    entries
      .map(([, value]) =>
        isRecord(value) && typeof value.sessionId === "string" ? value.sessionId : "",
      )
      .filter(Boolean),
  );

  const files = fs
    .readdirSync(sessionsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const recovered = [];
  for (const fileName of files) {
    const sessionId = extractSessionIdFromFileName(fileName);
    if (!sessionId || indexedSessionIds.has(sessionId)) continue;

    const transcriptPath = path.join(sessionsDir, fileName);
    const stat = fs.statSync(transcriptPath);
    const updatedAt = readTranscriptUpdatedAt(transcriptPath, Math.round(stat.mtimeMs));
    const key = ensureUniqueKey(store, `agent:${agentId}:ui:reindex:${sessionId}`);

    store[key] = {
      sessionId,
      updatedAt,
      systemSent: true,
      abortedLastRun: false,
      label: `Recovered ${sessionId.slice(0, 8)}`,
      sessionFile: transcriptPath,
      origin: {
        provider: "clawui-reindex",
        label: fileName,
      },
    };
    indexedSessionIds.add(sessionId);
    recovered.push({ key, sessionId, fileName });
  }

  if (recovered.length > 0 && !dryRun) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    if (fs.existsSync(storePath)) {
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
      const backupPath = `${storePath}.bak.reindex.${stamp}`;
      fs.copyFileSync(storePath, backupPath);
    }
    fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
  }

  return {
    agentId,
    sessionsDir,
    storePath,
    scanned: files.length,
    recovered,
  };
}

function listAgentDirs(agentsRoot) {
  if (!fs.existsSync(agentsRoot)) return [];
  return fs
    .readdirSync(agentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    return;
  }

  const home = process.env.HOME || os.homedir();
  const stateDir = options.stateDir ? path.resolve(options.stateDir) : path.join(home, ".openclaw");
  const agentsRoot = path.join(stateDir, "agents");
  const agentIds = options.agents.length > 0 ? options.agents : listAgentDirs(agentsRoot);

  if (agentIds.length === 0) {
    console.log(`No agent directories found under: ${agentsRoot}`);
    return;
  }

  let totalRecovered = 0;
  for (const agentId of agentIds) {
    const sessionsDir = path.join(agentsRoot, agentId, "sessions");
    if (!fs.existsSync(sessionsDir)) {
      console.log(`[skip] agent=${agentId} sessionsDir not found: ${sessionsDir}`);
      continue;
    }
    const result = reindexAgentSessions({
      sessionsDir,
      agentId,
      dryRun: options.dryRun,
    });
    totalRecovered += result.recovered.length;
    console.log(
      `[agent:${agentId}] scanned=${result.scanned} recovered=${result.recovered.length} store=${result.storePath}`,
    );
    for (const item of result.recovered) {
      console.log(`  + ${item.key} <= ${item.fileName}`);
    }
  }

  console.log(
    `${options.dryRun ? "Dry-run completed" : "Reindex completed"}: totalRecovered=${totalRecovered}`,
  );
}

main();
