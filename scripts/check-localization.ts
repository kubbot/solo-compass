#!/usr/bin/env tsx
/**
 * US-015: Localization key consistency check.
 * Scans .swift files for NSLocalizedString("key", ...) calls, then verifies
 * each key exists in en.lproj/Localizable.strings. Exits non-zero with a
 * list of missing keys.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const SWIFT_DIR = join(__dirname, "../apps/ios/SoloCompass");
const STRINGS_FILE = join(
  SWIFT_DIR,
  "Resources/en.lproj/Localizable.strings"
);

function walkSwiftFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkSwiftFiles(full));
    } else if (extname(full) === ".swift") {
      results.push(full);
    }
  }
  return results;
}

function extractKeys(source: string): string[] {
  // Match NSLocalizedString("key", ...) — literal string keys only.
  // Skip interpolated keys (those containing backslash-paren sequences
  // like "category.\(rawValue)") since they can't be statically resolved.
  const pattern = /NSLocalizedString\(\s*"([^"]+)"/g;
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const key = match[1];
    // Skip Swift string interpolation markers
    if (key.includes("\\(")) continue;
    keys.push(key);
  }
  return keys;
}

function parseStringsFile(content: string): Set<string> {
  const keys = new Set<string>();
  // Match "key" = "value"; lines (handles multi-line values poorly, but
  // en.lproj uses single-line values so this is fine).
  const pattern = /^"([^"]+)"\s*=/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

// Collect all keys from Swift source
const swiftFiles = walkSwiftFiles(SWIFT_DIR);
const allKeys = new Map<string, string[]>(); // key → [file, ...]

for (const file of swiftFiles) {
  const source = readFileSync(file, "utf8");
  const keys = extractKeys(source);
  for (const key of keys) {
    const existing = allKeys.get(key) ?? [];
    existing.push(file.replace(SWIFT_DIR + "/", ""));
    allKeys.set(key, existing);
  }
}

// Parse en.lproj
const stringsContent = readFileSync(STRINGS_FILE, "utf8");
const definedKeys = parseStringsFile(stringsContent);

// Find missing keys
const missing: Array<{ key: string; files: string[] }> = [];
for (const [key, files] of allKeys) {
  if (!definedKeys.has(key)) {
    missing.push({ key, files });
  }
}

if (missing.length === 0) {
  console.log(
    `✅ All ${allKeys.size} NSLocalizedString keys found in en.lproj/Localizable.strings`
  );
  process.exit(0);
} else {
  console.error(
    `❌ ${missing.length} missing key(s) in en.lproj/Localizable.strings:\n`
  );
  for (const { key, files } of missing) {
    console.error(`  "${key}"`);
    for (const f of files) {
      console.error(`    → ${f}`);
    }
  }
  process.exit(1);
}
