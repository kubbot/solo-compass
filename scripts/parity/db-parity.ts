/**
 * DB schema parity guard — compares the Drizzle `experiences` table definition
 * against the `Experience` interface in packages/core/src/experience.ts.
 *
 * Strategy:
 *   - Parse the Drizzle schema with ts-morph to extract column property names
 *     from the pgTable() call in packages/db/src/schema/experiences.ts.
 *   - Parse the Experience interface from packages/core with ts-morph.
 *   - Map each Experience field to its expected Drizzle column property name.
 *   - Report Experience fields that have no corresponding DB column.
 *   - Report DB columns that have no corresponding Experience field (unless
 *     whitelisted as DB-internal).
 */

import { Project, SyntaxKind } from "ts-morph";
import path from "node:path";

export interface DbParityMismatch {
  field: string;
  dbColumn: string;
  issue: "missing_in_db" | "missing_in_core";
}

export interface DbParityResult {
  mismatches: DbParityMismatch[];
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Columns intentionally present in the DB but absent from Experience core
// ---------------------------------------------------------------------------
const DB_ONLY_COLUMNS = new Set([
  // Populated by migration triggers; not part of the application domain shape.
  "lastCompiledAt",
]);

// ---------------------------------------------------------------------------
// Mapping from Experience field name → Drizzle column property name (camelCase)
//
// Fields mapped to `null` are intentionally excluded from the direct check —
// they are either stored differently (flattened) or in a separate table.
// For each null-mapped field, add an entry to EXTRA_DB_COLUMNS below to
// assert the replacement column(s) exist.
// ---------------------------------------------------------------------------
const FIELD_TO_COLUMN: Record<string, string | null> = {
  // confidence { level, ... } is stored as a single integer column
  confidence: "confidenceLevel",

  // durationMinutes { min, max } is flattened into two integer columns
  durationMinutes: null,

  // stats { completionCount, averageRating, lastCompletedAt } are separate columns
  stats: null,

  // nearbyExperienceIds is stored in a join table, not the main experiences table
  nearbyExperienceIds: null,

  // Complex JSONB blobs — stored in dedicated tables (sources, revisions) or
  // separate columns added in later migrations.  Marked null here and expected
  // via EXTRA_DB_COLUMNS.
  bestTimes: null,
  howTo: null,
  realInconveniences: null,
  soloScore: null,
  sources: null,
};

/**
 * DB columns that satisfy Experience fields mapped to null above.
 * Their presence is asserted independently of the field-to-column map.
 */
const EXTRA_DB_COLUMNS: Array<{ dbColumn: string; satisfies: string }> = [
  // confidence maps to confidenceLevel already in FIELD_TO_COLUMN (not null)
  // durationMinutes splits into:
  { dbColumn: "durationMin", satisfies: "Experience.durationMinutes.min" },
  { dbColumn: "durationMax", satisfies: "Experience.durationMinutes.max" },
  // stats sub-fields:
  { dbColumn: "completionCount", satisfies: "Experience.stats.completionCount" },
  { dbColumn: "averageRating", satisfies: "Experience.stats.averageRating" },
  // JSONB blobs for complex nested shapes:
  { dbColumn: "bestTimes", satisfies: "Experience.bestTimes (jsonb)" },
  { dbColumn: "howTo", satisfies: "Experience.howTo (jsonb)" },
  { dbColumn: "realInconveniences", satisfies: "Experience.realInconveniences (jsonb)" },
  { dbColumn: "soloScore", satisfies: "Experience.soloScore (jsonb)" },
  { dbColumn: "sources", satisfies: "Experience.sources (jsonb)" },
];

// ---------------------------------------------------------------------------
// Extract column property names from the Drizzle pgTable() call
// ---------------------------------------------------------------------------
function extractDrizzleColumns(rootDir: string): Set<string> {
  const project = new Project({
    tsConfigFilePath: path.join(rootDir, "packages/db/tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  const schemaPath = path.join(rootDir, "packages/db/src/schema/experiences.ts");
  const sourceFile = project.addSourceFileAtPath(schemaPath);

  const columns = new Set<string>();

  for (const varDecl of sourceFile.getVariableDeclarations()) {
    const init = varDecl.getInitializer();
    if (!init) continue;

    // Find the pgTable("experiences", { ... }) call
    const callExpr = init.asKind(SyntaxKind.CallExpression);
    if (!callExpr) continue;

    const callText = callExpr.getExpression().getText();
    if (callText !== "pgTable") continue;

    const args = callExpr.getArguments();
    // First arg is the table name string literal
    const tableNameArg = args[0];
    if (!tableNameArg) continue;
    const tableName = tableNameArg.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
    if (tableName !== "experiences") continue;

    // Second arg is the columns object literal
    const columnArg = args[1];
    if (!columnArg) continue;

    const objLiteral = columnArg.asKind(SyntaxKind.ObjectLiteralExpression);
    if (!objLiteral) continue;

    for (const prop of objLiteral.getProperties()) {
      const propAssignment = prop.asKind(SyntaxKind.PropertyAssignment);
      if (propAssignment) {
        // Strip surrounding quotes if the name was written as a string literal
        const name = propAssignment.getName().replace(/^["']|["']$/g, "");
        columns.add(name);
      }
    }
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Extract Experience field names from packages/core
// ---------------------------------------------------------------------------
function extractExperienceFields(rootDir: string): string[] {
  const project = new Project({
    tsConfigFilePath: path.join(rootDir, "packages/core/tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  const corePath = path.join(rootDir, "packages/core/src/experience.ts");
  project.addSourceFileAtPath(corePath);
  project.resolveSourceFileDependencies();

  const sourceFile = project.getSourceFileOrThrow(corePath);
  const iface = sourceFile.getInterfaceOrThrow("Experience");
  return iface.getProperties().map((p) => p.getName());
}

// ---------------------------------------------------------------------------
// Main check
// ---------------------------------------------------------------------------
export function checkDbParity(rootDir: string, verbose: boolean): DbParityResult {
  let dbColumns: Set<string>;
  try {
    dbColumns = extractDrizzleColumns(rootDir);
  } catch (err) {
    throw new Error(
      `Failed to parse Drizzle schema: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (dbColumns.size === 0) {
    throw new Error(
      'No columns extracted from experiences table — check packages/db/src/schema/experiences.ts',
    );
  }

  let experienceFields: string[];
  try {
    experienceFields = extractExperienceFields(rootDir);
  } catch (err) {
    throw new Error(
      `Failed to parse Experience interface: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (verbose) {
    console.log(`   DB columns (${dbColumns.size}): ${[...dbColumns].join(", ")}`);
    console.log(`   Experience fields (${experienceFields.length}): ${experienceFields.join(", ")}`);
  }

  const mismatches: DbParityMismatch[] = [];
  const accountedDbColumns = new Set<string>();

  // Check every Experience field maps to a present DB column
  for (const field of experienceFields) {
    const hasOverride = Object.prototype.hasOwnProperty.call(FIELD_TO_COLUMN, field);
    const mapped: string | null | undefined = hasOverride ? FIELD_TO_COLUMN[field] : field;

    if (mapped === null) {
      // Intentionally excluded — covered by EXTRA_DB_COLUMNS assertions below
      continue;
    }

    const expectedColumn = mapped ?? field;

    if (!dbColumns.has(expectedColumn)) {
      mismatches.push({ field, dbColumn: expectedColumn, issue: "missing_in_db" });
    } else {
      accountedDbColumns.add(expectedColumn);
    }
  }

  // Assert that columns satisfying null-mapped fields are present
  for (const { dbColumn, satisfies } of EXTRA_DB_COLUMNS) {
    if (!dbColumns.has(dbColumn)) {
      mismatches.push({ field: satisfies, dbColumn, issue: "missing_in_db" });
    } else {
      accountedDbColumns.add(dbColumn);
    }
  }

  // Flag DB columns that have no corresponding Experience field or known override
  for (const col of dbColumns) {
    if (DB_ONLY_COLUMNS.has(col)) continue;
    if (accountedDbColumns.has(col)) continue;
    mismatches.push({ field: "(absent in core)", dbColumn: col, issue: "missing_in_core" });
  }

  return { mismatches, ok: mismatches.length === 0 };
}

export function formatDbParityReport(result: DbParityResult): string {
  if (result.ok) {
    return "✅  TS↔DB schema parity: Drizzle experiences table matches Experience core type.\n";
  }

  const lines: string[] = ["❌  TS↔DB schema parity FAILED\n"];

  const missingInDb = result.mismatches.filter((m) => m.issue === "missing_in_db");
  const missingInCore = result.mismatches.filter((m) => m.issue === "missing_in_core");

  if (missingInDb.length > 0) {
    lines.push("Experience fields missing from Drizzle schema (experiences table):");
    for (const m of missingInDb) {
      lines.push(`  • ${m.field}  →  expected column: ${m.dbColumn}`);
    }
    lines.push("");
  }

  if (missingInCore.length > 0) {
    lines.push("Drizzle columns with no corresponding Experience field:");
    for (const m of missingInCore) {
      lines.push(`  • column: ${m.dbColumn}  [add to DB_ONLY_COLUMNS or FIELD_TO_COLUMN if intentional]`);
    }
    lines.push("");
  }

  lines.push(
    "Fix: add missing columns to packages/db/src/schema/experiences.ts,\n" +
    "  or update FIELD_TO_COLUMN / DB_ONLY_COLUMNS in scripts/parity/db-parity.ts.",
  );
  return lines.join("\n");
}
