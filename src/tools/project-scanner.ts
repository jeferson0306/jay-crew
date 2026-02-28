import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { formatBytes, projectTreeString } from "./path-utils.js";
import type { FileNode, FileStats, ProjectSnapshot, SourceSampleMeta, DetectedStack } from "../types/index.js";

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
  "pubspec.yaml", "angular.json", "nx.json", "lerna.json", "turbo.json",
]);

const DEP_FILE_NAMES = new Set([
  "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "bun.lockb", "requirements.txt", "Pipfile", "pyproject.toml",
  "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts",
  "Gemfile", "composer.json", "pubspec.yaml",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs", ".py", ".go",
  ".rs", ".java", ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp",
  ".swift", ".kt", ".scala", ".vue", ".svelte", ".astro", ".dart",
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
const MAX_DEPTH           = 15;  // Maven projects can go 10+ levels deep

// ─── Language detection mapping ──────────────────────────────────────────────

const LANGUAGE_MAP: Record<string, string> = {
  ".java": "Java",
  ".kt": "Kotlin",
  ".scala": "Scala",
  ".go": "Go",
  ".rs": "Rust",
  ".py": "Python",
  ".rb": "Ruby",
  ".php": "PHP",
  ".cs": "C#",
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".mts": "TypeScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".astro": "Astro",
  ".swift": "Swift",
  ".dart": "Dart",
  ".cpp": "C++",
  ".c": "C",
  ".h": "C/C++",
  ".hpp": "C++",
};

// ─── Service type detection ──────────────────────────────────────────────────

const SERVICE_MANIFEST_FILES = new Set([
  "package.json", "pom.xml", "build.gradle", "build.gradle.kts",
  "go.mod", "Cargo.toml", "requirements.txt", "pyproject.toml",
  "pubspec.yaml", "composer.json", "Gemfile",
]);

// ─── Priority classifier ──────────────────────────────────────────────────────

function classifyFilePriority(filePath: string): 0 | 1 | 2 {
  const name     = path.basename(filePath);
  const nameLower = name.toLowerCase();
  const stem     = nameLower.replace(/\.[^.]+$/, "");
  const dirLower = filePath.toLowerCase();

  // P0: schemas, migrations, architecture docs
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

  // P1: core logic files
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

export function extractSkeleton(content: string, filePath: string): string {
  const ext   = path.extname(filePath).toLowerCase();
  const lines = content.split("\n");

  if (ext === ".sql") return content;
  if (JVM_EXTS.has(ext))   return extractJvmSkeleton(lines);
  if (TS_JS_EXTS.has(ext)) return extractTsSkeleton(lines);

  const head = lines.slice(0, 20);
  const tail = lines.slice(-5);
  const body = lines.length > 25 ? [...head, "// ...", ...tail] : lines;
  return [SKELETON_HEADER, ...body].join("\n");
}

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

    if (prevDepth === 0 && trimmed.startsWith("package ")) {
      result.push(line);
      continue;
    }

    if (prevDepth === 0 && trimmed.startsWith("import ")) {
      if (importCount < 10)       result.push(line);
      else if (importCount === 10) result.push("// ... (more imports)");
      importCount++;
      continue;
    }

    if (prevDepth === 0) {
      if (
        trimmed.startsWith("@") ||
        /\b(class|interface|enum|record|@interface)\b/.test(trimmed)
      ) {
        result.push(line);
      }
      continue;
    }

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
          const braceIdx = line.indexOf("{");
          result.push(line.substring(0, braceIdx).trimEnd() + " { ... }");
        } else {
          result.push(line);
        }
        continue;
      }

      if (trimmed === "}" || trimmed === "};") {
        result.push(line);
      }
    }
  }

  return result.join("\n");
}

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

    if (inTypeBlock) {
      result.push(line);
      typeDepth += opens - closes;
      if (typeDepth <= 0) inTypeBlock = false;
      continue;
    }

    if (indent > 0) continue;

    if (trimmed.startsWith("import ")) {
      if (importCount < 10)        result.push(line);
      else if (importCount === 10) result.push("// ... (more imports)");
      importCount++;
      continue;
    }

    if (/^(export\s+)?(interface|type)\s/.test(trimmed)) {
      if (trimmed.includes("{")) {
        inTypeBlock = true;
        typeDepth   = opens - closes;
        result.push(line);
        if (typeDepth <= 0) inTypeBlock = false;
      } else {
        result.push(line);
      }
      continue;
    }

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

// ─── Stack detection ─────────────────────────────────────────────────────────

