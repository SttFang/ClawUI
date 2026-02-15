#!/usr/bin/env bun
/**
 * ClawUI ↔ OpenClaw 配置对齐审计脚本
 *
 * 从两边源码提取 channel/model 配置，对比并输出差异报告。
 * 用法: bun scripts/audit-openclaw-alignment.ts
 */

import { resolve, dirname } from "node:path";

const ROOT = dirname(dirname(import.meta.path));
const OPENCLAW = resolve(ROOT, "../openclaw");

// ── helpers ──────────────────────────────────────────────────────────

async function readSource(path: string): Promise<string> {
  try {
    return await Bun.file(path).text();
  } catch {
    throw new Error(`无法读取: ${path}`);
  }
}

/** Extract string literals from a TS array like `["a", "b"]` */
function extractArrayStrings(src: string, arrayName: string): string[] {
  const re = new RegExp(`${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\]`, "m");
  const m = src.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
}

/** Extract union string literals: `"a" | "b" | "c"` */
function extractUnionStrings(src: string, typeName: string): string[] {
  const re = new RegExp(`type\\s+${typeName}\\s*=[\\s\\S]*?;`, "m");
  const m = src.match(re);
  if (!m) return [];
  return [...m[0].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
}

/** Extract `type: "xxx"` values from a defaultChannels-style array */
function extractTypeFields(src: string): string[] {
  return [...src.matchAll(/type:\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Extract `channelType: "xxx"` values */
function extractChannelTypeFields(src: string): string[] {
  return [...src.matchAll(/channelType:\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Extract interface/type field names: `fieldName: Type` or `fieldName?: Type` */
function extractTypeFieldNames(src: string, typeName: string): string[] {
  // Match `type X = { ... }` or `export type X = { ... }` (object literal style)
  const typeRe = new RegExp(`(?:export\\s+)?type\\s+${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\};`, "m");
  // Match `interface X { ... }` or `export interface X { ... }`
  const ifaceRe = new RegExp(`(?:export\\s+)?interface\\s+${typeName}\\s*\\{([\\s\\S]*?)\\}`, "m");

  const m = src.match(typeRe) || src.match(ifaceRe);
  if (!m) return [];

  return [...m[1].matchAll(/^\s*(\w+)\s*[?:]?\s*:/gm)].map((x) => x[1]);
}

/** Extract TypeBox schema field names: `fieldName: Type.xxx(...)` */
function extractTypeBoxFields(src: string, schemaName: string): string[] {
  const re = new RegExp(`${schemaName}\\s*=\\s*Type\\.Object\\(\\s*\\{([\\s\\S]*?)\\}\\s*,`, "m");
  const m = src.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/^\s*(\w+)\s*:/gm)].map((x) => x[1]);
}

/** Extract sensitive fields from a zod schema (fields with `.register(sensitive)`) */
function extractSensitiveFields(
  src: string,
  schemaName: string,
): { channel: string; fields: string[] } | null {
  const re = new RegExp(
    `${schemaName}\\s*=\\s*z\\s*\\.object\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`,
    "m",
  );
  const m = src.match(re);
  if (!m) return null;

  const body = m[1];
  // Fields that have `.register(sensitive)` or are semantically credentials
  // We look for named fields like `botToken`, `token`, `password`, `appToken` etc.
  const credentialPatterns =
    /^\s*(botToken|token|appToken|userToken|signingSecret|password|account|authDir|serviceAccountFile|appPassword)\s*:/gm;
  const fields = [...body.matchAll(credentialPatterns)].map((x) => x[1]);
  return { channel: schemaName, fields };
}

function setDiff(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((x) => !setB.has(x));
}

// ── color helpers ────────────────────────────────────────────────────

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  let deviations = 0;
  let aligned = 0;

  console.log(bold("\n═══════════════════════════════════════════"));
  console.log(bold("  ClawUI ↔ OpenClaw 配置对齐审计报告"));
  console.log(bold("═══════════════════════════════════════════\n"));

  // ── [1] Channel 列表对齐 ──

  const registrySrc = await readSource(resolve(OPENCLAW, "src/channels/registry.ts"));
  const typesSrc = await readSource(resolve(ROOT, "src/store/channels/types.ts"));
  const defaultSrc = await readSource(resolve(ROOT, "src/store/channels/defaultChannels.ts"));

  const ocChannels = extractArrayStrings(registrySrc, "CHAT_CHANNEL_ORDER");
  const cuSupportedTypes = extractUnionStrings(typesSrc, "SupportedChannelType");
  const cuDefaults = extractTypeFields(defaultSrc);

  console.log(bold("[1] Channel 列表对齐"));
  console.log("────────────────────");
  console.log(`OpenClaw CHAT_CHANNEL_ORDER:  ${ocChannels.join(", ")}`);
  console.log(`ClawUI SupportedChannelType:  ${cuSupportedTypes.join(", ")}`);
  console.log(`ClawUI defaultChannels:       ${cuDefaults.join(", ")}`);
  console.log();

  const ghostChannels = setDiff(cuSupportedTypes, ocChannels);
  const missingChannels = setDiff(ocChannels, cuSupportedTypes);

  if (ghostChannels.length) {
    console.log(yellow(`⚠ ClawUI 独有（幽灵 channel）: ${ghostChannels.join(", ")}`));
    deviations++;
  }
  if (missingChannels.length) {
    console.log(yellow(`⚠ OpenClaw 独有（ClawUI 缺失）: ${missingChannels.join(", ")}`));
    deviations++;
  }
  if (!ghostChannels.length && !missingChannels.length) {
    console.log(green("✅ Channel 列表完全对齐"));
    aligned++;
  }
  console.log();

  // ── [2] Channel Token 字段对齐 ──

  const messagingTabSrc = await readSource(resolve(ROOT, "src/routes/settings/MessagingTab.tsx"));
  const providerCoreSrc = await readSource(
    resolve(OPENCLAW, "src/config/zod-schema.providers-core.ts"),
  );
  const providerWhatsappSrc = await readSource(
    resolve(OPENCLAW, "src/config/zod-schema.providers-whatsapp.ts"),
  );

  const cuChannelDefs = extractChannelTypeFields(messagingTabSrc);

  // Map channel → sensitive fields from OpenClaw schemas
  const channelSchemaMap: Record<string, string> = {
    telegram: "TelegramAccountSchemaBase",
    discord: "DiscordAccountSchema",
    slack: "SlackAccountSchema",
    signal: "SignalAccountSchemaBase",
    irc: "IrcAccountSchemaBase",
    googlechat: "GoogleChatAccountSchema",
    imessage: "IMessageAccountSchemaBase",
  };

  // Manually map known token fields per channel from OpenClaw source
  const ocTokenFields: Record<string, string[]> = {
    telegram: ["botToken"],
    discord: ["token"],
    slack: ["botToken", "appToken", "userToken", "signingSecret"],
    signal: ["account"],
    whatsapp: ["authDir"],
    irc: ["password"],
    googlechat: ["serviceAccountFile"],
    imessage: [], // no token field
  };

  // ClawUI CHANNEL_DEFS field mapping
  const cuTokenFields: Record<string, string[]> = {};
  const channelDefsRe = /\{\s*channelType:\s*["'](\w+)["'][\s\S]*?fields:\s*\[([\s\S]*?)\]/g;
  for (const m of messagingTabSrc.matchAll(channelDefsRe)) {
    const ch = m[1];
    const fields = [...m[2].matchAll(/field:\s*["'](\w+)["']/g)].map((x) => x[1]);
    cuTokenFields[ch] = fields;
  }

  console.log(bold("[2] Channel Token 字段对齐 (MessagingTab CHANNEL_DEFS)"));
  console.log("──────────────────────────────────────────────────────");

  const allTokenChannels = new Set([...Object.keys(ocTokenFields), ...Object.keys(cuTokenFields)]);

  for (const ch of allTokenChannels) {
    const oc = ocTokenFields[ch] ?? [];
    const cu = cuTokenFields[ch] ?? [];

    if (oc.length === 0 && cu.length === 0) {
      console.log(dim(`   ${ch}: 两侧均无 token 字段`));
      continue;
    }

    const cuSet = new Set(cu);
    const missing = oc.filter((f) => !cuSet.has(f));

    if (!cuTokenFields[ch]) {
      console.log(yellow(`⚠  ${ch}:  未在 CHANNEL_DEFS 中定义`));
      deviations++;
    } else if (missing.length) {
      console.log(yellow(`⚠  ${ch}:  缺失字段 ${missing.join(", ")} (已有: ${cu.join(", ")})`));
      deviations++;
    } else {
      console.log(green(`✅ ${ch}:  ${cu.join(", ")} ← 已覆盖`));
      aligned++;
    }
  }
  console.log();

  // ── [3] Model 类型字段对齐 ──

  const ocModelCatalogSrc = await readSource(resolve(OPENCLAW, "src/agents/model-catalog.ts"));
  const ocListTypesSrc = await readSource(resolve(OPENCLAW, "src/commands/models/list.types.ts"));
  const ocGatewaySrc = await readSource(
    resolve(OPENCLAW, "src/gateway/protocol/schema/agents-models-skills.ts"),
  );
  const cuModelsSrc = await readSource(resolve(ROOT, "packages/types/src/models.ts"));

  const ocCatalogFields = extractTypeFieldNames(ocModelCatalogSrc, "ModelCatalogEntry");
  const ocModelRowFields = extractTypeFieldNames(ocListTypesSrc, "ModelRow");
  const ocModelChoiceFields = extractTypeBoxFields(ocGatewaySrc, "ModelChoiceSchema");
  const cuModelFields = extractTypeFieldNames(cuModelsSrc, "ModelCatalogEntry");

  console.log(bold("[3] Model 类型字段对齐 (ClawUI ModelCatalogEntry vs OpenClaw)"));
  console.log("────────────────────────────────────────────────────────────");

  // Compare with ModelRow
  console.log(dim("\n对比 OpenClaw ModelRow (CLI --json 输出):"));
  const cuFieldSet = new Set(cuModelFields);
  for (const f of ocModelRowFields) {
    if (cuFieldSet.has(f)) {
      console.log(green(`  ✅ ${f.padEnd(16)} → ClawUI: ${f} ✓`));
      aligned++;
    } else {
      console.log(yellow(`  ⚠  ${f.padEnd(16)} → ClawUI: 缺失`));
      deviations++;
    }
  }

  // Compare with OpenClaw ModelCatalogEntry
  console.log(dim("\n对比 OpenClaw ModelCatalogEntry (内部类型):"));
  for (const f of ocCatalogFields) {
    if (cuFieldSet.has(f)) {
      // Check type compatibility for known mismatches
      if (f === "input") {
        // ClawUI uses `string` matching CLI ModelRow output; internal type is Array — this is OK.
        console.log(
          dim(
            `  ℹ  ${f.padEnd(16)} → ClawUI: string (matches CLI ModelRow), OpenClaw internal: Array<"text"|"image">`,
          ),
        );
        aligned++;
      } else {
        console.log(green(`  ✅ ${f.padEnd(16)} → ClawUI: ${f} ✓`));
        aligned++;
      }
    } else {
      console.log(yellow(`  ⚠  ${f.padEnd(16)} → ClawUI: 缺失`));
      deviations++;
    }
  }

  // Compare with ModelChoiceSchema
  console.log(dim("\n对比 OpenClaw ModelChoiceSchema (Gateway API):"));
  for (const f of ocModelChoiceFields) {
    if (cuFieldSet.has(f)) {
      console.log(green(`  ✅ ${f.padEnd(16)} → ClawUI: ${f} ✓`));
      aligned++;
    } else {
      console.log(yellow(`  ⚠  ${f.padEnd(16)} → ClawUI: 缺失`));
      deviations++;
    }
  }

  // ── Summary ──

  console.log(bold("\n═══════════════════════════════════════════"));
  console.log(bold(`  总结: ${aligned} 项对齐, ${deviations} 项偏差`));
  console.log(bold("═══════════════════════════════════════════\n"));

  process.exit(deviations > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("审计脚本失败:", err);
  process.exit(2);
});
