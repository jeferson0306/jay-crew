import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { formatBytes, projectTreeString } from "./path-utils.js";
import type { FileNode, FileStats, ProjectSnapshot } from "../types/index.js";

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

const CONFIG_FILE_CAP = 8 * 1024;  // 8 KB
const SOURCE_FILE_CAP = 4 * 1024;  // 4 KB
const MAX_DEPTH = 8;
const MAX_SOURCE_SAMPLES = 30;
const MAX_TEST_FILES = 3;

// ─── Priority classifier ──────────────────────────────────────────────────────

/**
 * Classifies a source file into a priority tier:
 *   P0 — always include: migrations, schemas, architecture decision records, docs
 *   P1 — prefer: controllers, services, auth, middleware, store/context
 *   P2 — fill remaining slots: all other source files (sorted by size desc)
 */
function classifyFilePriority(filePath: string): 0 | 1 | 2 {
  const name = path.basename(filePath);
  const nameLower = name.toLowerCase();
  const stem = nameLower.replace(/\.[^.]+$/, ""); // strip extension
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
): Omit<FileStats, "priorityBreakdown"> {
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

  return {
    totalFiles: allFiles.length,
    totalBytes,
    byExtension,
    largestFiles,
  };
}

async function readConfigFiles(
  allFiles: Array<{ path: string; size: number; ext: string }>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const f of allFiles) {
    const base = path.basename(f.path);
    if (!CONFIG_FILE_NAMES.has(base)) continue;
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
    const base = path.basename(f.path);
    if (!DEP_FILE_NAMES.has(base)) continue;
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
): Promise<{ samples: Record<string, string>; breakdown: { p0: number; p1: number; p2: number } }> {
  const sourceFiles = allFiles.filter((f) => SOURCE_EXTENSIONS.has(f.ext));

  // Partition by priority
  const p0Files = sourceFiles.filter((f) => classifyFilePriority(f.path) === 0);
  const p1All   = sourceFiles.filter((f) => classifyFilePriority(f.path) === 1);
  const p2All   = sourceFiles.filter((f) => classifyFilePriority(f.path) === 2);

  // Within P1: separate test files (max 3), prefer spec/e2e
  const p1NonTest = p1All.filter((f) => !isTestFile(f.path));
  const p1Tests   = p1All.filter((f) => isTestFile(f.path));

  // P2: sort by size descending to prefer more substantial files
  const p2Sorted = [...p2All].sort((a, b) => b.size - a.size);

  // Build ordered candidate list: P0 → P1 non-test → P1 test (capped) → P2
  const ordered = [...p0Files, ...p1NonTest, ...p1Tests, ...p2Sorted];

  const samples: Record<string, string> = {};
  const breakdown = { p0: 0, p1: 0, p2: 0 };
  let testCount = 0;

  for (const f of ordered) {
    if (Object.keys(samples).length >= MAX_SOURCE_SAMPLES) break;

    // Enforce global test-file cap
    if (isTestFile(f.path)) {
      if (testCount >= MAX_TEST_FILES) continue;
      testCount++;
    }

    try {
      const raw = await fs.readFile(f.path, "utf8");
      samples[f.path] = raw.slice(0, SOURCE_FILE_CAP);
      const p = classifyFilePriority(f.path);
      if (p === 0) breakdown.p0++;
      else if (p === 1) breakdown.p1++;
      else breakdown.p2++;
    } catch {}
  }

  return { samples, breakdown };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function buildProjectSnapshot(projectPath: string): Promise<ProjectSnapshot> {
  const allFiles: Array<{ path: string; size: number; ext: string }> = [];
  const tree = await walkDirectory(projectPath, 0, allFiles);
  const baseStats = collectFileStats(allFiles);
  const configFiles = await readConfigFiles(allFiles);
  const depFiles = await readDepFiles(allFiles);
  const entryPoints = detectEntryPoints(allFiles);
  const { samples: sourceSamples, breakdown: priorityBreakdown } = await sampleSourceFiles(allFiles);

  return {
    projectPath,
    projectName: path.basename(projectPath),
    tree,
    stats: { ...baseStats, priorityBreakdown },
    configFiles,
    depFiles,
    sourceSamples,
    entryPoints,
  };
}

// ─── Project context builder for agents ──────────────────────────────────────

export function buildProjectContext(snapshot: ProjectSnapshot): string {
  const treeOutput = projectTreeString(snapshot.tree).slice(0, 6000);
  const { p0, p1, p2 } = snapshot.stats.priorityBreakdown;

  const statsLines = [
    `- Total files: ${snapshot.stats.totalFiles}`,
    `- Total size: ${formatBytes(snapshot.stats.totalBytes)}`,
    `- Entry points: ${snapshot.entryPoints.map((p) => path.relative(snapshot.projectPath, p)).join(", ") || "none detected"}`,
    `- Sampled sources: ${p0} P0 (schemas/migrations/docs) + ${p1} P1 (core logic) + ${p2} P2 (other) = ${p0 + p1 + p2} files`,
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
      const rel = path.relative(snapshot.projectPath, filePath);
      const ext = path.extname(filePath).slice(1) || "text";
      const priority = classifyFilePriority(filePath);
      const tag = priority === 0 ? " [P0]" : priority === 1 ? " [P1]" : "";
      return `### ${rel}${tag}\n\`\`\`${ext}\n${content}\n\`\`\``;
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