function detectLanguages(
  allFiles: Array<{ path: string; size: number; ext: string }>
): Array<{ name: string; fileCount: number; percentage: number }> {
  const sourceFiles = allFiles.filter((f) => SOURCE_EXTENSIONS.has(f.ext));
  const total = sourceFiles.length;
  if (total === 0) return [];

  const counts: Record<string, number> = {};
  for (const f of sourceFiles) {
    const lang = LANGUAGE_MAP[f.ext] || f.ext;
    counts[lang] = (counts[lang] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([name, fileCount]) => ({
      name,
      fileCount,
      percentage: Math.round((fileCount / total) * 100),
    }))
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 10);
}

function detectFrameworks(configFiles: Record<string, string>): string[] {
  const frameworks: string[] = [];
  const configNames = Object.keys(configFiles).map((p) => path.basename(p).toLowerCase());

  // Backend frameworks
  if (configNames.some((n) => n === "pom.xml")) {
    const pomContent = Object.values(configFiles).find((c) => c.includes("<artifactId>"));
    if (pomContent?.includes("spring-boot")) frameworks.push("Spring Boot");
    else if (pomContent?.includes("quarkus")) frameworks.push("Quarkus");
    else if (pomContent?.includes("micronaut")) frameworks.push("Micronaut");
    else frameworks.push("Java/Maven");
  }
  if (configNames.some((n) => n === "build.gradle" || n === "build.gradle.kts")) {
    frameworks.push("Gradle");
  }
  if (configNames.some((n) => n === "go.mod")) frameworks.push("Go");
  if (configNames.some((n) => n === "cargo.toml")) frameworks.push("Rust");
  if (configNames.some((n) => n === "requirements.txt" || n === "pyproject.toml")) {
    frameworks.push("Python");
  }

  // Frontend frameworks
  if (configNames.some((n) => n === "next.config.js" || n === "next.config.ts")) {
    frameworks.push("Next.js");
  }
  if (configNames.some((n) => n === "nuxt.config.ts")) frameworks.push("Nuxt");
  if (configNames.some((n) => n === "svelte.config.js")) frameworks.push("SvelteKit");
  if (configNames.some((n) => n === "angular.json")) frameworks.push("Angular");
  if (configNames.some((n) => n === "vite.config.ts" || n === "vite.config.js")) {
    frameworks.push("Vite");
  }

  // Mobile
  if (configNames.some((n) => n === "pubspec.yaml")) frameworks.push("Flutter");

  // Monorepo tools
  if (configNames.some((n) => n === "nx.json")) frameworks.push("Nx Monorepo");
  if (configNames.some((n) => n === "lerna.json")) frameworks.push("Lerna Monorepo");
  if (configNames.some((n) => n === "turbo.json")) frameworks.push("Turborepo");

  // Infrastructure
  if (configNames.some((n) => n === "dockerfile")) frameworks.push("Docker");
  if (configNames.some((n) => n.includes("docker-compose") || n.includes("compose.y"))) {
    frameworks.push("Docker Compose");
  }
  if (configNames.some((n) => n.includes("kubernetes") || n.includes("k8s"))) {
    frameworks.push("Kubernetes");
  }

  return [...new Set(frameworks)];
}

function detectServices(
  projectPath: string,
  allFiles: Array<{ path: string; size: number; ext: string }>
): Array<{ name: string; path: string; type: "backend" | "frontend" | "mobile" | "library" | "unknown"; language: string }> {
  const services: Array<{ name: string; path: string; type: "backend" | "frontend" | "mobile" | "library" | "unknown"; language: string }> = [];
  const manifestFiles = allFiles.filter((f) => SERVICE_MANIFEST_FILES.has(path.basename(f.path)));

  // Group by directory (excluding root)
  const byDir: Record<string, string[]> = {};
  for (const f of manifestFiles) {
    const rel = path.relative(projectPath, f.path);
    const dir = path.dirname(rel);
    if (dir === ".") continue; // Skip root-level manifests for service detection
    if (!byDir[dir]) byDir[dir] = [];
    byDir[dir].push(path.basename(f.path));
  }

  for (const [dir, manifests] of Object.entries(byDir)) {
    const serviceName = path.basename(dir);
    const servicePath = path.join(projectPath, dir);

    // Detect type and language
    let type: "backend" | "frontend" | "mobile" | "library" | "unknown" = "unknown";
    let language = "Unknown";

    if (manifests.includes("pom.xml") || manifests.includes("build.gradle")) {
      type = "backend";
      language = "Java";
    } else if (manifests.includes("go.mod")) {
      type = "backend";
      language = "Go";
    } else if (manifests.includes("Cargo.toml")) {
      type = "backend";
      language = "Rust";
    } else if (manifests.includes("requirements.txt") || manifests.includes("pyproject.toml")) {
      type = "backend";
      language = "Python";
    } else if (manifests.includes("pubspec.yaml")) {
      type = "mobile";
      language = "Dart (Flutter)";
    } else if (manifests.includes("package.json")) {
      // Check if frontend or backend Node.js
      const dirFiles = allFiles.filter((f) => f.path.startsWith(servicePath));
      const hasTsx = dirFiles.some((f) => f.ext === ".tsx" || f.ext === ".jsx");
      const hasVue = dirFiles.some((f) => f.ext === ".vue");
      const hasSvelte = dirFiles.some((f) => f.ext === ".svelte");

      if (hasTsx || hasVue || hasSvelte) {
        type = "frontend";
        language = hasTsx ? "TypeScript (React)" : hasVue ? "Vue" : "Svelte";
      } else {
        type = "backend";
        language = "Node.js";
      }
    }

    services.push({ name: serviceName, path: dir, type, language });
  }

  return services;
}

