import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { formatBytes, projectTreeString } from "./path-utils.js";
import type { FileNode, FileStats, ProjectSnapshot, SourceSampleMeta } from "../types/index.js";

// ─── Scanner configuration ────────────────────────────────────────────────────

const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__", "target",
  "vendor", ".turbo", ".cache", "coverage", ".nyc_output", "out", ".svelte-kit",
  "venv", ".venv", "env", ".env", ".expo", "android", "ios",
]);

const CONFIG_FILE_NAMES = new Set([
  "package.json", "tsconfig.json", "tsconfig.base.json", "jsconfig.json",
  "docker-compose.yml", "docker-compose.yaml", "Dockerfile", "Makefile",
  "pyproject.toml", "setup.py", "setup.cfg", "requirements.txt",
  "Cargo.toml", "Cargo.lock", "go.mod", "go.sum", "pom.xml",
  "build.gradle", "build.gradle.kts", ".eslintrc.json", ".eslintrc.js",
  ".eslintrc.cjs", "eslint.config.js", "eslint.config.mjs", ".prettierrc",
  ".prettierrc.json", "prettier.config.js", "vite.config.ts", "vite.config.js",
  "webpack.config.js", "webpack.config.ts", "next.config.js", "next.config.ts",
  "nuxt.config.ts", "svelte.config.js", "tailwind.config.js", "tailwind.config.ts",
  "jest.config.js", "jest.config.ts", "vitest.config.ts", ".babelrc",
  "babel.config.js", "babel.config.json", ".env.example", "compose.yml",
  "compose.yaml", "kubernetes.yaml", "k8s.yaml", "app.config.ts", "app.config.js",
]);

const DEP_FILE_NAMES = new Set([
  "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "bun.lockb", "requirements.txt", "Pipfile", "pyproject.toml",
  "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts",
  "Gemfile", "composer.json",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs", ".py", ".go",
  ".rs", ".java", ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp",
  ".swift", ".kt", ".scala", ".vue", ".svelte", ".astro",
]);

const ENTRY_POINT_STEMS = [
  "index", "main", "app", "server", "cli", "start", "entry",
];

const TS_JS_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs"]);
const JVM_EXTS   = new Set([".java", ".kt"]);

const CONFIG_FILE_CAP     = 8 * 1024;   // 8 KB — for config/dep files
const P1_FULL_CAP         = 4 * 1024;   // 4 KB — P1 files read fully below this
const CONTEXT_BUDGET_BYTES = 200_000;   // 200 KB — total source samples budget
const MAX_TEST_FILES      = 3;
const MAX_DEPTH           = 8;

// ─── Priority classifier ──────────────────────────────────────────────────────

/**
 * Classifies a source file into a priority tier:
 *   P0 — always include fully: migrations, schemas, architecture docs
 *   P1 — prefer full read: controllers, services, auth, middleware, store/context
 *   P2 — skeletal read only: all other source files
 */
function classifyFilePriority(filePath: string): 0 | 1 | 2 {
  const name     = path.basename(filePath);
  const nameLower = name.toLowerCase();
  const stem     = nameLower.replace(/\.[^.]+$/, "");
  const dirLower = filePath.toLowerCase();

  // ── P0: schemas, migrations, architecture docs ────────────────────────────
  if (
    stem.startsWith("readme") ||
    stem.startsWith("architecture") ||
    stem.startsWith("adr") ||
    stem.startsWith("decisions") ||
    stem.startsWith("changelog") ||
    nameLower === "schema.prisma" ||
    nameLower.endsWith(".sql") ||
    nameLower.includes(".migration.") ||
    nameLower.includes(".migrate.") ||
    dirLower.includes("/migration/") ||
    dirLower.includes("/migrations/") ||
    dirLower.includes("/flyway/")
  ) {
    return 0;
  }

  // ── P1: core logic files ──────────────────────────────────────────────────
  if (
    /resource|controller|router|handler|route|resolver/.test(nameLower) ||
    /service|repository|store|manager/.test(nameLower) ||
    /auth|security|jwt|middleware|guard|context|provider/.test(nameLower)
  ) {
    return 1;
  }

  return 2;
}

