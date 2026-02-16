import { safeStorage } from "electron";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { configLog } from "../../lib/logger";

export class EncryptedCache {
  private cache: Record<string, Buffer> = {};

  constructor(private readonly cachePath: string) {}

  async load(): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) return;
    if (!existsSync(this.cachePath)) return;
    try {
      const raw = await readFile(this.cachePath);
      const parsed: unknown = JSON.parse(raw.toString("utf-8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === "string") {
            this.cache[key] = Buffer.from(value, "base64");
          }
        }
      }
    } catch {
      configLog.debug("[credential.enc-cache.load.skipped]");
    }
  }

  async set(key: string, plaintext: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) return;
    this.cache[key] = safeStorage.encryptString(plaintext);
    await this.save();
  }

  private async save(): Promise<void> {
    const dir = dirname(this.cachePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const serialized: Record<string, string> = {};
    for (const [key, buf] of Object.entries(this.cache)) {
      serialized[key] = buf.toString("base64");
    }
    await writeFile(this.cachePath, JSON.stringify(serialized, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  }
}