function detectStack(
  projectPath: string,
  allFiles: Array<{ path: string; size: number; ext: string }>,
  configFiles: Record<string, string>
): DetectedStack {
  const languages = detectLanguages(allFiles);
  const frameworks = detectFrameworks(configFiles);
  const services = detectServices(projectPath, allFiles);

  // Detect monorepo
  const manifestCount = allFiles.filter((f) => SERVICE_MANIFEST_FILES.has(path.basename(f.path))).length;
  const isMonorepo = services.length >= 2 || 
    frameworks.some((f) => f.includes("Monorepo")) ||
    manifestCount >= 3;

  // Detect database
  const hasDatabase = allFiles.some((f) => 
    f.ext === ".sql" ||
    f.path.toLowerCase().includes("migration") ||
    f.path.toLowerCase().includes("schema") ||
    path.basename(f.path) === "schema.prisma"
  );

  // Detect infrastructure
  const hasInfrastructure = allFiles.some((f) => {
    const name = path.basename(f.path).toLowerCase();
    return name === "dockerfile" ||
      name.includes("docker-compose") ||
      name.includes("compose.y") ||
      name.includes("kubernetes") ||
      name.includes("k8s") ||
      f.path.includes("/openshift/") ||
      f.path.includes("/.github/workflows/") ||
      name.includes("azure-pipeline") ||
      name.includes("jenkinsfile") ||
      name.includes(".gitlab-ci");
  });

  // Detect tests
  const hasTests = allFiles.some((f) => isTestFile(f.path));

  return {
    languages,
    frameworks,
    isMonorepo,
    services,
    hasDatabase,
    hasInfrastructure,
    hasTests,
  };
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

  const p0Files   = sourceFiles.filter((f) => classifyFilePriority(f.path) === 0);
  const p1All     = sourceFiles.filter((f) => classifyFilePriority(f.path) === 1);
  const p2All     = sourceFiles.filter((f) => classifyFilePriority(f.path) === 2);

  const p1NonTest = p1All.filter((f) => !isTestFile(f.path));
  const p1Tests   = p1All.filter((f) =>  isTestFile(f.path));
  const p2Sorted  = [...p2All].sort((a, b) => b.size - a.size);

  const ordered = [...p0Files, ...p1NonTest, ...p1Tests, ...p2Sorted];

  const samples: Record<string, string> = {};
  let budgetUsed  = 0;
  let testCount   = 0;
  let p0Count = 0, p1Count = 0, p2Count = 0;
  let fullCount = 0, skeletalCount = 0;

  for (const f of ordered) {
    if (budgetUsed >= CONTEXT_BUDGET_BYTES) break;

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
        content  = raw;
        skeletal = false;
      } else if (priority === 1 && raw.length <= P1_FULL_CAP) {
        content  = raw;
        skeletal = false;
      } else {
        content  = extractSkeleton(raw, f.path);
        skeletal = true;
      }

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
  const detectedStack = detectStack(projectPath, allFiles, configFiles);

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
    detectedStack,
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

  // Stack summary
  const stack = snapshot.detectedStack;
  const langSummary = stack.languages.slice(0, 5)
    .map((l) => `${l.name} (${l.percentage}%)`)
    .join(", ");
  
  const stackLines = [
    `- Primary languages: ${langSummary || "none detected"}`,
    `- Frameworks: ${stack.frameworks.join(", ") || "none detected"}`,
    `- Project type: ${stack.isMonorepo ? "Monorepo / Multi-service" : "Single project"}`,
    `- Has database: ${stack.hasDatabase ? "Yes" : "No"}`,
    `- Has infrastructure: ${stack.hasInfrastructure ? "Yes" : "No"}`,
    `- Has tests: ${stack.hasTests ? "Yes" : "No"}`,
  ].join("\n");

  const servicesSection = stack.services.length > 0
    ? `### Detected Services\n${stack.services.map((s) => `- **${s.name}** (${s.type}) — ${s.language} — \`${s.path}\``).join("\n")}`
    : "";

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

### Detected Technology Stack
${stackLines}

${servicesSection}

### File Types
${topExt}

## Configuration Files
${configSection || "_No configuration files detected_"}

## Dependencies
${depSection || "_No dependency files detected_"}

## Source Code Samples
${sourceSection || "_No source code samples available_"}`;
}