function isTestFile(filePath: string): boolean {
  const nameLower = path.basename(filePath).toLowerCase();
  return (
    /\.(spec|test)\.[^.]+$/.test(nameLower) ||
    nameLower.includes(".e2e.") ||
    filePath.includes("/__tests__/") ||
    filePath.includes("/test/") ||
    filePath.includes("/tests/") ||
    filePath.includes("/spec/")
  );
}

// ─── Skeletal reading ─────────────────────────────────────────────────────────

const SKELETON_HEADER = "// [SKELETON] Full file not shown. Structural summary only.";

/**
 * Extracts the structural skeleton of a source file.
 * P0 files are never skeleton'd. Used for P1 files > 4KB and all P2 files.
 */
export function extractSkeleton(content: string, filePath: string): string {
  const ext   = path.extname(filePath).toLowerCase();
  const lines = content.split("\n");

  // SQL files: always structural, never need skeletonizing
  if (ext === ".sql") return content;

  if (JVM_EXTS.has(ext))   return extractJvmSkeleton(lines);
  if (TS_JS_EXTS.has(ext)) return extractTsSkeleton(lines);

  // Default: first 20 lines + last 5
  const head = lines.slice(0, 20);
  const tail = lines.slice(-5);
  const body = lines.length > 25 ? [...head, "// ...", ...tail] : lines;
  return [SKELETON_HEADER, ...body].join("\n");
}

/** Java / Kotlin skeleton: package, imports (max 10), class declaration, member signatures. */
function extractJvmSkeleton(lines: string[]): string {
  const result: string[] = [SKELETON_HEADER];
  let importCount = 0;
  let braceDepth  = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const opens   = (line.match(/\{/g) ?? []).length;
    const closes  = (line.match(/\}/g) ?? []).length;
    const prevDepth = braceDepth;
    braceDepth += opens - closes;

    // Package declaration
    if (prevDepth === 0 && trimmed.startsWith("package ")) {
      result.push(line);
      continue;
    }

    // Import statements (max 10)
    if (prevDepth === 0 && trimmed.startsWith("import ")) {
      if (importCount < 10)       result.push(line);
      else if (importCount === 10) result.push("// ... (more imports)");
      importCount++;
      continue;
    }

    // Depth 0: top-level annotations and class/interface/enum declarations
    if (prevDepth === 0) {
      if (
        trimmed.startsWith("@") ||
        /\b(class|interface|enum|record|@interface)\b/.test(trimmed)
      ) {
        result.push(line);
      }
      continue;
    }

    // Depth 1: inside the class body — show signatures, skip method bodies
    if (prevDepth === 1) {
      if (trimmed.startsWith("@")) {
        result.push(line);
        continue;
      }

      const isMember =
        /\b(public|private|protected|static|final|abstract|synchronized|override|native|default)\b/.test(trimmed) ||
        /^\w[\w<>\[\].,\s]+\s+\w+\s*[({;]/.test(trimmed);

      if (isMember) {
        if (opens > 0 && braceDepth > 1) {
          // Method with body — show just the signature line
          const braceIdx = line.indexOf("{");
          result.push(line.substring(0, braceIdx).trimEnd() + " { ... }");
        } else {
          result.push(line);
        }
        continue;
      }

      // Closing brace of the class body
      if (trimmed === "}" || trimmed === "};") {
        result.push(line);
      }
    }
  }

  return result.join("\n");
}

/** TypeScript / JavaScript skeleton: imports (max 10), top-level exports, interface/type definitions. */
function extractTsSkeleton(lines: string[]): string {
  const result: string[] = [SKELETON_HEADER];
  let importCount  = 0;
  let inTypeBlock  = false;
  let typeDepth    = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent  = line.length - line.trimStart().length;
    const opens   = (line.match(/\{/g) ?? []).length;
    const closes  = (line.match(/\}/g) ?? []).length;

    // ── Inside an interface/type block: include fully ─────────────────────
    if (inTypeBlock) {
      result.push(line);
      typeDepth += opens - closes;
      if (typeDepth <= 0) inTypeBlock = false;
      continue;
    }

    // ── Only consider top-level lines (no indentation) ────────────────────
    // Exception: allow tabs or 0 spaces to handle files using tabs
    if (indent > 0) continue;

    // Import statements (max 10)
    if (trimmed.startsWith("import ")) {
      if (importCount < 10)        result.push(line);
      else if (importCount === 10) result.push("// ... (more imports)");
      importCount++;
      continue;
    }

    // Interface / type blocks: include the whole block
    if (/^(export\s+)?(interface|type)\s/.test(trimmed)) {
      if (trimmed.includes("{")) {
        inTypeBlock = true;
        typeDepth   = opens - closes;
        result.push(line);
        if (typeDepth <= 0) inTypeBlock = false;
      } else {
        // Single-line type alias: type Foo = string;
        result.push(line);
      }
      continue;
    }

    // Top-level declarations: show signature only (no body)
    const isTopLevel =
      trimmed.startsWith("export ") ||
      trimmed.startsWith("class ")  ||
      trimmed.startsWith("abstract class ") ||
      trimmed.startsWith("function ") ||
      trimmed.startsWith("async function ") ||
      trimmed.startsWith("const ")  ||
      trimmed.startsWith("let ")    ||
      trimmed.startsWith("@");

    if (isTopLevel) {
      const braceIdx = line.indexOf("{");
      if (braceIdx >= 0) {
        result.push(line.substring(0, braceIdx).trimEnd() + " { ... }");
      } else {
        result.push(line);
      }
    }
  }

  return result.join("\n");
}

// ─── Scan functions ───────────────────────────────────────────────────────────

async function walkDirectory(
  dirPath: string,
  depth = 0,
  allFiles: Array<{ path: string; size: number; ext: string }> = []
): Promise<FileNode> {
  const name = path.basename(dirPath);
  const node: FileNode = { name, path: dirPath, type: "dir", children: [] };

  if (depth > MAX_DEPTH) return node;

  let entries: Dirent<string>[];
  try {
    entries = (await fs.readdir(dirPath, { withFileTypes: true })) as Dirent<string>[];
  } catch {
    return node;
  }

  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const child = await walkDirectory(
        path.join(dirPath, entry.name),
        depth + 1,
        allFiles
      );
      node.children!.push(child);
    } else if (entry.isFile()) {
      const filePath = path.join(dirPath, entry.name);
      let size = 0;
      try {
        const stat = await fs.stat(filePath);
        size = stat.size;
      } catch {}
      const ext = path.extname(entry.name).toLowerCase();
      allFiles.push({ path: filePath, size, ext });
      node.children!.push({ name: entry.name, path: filePath, type: "file", size });
    }
  }

  return node;
}

function collectFileStats(
  allFiles: Array<{ path: string; size: number; ext: string }>
): FileStats {
  const byExtension: Record<string, number> = {};
  let totalBytes = 0;

  for (const f of allFiles) {
    totalBytes += f.size;
    const key = f.ext || "(no extension)";
    byExtension[key] = (byExtension[key] ?? 0) + 1;
  }

  const largestFiles = [...allFiles]
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map((f) => ({ path: f.path, size: f.size }));

  return { totalFiles: allFiles.length, totalBytes, byExtension, largestFiles };
}

async function readConfigFiles(
  allFiles: Array<{ path: string; size: number; ext: string }>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const f of allFiles) {
    if (!CONFIG_FILE_NAMES.has(path.basename(f.path))) continue;
    try {
      const raw = await fs.readFile(f.path, "utf8");
      result[f.path] = raw.slice(0, CONFIG_FILE_CAP);
    } catch {}
  }
  return result;
}

async function readDepFiles(
  allFiles: Array<{ path: string; size: number; ext: string }>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const f of allFiles) {
    if (!DEP_FILE_NAMES.has(path.basename(f.path))) continue;
    try {
      const raw = await fs.readFile(f.path, "utf8");
      result[f.path] = raw.slice(0, CONFIG_FILE_CAP);
    } catch {}
  }
  return result;
}

function detectEntryPoints(
  allFiles: Array<{ path: string; size: number; ext: string }>
): string[] {
  return allFiles
    .filter((f) => {
      const stem = path.basename(f.path, path.extname(f.path)).toLowerCase();
      return ENTRY_POINT_STEMS.includes(stem) && SOURCE_EXTENSIONS.has(f.ext);
    })
    .map((f) => f.path)
    .slice(0, 8);
}

async function sampleSourceFiles(
  allFiles: Array<{ path: string; size: number; ext: string }>
): Promise<{ samples: Record<string, string>; meta: SourceSampleMeta }> {
  const sourceFiles = allFiles.filter((f) => SOURCE_EXTENSIONS.has(f.ext));

  // Partition by priority
  const p0Files   = sourceFiles.filter((f) => classifyFilePriority(f.path) === 0);
  const p1All     = sourceFiles.filter((f) => classifyFilePriority(f.path) === 1);
  const p2All     = sourceFiles.filter((f) => classifyFilePriority(f.path) === 2);

  // P1: test files capped, non-test first
  const p1NonTest = p1All.filter((f) => !isTestFile(f.path));
  const p1Tests   = p1All.filter((f) =>  isTestFile(f.path));

  // P2: sorted by size descending so larger (more substantial) files go first
  const p2Sorted  = [...p2All].sort((a, b) => b.size - a.size);

  // Process in priority order: P0 → P1 non-test → P1 test (capped) → P2
  const ordered = [...p0Files, ...p1NonTest, ...p1Tests, ...p2Sorted];

  const samples: Record<string, string> = {};
  let budgetUsed  = 0;
  let testCount   = 0;
  let p0Count = 0, p1Count = 0, p2Count = 0;
  let fullCount = 0, skeletalCount = 0;

  for (const f of ordered) {
    // Stop once budget is fully exhausted
    if (budgetUsed >= CONTEXT_BUDGET_BYTES) break;

    // Enforce global test-file cap
    if (isTestFile(f.path)) {
      if (testCount >= MAX_TEST_FILES) continue;
      testCount++;
    }

    const priority = classifyFilePriority(f.path);

    try {
      const raw = await fs.readFile(f.path, "utf8");
      let content: string;
      let skeletal: boolean;

      if (priority === 0) {
        // P0: always read fully — migrations, schemas, architecture docs must never be truncated
        content  = raw;
        skeletal = false;
      } else if (priority === 1 && raw.length <= P1_FULL_CAP) {
        // P1 small: read fully (skeleton of a 2KB file adds no value)
        content  = raw;
        skeletal = false;
      } else {
        // P1 large or P2: skeletal reading
        content  = extractSkeleton(raw, f.path);
        skeletal = true;
      }

      // Skip if this file alone would exceed the remaining budget
      // (only applies when we already have content; never skip P0)
      if (priority > 0 && budgetUsed + content.length > CONTEXT_BUDGET_BYTES) continue;

      samples[f.path] = content;
      budgetUsed += content.length;

      if (skeletal) skeletalCount++; else fullCount++;
      if (priority === 0) p0Count++;
      else if (priority === 1) p1Count++;
      else p2Count++;

    } catch {}
  }

  return {
    samples,
    meta: {
      totalInContext: p0Count + p1Count + p2Count,
      fullCount,
      skeletalCount,
      budgetUsedBytes: budgetUsed,
      p0Count,
      p1Count,
      p2Count,
    },
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function buildProjectSnapshot(projectPath: string): Promise<ProjectSnapshot> {
  const allFiles: Array<{ path: string; size: number; ext: string }> = [];
  const tree        = await walkDirectory(projectPath, 0, allFiles);
  const stats       = collectFileStats(allFiles);
  const configFiles = await readConfigFiles(allFiles);
  const depFiles    = await readDepFiles(allFiles);
  const entryPoints = detectEntryPoints(allFiles);
  const { samples: sourceSamples, meta: sourceMeta } = await sampleSourceFiles(allFiles);

  return {
    projectPath,
    projectName: path.basename(projectPath),
    tree,
    stats,
    configFiles,
    depFiles,
    sourceSamples,
    entryPoints,
    sourceMeta,
  };
}

// ─── Project context builder for agents ──────────────────────────────────────

export function buildProjectContext(snapshot: ProjectSnapshot): string {
  const treeOutput = projectTreeString(snapshot.tree).slice(0, 6000);
  const m = snapshot.sourceMeta;
  const budgetKb     = Math.round(m.budgetUsedBytes / 1024);
  const budgetMaxKb  = Math.round(CONTEXT_BUDGET_BYTES / 1024);

  const statsLines = [
    `- Files scanned: ${snapshot.stats.totalFiles}`,
    `- Total size: ${formatBytes(snapshot.stats.totalBytes)}`,
    `- Entry points: ${snapshot.entryPoints.map((p) => path.relative(snapshot.projectPath, p)).join(", ") || "none detected"}`,
    `- Files in context: ${m.totalInContext} (${m.fullCount} full · ${m.skeletalCount} skeletal)`,
    `- Context budget used: ${budgetKb} KB / ${budgetMaxKb} KB`,
    `- Priority breakdown: ${m.p0Count} P0 (full) · ${m.p1Count} P1 (full/skel) · ${m.p2Count} P2 (skeletal)`,
  ].join("\n");

  const topExt = Object.entries(snapshot.stats.byExtension)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([ext, count]) => `  ${ext}: ${count}`)
    .join("\n");

  const configSection = Object.entries(snapshot.configFiles)
    .map(([filePath, content]) => {
      const rel = path.relative(snapshot.projectPath, filePath);
      return `### ${rel}\n\`\`\`\n${content}\n\`\`\``;
    })
    .join("\n\n");

  const depSection = Object.entries(snapshot.depFiles)
    .map(([filePath, content]) => {
      const rel = path.relative(snapshot.projectPath, filePath);
      return `### ${rel}\n\`\`\`\n${content}\n\`\`\``;
    })
    .join("\n\n");

  const sourceSection = Object.entries(snapshot.sourceSamples)
    .map(([filePath, content]) => {
      const rel      = path.relative(snapshot.projectPath, filePath);
      const ext      = path.extname(filePath).slice(1) || "text";
      const priority = classifyFilePriority(filePath);
      const isSkel   = content.startsWith(SKELETON_HEADER);
      const pTag     = priority === 0 ? "P0" : priority === 1 ? "P1" : "P2";
      const mTag     = isSkel ? "skel" : "full";
      return `### ${rel} [${pTag} · ${mTag}]\n\`\`\`${ext}\n${content}\n\`\`\``;
    })
    .join("\n\n");

  return `## Project Structure: ${snapshot.projectName}

### File Tree
\`\`\`
${treeOutput}
\`\`\`

### Statistics
${statsLines}

### File Types
${topExt}

## Configuration Files
${configSection || "_No configuration files detected_"}

## Dependencies
${depSection || "_No dependency files detected_"}

## Source Code Samples
${sourceSection || "_No source code samples available_"}`;
}
