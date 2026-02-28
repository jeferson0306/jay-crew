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
  // JVM languages
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".scala": "Scala",
  ".groovy": "Groovy",
  ".clj": "Clojure",
  ".cljs": "ClojureScript",
  ".cljc": "Clojure",
  // Systems languages
  ".go": "Go",
  ".rs": "Rust",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".c": "C",
  ".h": "C/C++",
  ".hpp": "C++",
  ".hxx": "C++",
  ".zig": "Zig",
  ".nim": "Nim",
  ".d": "D",
  // Scripting languages
  ".py": "Python",
  ".rb": "Ruby",
  ".php": "PHP",
  ".pl": "Perl",
  ".pm": "Perl",
  ".lua": "Lua",
  ".tcl": "Tcl",
  // .NET languages
  ".cs": "C#",
  ".fs": "F#",
  ".fsx": "F#",
  ".vb": "Visual Basic",
  // JavaScript/TypeScript
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".mts": "TypeScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  // Frontend frameworks
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".astro": "Astro",
  // Mobile
  ".swift": "Swift",
  ".m": "Objective-C",
  ".mm": "Objective-C++",
  ".dart": "Dart",
  // Functional languages
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".erl": "Erlang",
  ".hrl": "Erlang",
  ".hs": "Haskell",
  ".lhs": "Haskell",
  ".ml": "OCaml",
  ".mli": "OCaml",
  ".elm": "Elm",
  ".purs": "PureScript",
  ".rkt": "Racket",
  ".scm": "Scheme",
  ".lisp": "Lisp",
  ".cl": "Common Lisp",
  // Data/Scientific
  ".r": "R",
  ".R": "R",
  ".jl": "Julia",
  ".mat": "MATLAB",
  // Enterprise/Legacy
  ".cob": "COBOL",
  ".cbl": "COBOL",
  ".f": "Fortran",
  ".f90": "Fortran",
  ".f95": "Fortran",
  ".for": "Fortran",
  ".ada": "Ada",
  ".adb": "Ada",
  ".ads": "Ada",
  ".abap": "ABAP",
  ".p": "Progress 4GL",
  ".w": "Progress 4GL",
  // Shell/Scripting
  ".sh": "Shell",
  ".bash": "Bash",
  ".zsh": "Zsh",
  ".fish": "Fish",
  ".ps1": "PowerShell",
  ".psm1": "PowerShell",
  ".bat": "Batch",
  ".cmd": "Batch",
  // Config as code
  ".tf": "Terraform",
  ".hcl": "HCL",
  ".nix": "Nix",
  // Query languages
  ".sql": "SQL",
  ".graphql": "GraphQL",
  ".gql": "GraphQL",
  // Templating
  ".erb": "ERB",
  ".ejs": "EJS",
  ".hbs": "Handlebars",
  ".mustache": "Mustache",
  ".jinja": "Jinja",
  ".jinja2": "Jinja",
  ".twig": "Twig",
  ".liquid": "Liquid",
  // WebAssembly
  ".wat": "WebAssembly",
  ".wasm": "WebAssembly",
};

// ─── Service type detection ──────────────────────────────────────────────────

const SERVICE_MANIFEST_FILES = new Set([
  // JavaScript/Node.js
  "package.json",
  // Java/JVM
  "pom.xml", "build.gradle", "build.gradle.kts", "build.sbt",
  // Go
  "go.mod",
  // Rust
  "Cargo.toml",
  // Python
  "requirements.txt", "pyproject.toml", "setup.py", "Pipfile",
  // Dart/Flutter
  "pubspec.yaml",
  // PHP
  "composer.json",
  // Ruby
  "Gemfile",
  // .NET
  "*.csproj", "*.fsproj", "*.vbproj",
  // Elixir
  "mix.exs",
  // Haskell
  "stack.yaml", "cabal.project", "package.yaml",
  // Clojure
  "project.clj", "deps.edn",
  // Erlang
  "rebar.config",
  // Nim
  "*.nimble",
  // Swift
  "Package.swift",
  // R
  "DESCRIPTION",
  // Julia
  "Project.toml",
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

function detectFrameworks(configFiles: Record<string, string>, allFiles: Array<{ path: string; ext: string }>): string[] {
  const frameworks: string[] = [];
  const configNames = Object.keys(configFiles).map((p) => path.basename(p).toLowerCase());
  const allConfigPaths = Object.keys(configFiles).map((p) => p.toLowerCase());
  const allContent = Object.values(configFiles).join("\n").toLowerCase();
  const allFilePaths = allFiles.map((f) => f.path.toLowerCase());

  // ═══════════════════════════════════════════════════════════════════════════
  // JAVA / JVM ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "pom.xml")) {
    const pomContent = Object.values(configFiles).find((c) => c.includes("<artifactId>")) || "";
    if (pomContent.includes("spring-boot")) frameworks.push("Spring Boot");
    if (pomContent.includes("quarkus")) frameworks.push("Quarkus");
    if (pomContent.includes("micronaut")) frameworks.push("Micronaut");
    if (pomContent.includes("dropwizard")) frameworks.push("Dropwizard");
    if (pomContent.includes("vertx") || pomContent.includes("vert.x")) frameworks.push("Vert.x");
    if (pomContent.includes("helidon")) frameworks.push("Helidon");
    if (pomContent.includes("jakarta")) frameworks.push("Jakarta EE");
    if (pomContent.includes("javax.servlet")) frameworks.push("Java Servlet");
    if (!frameworks.some((f) => f.includes("Spring") || f.includes("Quarkus") || f.includes("Micronaut"))) {
      frameworks.push("Java/Maven");
    }
  }
  if (configNames.some((n) => n === "build.gradle" || n === "build.gradle.kts")) {
    if (allContent.includes("org.springframework.boot")) frameworks.push("Spring Boot");
    if (allContent.includes("io.quarkus")) frameworks.push("Quarkus");
    frameworks.push("Gradle");
  }
  if (configNames.some((n) => n === "build.sbt")) frameworks.push("Scala/sbt");
  if (allContent.includes("play.api") || allContent.includes("playframework")) frameworks.push("Play Framework");
  if (allContent.includes("akka")) frameworks.push("Akka");

  // ═══════════════════════════════════════════════════════════════════════════
  // GO ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "go.mod")) {
    if (allContent.includes("github.com/gin-gonic/gin")) frameworks.push("Gin");
    else if (allContent.includes("github.com/labstack/echo")) frameworks.push("Echo");
    else if (allContent.includes("github.com/gofiber/fiber")) frameworks.push("Fiber");
    else if (allContent.includes("github.com/gorilla/mux")) frameworks.push("Gorilla Mux");
    else if (allContent.includes("github.com/go-chi/chi")) frameworks.push("Chi");
    else if (allContent.includes("github.com/beego/beego")) frameworks.push("Beego");
    else frameworks.push("Go");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUST ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "cargo.toml")) {
    if (allContent.includes("actix-web")) frameworks.push("Actix Web");
    else if (allContent.includes("axum")) frameworks.push("Axum");
    else if (allContent.includes("rocket")) frameworks.push("Rocket");
    else if (allContent.includes("warp")) frameworks.push("Warp");
    else if (allContent.includes("tide")) frameworks.push("Tide");
    else if (allContent.includes("tauri")) frameworks.push("Tauri");
    else if (allContent.includes("yew")) frameworks.push("Yew");
    else if (allContent.includes("leptos")) frameworks.push("Leptos");
    else frameworks.push("Rust");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PYTHON ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => ["requirements.txt", "pyproject.toml", "setup.py", "pipfile"].includes(n))) {
    if (allContent.includes("django")) frameworks.push("Django");
    if (allContent.includes("fastapi")) frameworks.push("FastAPI");
    if (allContent.includes("flask")) frameworks.push("Flask");
    if (allContent.includes("tornado")) frameworks.push("Tornado");
    if (allContent.includes("pyramid")) frameworks.push("Pyramid");
    if (allContent.includes("falcon")) frameworks.push("Falcon");
    if (allContent.includes("sanic")) frameworks.push("Sanic");
    if (allContent.includes("starlette")) frameworks.push("Starlette");
    if (allContent.includes("bottle")) frameworks.push("Bottle");
    if (allContent.includes("aiohttp")) frameworks.push("aiohttp");
    if (allContent.includes("celery")) frameworks.push("Celery");
    if (allContent.includes("airflow")) frameworks.push("Apache Airflow");
    if (allContent.includes("luigi")) frameworks.push("Luigi");
    if (allContent.includes("prefect")) frameworks.push("Prefect");
    if (allContent.includes("dagster")) frameworks.push("Dagster");
    if (allContent.includes("tensorflow") || allContent.includes("keras")) frameworks.push("TensorFlow");
    if (allContent.includes("pytorch") || allContent.includes("torch")) frameworks.push("PyTorch");
    if (allContent.includes("scikit-learn") || allContent.includes("sklearn")) frameworks.push("scikit-learn");
    if (allContent.includes("pandas")) frameworks.push("Pandas");
    if (allContent.includes("numpy")) frameworks.push("NumPy");
    if (allContent.includes("streamlit")) frameworks.push("Streamlit");
    if (allContent.includes("gradio")) frameworks.push("Gradio");
    if (!frameworks.some((f) => ["Django", "FastAPI", "Flask", "Tornado", "Pyramid"].includes(f))) {
      frameworks.push("Python");
    }
  }
  if (configNames.some((n) => n === "manage.py")) frameworks.push("Django");

  // ═══════════════════════════════════════════════════════════════════════════
  // RUBY ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "gemfile")) {
    if (allContent.includes("rails")) frameworks.push("Ruby on Rails");
    if (allContent.includes("sinatra")) frameworks.push("Sinatra");
    if (allContent.includes("hanami")) frameworks.push("Hanami");
    if (allContent.includes("grape")) frameworks.push("Grape");
    if (allContent.includes("sidekiq")) frameworks.push("Sidekiq");
    if (allContent.includes("rspec")) frameworks.push("RSpec");
    if (!frameworks.some((f) => f.includes("Rails") || f.includes("Sinatra"))) {
      frameworks.push("Ruby");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHP ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "composer.json")) {
    if (allContent.includes("laravel")) frameworks.push("Laravel");
    if (allContent.includes("symfony")) frameworks.push("Symfony");
    if (allContent.includes("slim/slim")) frameworks.push("Slim");
    if (allContent.includes("cakephp")) frameworks.push("CakePHP");
    if (allContent.includes("codeigniter")) frameworks.push("CodeIgniter");
    if (allContent.includes("yiisoft/yii2")) frameworks.push("Yii");
    if (allContent.includes("laminas")) frameworks.push("Laminas");
    if (allContent.includes("drupal")) frameworks.push("Drupal");
    if (allContent.includes("wordpress")) frameworks.push("WordPress");
    if (allContent.includes("magento")) frameworks.push("Magento");
    if (!frameworks.some((f) => ["Laravel", "Symfony", "CakePHP", "Drupal", "WordPress"].includes(f))) {
      frameworks.push("PHP");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // .NET ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n.endsWith(".csproj") || n.endsWith(".fsproj") || n.endsWith(".sln"))) {
    if (allContent.includes("microsoft.aspnetcore")) frameworks.push("ASP.NET Core");
    if (allContent.includes("blazor")) frameworks.push("Blazor");
    if (allContent.includes("maui")) frameworks.push(".NET MAUI");
    if (allContent.includes("xamarin")) frameworks.push("Xamarin");
    if (allContent.includes("avalonia")) frameworks.push("Avalonia");
    if (allContent.includes("wpf")) frameworks.push("WPF");
    if (allContent.includes("winforms")) frameworks.push("WinForms");
    if (allContent.includes("entityframework") || allContent.includes("entity framework")) frameworks.push("Entity Framework");
    if (allContent.includes("nservicebus")) frameworks.push("NServiceBus");
    if (allContent.includes("masstransit")) frameworks.push("MassTransit");
    if (!frameworks.some((f) => f.includes("ASP.NET") || f.includes("Blazor"))) {
      frameworks.push(".NET");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ELIXIR / ERLANG ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "mix.exs")) {
    if (allContent.includes("phoenix")) frameworks.push("Phoenix");
    if (allContent.includes("nerves")) frameworks.push("Nerves");
    if (allContent.includes("absinthe")) frameworks.push("Absinthe (GraphQL)");
    if (allContent.includes("liveview")) frameworks.push("Phoenix LiveView");
    if (!frameworks.includes("Phoenix")) frameworks.push("Elixir");
  }
  if (configNames.some((n) => n === "rebar.config")) {
    if (allContent.includes("cowboy")) frameworks.push("Cowboy");
    frameworks.push("Erlang");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HASKELL ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => ["stack.yaml", "cabal.project", "package.yaml"].includes(n))) {
    if (allContent.includes("servant")) frameworks.push("Servant");
    if (allContent.includes("yesod")) frameworks.push("Yesod");
    if (allContent.includes("scotty")) frameworks.push("Scotty");
    if (allContent.includes("ihp")) frameworks.push("IHP");
    frameworks.push("Haskell");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOJURE ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => ["project.clj", "deps.edn"].includes(n))) {
    if (allContent.includes("ring")) frameworks.push("Ring");
    if (allContent.includes("compojure")) frameworks.push("Compojure");
    if (allContent.includes("luminus")) frameworks.push("Luminus");
    if (allContent.includes("pedestal")) frameworks.push("Pedestal");
    frameworks.push("Clojure");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NODE.JS / JAVASCRIPT FRAMEWORKS
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "package.json")) {
    if (allContent.includes("\"express\"")) frameworks.push("Express.js");
    if (allContent.includes("\"@nestjs/core\"") || allContent.includes("nestjs")) frameworks.push("NestJS");
    if (allContent.includes("\"fastify\"")) frameworks.push("Fastify");
    if (allContent.includes("\"hapi\"") || allContent.includes("\"@hapi/hapi\"")) frameworks.push("Hapi");
    if (allContent.includes("\"koa\"")) frameworks.push("Koa");
    if (allContent.includes("\"@adonisjs\"") || allContent.includes("adonisjs")) frameworks.push("AdonisJS");
    if (allContent.includes("\"strapi\"")) frameworks.push("Strapi");
    if (allContent.includes("\"keystone\"")) frameworks.push("KeystoneJS");
    if (allContent.includes("\"prisma\"")) frameworks.push("Prisma");
    if (allContent.includes("\"typeorm\"")) frameworks.push("TypeORM");
    if (allContent.includes("\"sequelize\"")) frameworks.push("Sequelize");
    if (allContent.includes("\"mongoose\"")) frameworks.push("Mongoose");
    if (allContent.includes("\"@trpc\"") || allContent.includes("trpc")) frameworks.push("tRPC");
    if (allContent.includes("\"graphql\"") || allContent.includes("\"apollo\"")) frameworks.push("GraphQL");
    if (allContent.includes("\"socket.io\"")) frameworks.push("Socket.IO");
    if (allContent.includes("\"electron\"")) frameworks.push("Electron");
    if (allContent.includes("\"puppeteer\"")) frameworks.push("Puppeteer");
    if (allContent.includes("\"playwright\"")) frameworks.push("Playwright");
    if (allContent.includes("\"jest\"")) frameworks.push("Jest");
    if (allContent.includes("\"vitest\"")) frameworks.push("Vitest");
    if (allContent.includes("\"cypress\"")) frameworks.push("Cypress");
    if (allContent.includes("\"tailwindcss\"")) frameworks.push("Tailwind CSS");
    if (allContent.includes("\"styled-components\"")) frameworks.push("Styled Components");
    if (allContent.includes("\"@emotion\"")) frameworks.push("Emotion");
    if (allContent.includes("\"redux\"")) frameworks.push("Redux");
    if (allContent.includes("\"zustand\"")) frameworks.push("Zustand");
    if (allContent.includes("\"mobx\"")) frameworks.push("MobX");
    if (allContent.includes("\"recoil\"")) frameworks.push("Recoil");
    if (allContent.includes("\"jotai\"")) frameworks.push("Jotai");
    if (allContent.includes("\"tanstack\"") || allContent.includes("react-query")) frameworks.push("TanStack Query");
    if (allContent.includes("\"storybook\"")) frameworks.push("Storybook");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FRONTEND FRAMEWORKS
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => ["next.config.js", "next.config.ts", "next.config.mjs"].includes(n))) {
    frameworks.push("Next.js");
  }
  if (configNames.some((n) => ["nuxt.config.ts", "nuxt.config.js"].includes(n))) frameworks.push("Nuxt");
  if (configNames.some((n) => n === "svelte.config.js")) frameworks.push("SvelteKit");
  if (configNames.some((n) => n === "angular.json")) frameworks.push("Angular");
  if (configNames.some((n) => ["astro.config.mjs", "astro.config.ts"].includes(n))) frameworks.push("Astro");
  if (configNames.some((n) => ["vite.config.ts", "vite.config.js"].includes(n))) frameworks.push("Vite");
  if (configNames.some((n) => ["remix.config.js", "remix.config.ts"].includes(n))) frameworks.push("Remix");
  if (configNames.some((n) => n === "gatsby-config.js" || n === "gatsby-config.ts")) frameworks.push("Gatsby");
  if (configNames.some((n) => n === "solid-start.config.ts")) frameworks.push("SolidStart");
  if (configNames.some((n) => n === "qwik.config.ts")) frameworks.push("Qwik");
  if (configNames.some((n) => n === "ember-cli-build.js")) frameworks.push("Ember.js");
  if (allContent.includes("\"vue\"") || allFilePaths.some((p) => p.endsWith(".vue"))) frameworks.push("Vue.js");
  if (allContent.includes("\"react\"") || allFilePaths.some((p) => p.endsWith(".tsx") || p.endsWith(".jsx"))) {
    if (!frameworks.includes("Next.js") && !frameworks.includes("Remix") && !frameworks.includes("Gatsby")) {
      frameworks.push("React");
    }
  }
  if (allContent.includes("\"svelte\"") || allFilePaths.some((p) => p.endsWith(".svelte"))) {
    if (!frameworks.includes("SvelteKit")) frameworks.push("Svelte");
  }
  if (allContent.includes("\"solid-js\"")) frameworks.push("Solid.js");
  if (allContent.includes("\"preact\"")) frameworks.push("Preact");
  if (allContent.includes("\"alpine\"") || allContent.includes("alpinejs")) frameworks.push("Alpine.js");
  if (allContent.includes("\"htmx\"")) frameworks.push("htmx");
  if (allContent.includes("\"lit\"") || allContent.includes("lit-element")) frameworks.push("Lit");

  // ═══════════════════════════════════════════════════════════════════════════
  // MOBILE DEVELOPMENT
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "pubspec.yaml")) frameworks.push("Flutter");
  if (configNames.some((n) => n === "podfile")) frameworks.push("iOS (CocoaPods)");
  if (configNames.some((n) => n === "package.swift")) frameworks.push("Swift Package Manager");
  if (configNames.some((n) => n === "build.gradle") && allContent.includes("com.android")) frameworks.push("Android");
  if (allContent.includes("react-native")) frameworks.push("React Native");
  if (allContent.includes("expo")) frameworks.push("Expo");
  if (allContent.includes("capacitor")) frameworks.push("Capacitor");
  if (allContent.includes("ionic")) frameworks.push("Ionic");
  if (allContent.includes("nativescript")) frameworks.push("NativeScript");

  // ═══════════════════════════════════════════════════════════════════════════
  // MONOREPO TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "nx.json")) frameworks.push("Nx");
  if (configNames.some((n) => n === "lerna.json")) frameworks.push("Lerna");
  if (configNames.some((n) => n === "turbo.json")) frameworks.push("Turborepo");
  if (configNames.some((n) => n === "pnpm-workspace.yaml")) frameworks.push("pnpm Workspaces");
  if (configNames.some((n) => n === "rush.json")) frameworks.push("Rush");
  if (allContent.includes("\"workspaces\"")) frameworks.push("Yarn/npm Workspaces");

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGE QUEUES / EVENT STREAMING
  // ═══════════════════════════════════════════════════════════════════════════
  if (allContent.includes("kafka") || allContent.includes("kafkajs")) frameworks.push("Apache Kafka");
  if (allContent.includes("rabbitmq") || allContent.includes("amqplib")) frameworks.push("RabbitMQ");
  if (allContent.includes("bullmq") || allContent.includes("\"bull\"")) frameworks.push("BullMQ");
  if (allContent.includes("aws-sdk") && allContent.includes("sqs")) frameworks.push("AWS SQS");
  if (allContent.includes("nats")) frameworks.push("NATS");
  if (allContent.includes("pulsar")) frameworks.push("Apache Pulsar");
  if (allContent.includes("zeromq") || allContent.includes("zmq")) frameworks.push("ZeroMQ");

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASES / ORM / DATA
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "schema.prisma")) frameworks.push("Prisma");
  if (allContent.includes("mongodb") || allContent.includes("mongoose")) frameworks.push("MongoDB");
  if (allContent.includes("postgresql") || allContent.includes("pg")) frameworks.push("PostgreSQL");
  if (allContent.includes("mysql2") || allContent.includes("mysql")) frameworks.push("MySQL");
  if (allContent.includes("redis") || allContent.includes("ioredis")) frameworks.push("Redis");
  if (allContent.includes("elasticsearch") || allContent.includes("@elastic")) frameworks.push("Elasticsearch");
  if (allContent.includes("neo4j")) frameworks.push("Neo4j");
  if (allContent.includes("cassandra")) frameworks.push("Cassandra");
  if (allContent.includes("dynamodb")) frameworks.push("DynamoDB");
  if (allContent.includes("firebase") || allContent.includes("firestore")) frameworks.push("Firebase");
  if (allContent.includes("supabase")) frameworks.push("Supabase");
  if (allContent.includes("planetscale")) frameworks.push("PlanetScale");
  if (allContent.includes("cockroachdb")) frameworks.push("CockroachDB");
  if (allContent.includes("timescaledb")) frameworks.push("TimescaleDB");
  if (allContent.includes("influxdb")) frameworks.push("InfluxDB");
  if (allContent.includes("clickhouse")) frameworks.push("ClickHouse");
  if (allContent.includes("drizzle")) frameworks.push("Drizzle ORM");
  if (allContent.includes("knex")) frameworks.push("Knex.js");
  if (allContent.includes("sqlalchemy")) frameworks.push("SQLAlchemy");
  if (allContent.includes("hibernate")) frameworks.push("Hibernate");
  if (allContent.includes("activerecord")) frameworks.push("ActiveRecord");

  // ═══════════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE AS CODE
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "dockerfile" || n.startsWith("dockerfile."))) frameworks.push("Docker");
  if (configNames.some((n) => n.includes("docker-compose") || n.includes("compose.y"))) frameworks.push("Docker Compose");
  if (allConfigPaths.some((p) => p.includes("kubernetes") || p.includes("k8s") || p.endsWith(".yaml") && allContent.includes("apiversion:"))) {
    frameworks.push("Kubernetes");
  }
  if (configNames.some((n) => n.endsWith(".tf") || n === "main.tf")) frameworks.push("Terraform");
  if (configNames.some((n) => n === "pulumi.yaml" || n === "pulumi.yml")) frameworks.push("Pulumi");
  if (configNames.some((n) => n === "ansible.cfg") || allConfigPaths.some((p) => p.includes("playbook"))) frameworks.push("Ansible");
  if (configNames.some((n) => n === "vagrantfile")) frameworks.push("Vagrant");
  if (allContent.includes("cloudformation") || configNames.some((n) => n.includes("cloudformation"))) frameworks.push("CloudFormation");
  if (configNames.some((n) => n === "cdk.json")) frameworks.push("AWS CDK");
  if (configNames.some((n) => n === "sam.yaml" || n === "template.yaml") && allContent.includes("aws::serverless")) frameworks.push("AWS SAM");
  if (configNames.some((n) => n === "serverless.yml" || n === "serverless.yaml")) frameworks.push("Serverless Framework");
  if (configNames.some((n) => n === "skaffold.yaml")) frameworks.push("Skaffold");
  if (configNames.some((n) => n === "tilt.yaml" || n === "tiltfile")) frameworks.push("Tilt");
  if (configNames.some((n) => n === "helmfile.yaml") || allConfigPaths.some((p) => p.includes("/helm/"))) frameworks.push("Helm");
  if (configNames.some((n) => n === "kustomization.yaml")) frameworks.push("Kustomize");

  // ═══════════════════════════════════════════════════════════════════════════
  // CI/CD PIPELINES
  // ═══════════════════════════════════════════════════════════════════════════
  if (allConfigPaths.some((p) => p.includes(".github/workflows"))) frameworks.push("GitHub Actions");
  if (configNames.some((n) => n === ".gitlab-ci.yml")) frameworks.push("GitLab CI");
  if (configNames.some((n) => n === "jenkinsfile")) frameworks.push("Jenkins");
  if (configNames.some((n) => n === "azure-pipelines.yml" || n === "azure-pipelines.yaml")) frameworks.push("Azure Pipelines");
  if (configNames.some((n) => n === "bitbucket-pipelines.yml")) frameworks.push("Bitbucket Pipelines");
  if (configNames.some((n) => n === ".circleci" || n === "config.yml") && allConfigPaths.some((p) => p.includes(".circleci"))) {
    frameworks.push("CircleCI");
  }
  if (configNames.some((n) => n === ".travis.yml")) frameworks.push("Travis CI");
  if (configNames.some((n) => n === ".drone.yml")) frameworks.push("Drone CI");
  if (configNames.some((n) => n === "buildkite.yml" || n === ".buildkite")) frameworks.push("Buildkite");
  if (configNames.some((n) => n === "cloudbuild.yaml" || n === "cloudbuild.yml")) frameworks.push("Google Cloud Build");
  if (configNames.some((n) => n === "appveyor.yml")) frameworks.push("AppVeyor");
  if (configNames.some((n) => n === "concourse.yml") || allConfigPaths.some((p) => p.includes("concourse"))) frameworks.push("Concourse CI");
  if (configNames.some((n) => n === "codefresh.yml")) frameworks.push("Codefresh");
  if (configNames.some((n) => n === "semaphore.yml") || allConfigPaths.some((p) => p.includes(".semaphore"))) frameworks.push("Semaphore CI");
  if (allConfigPaths.some((p) => p.includes("tekton"))) frameworks.push("Tekton");
  if (configNames.some((n) => n === "argocd" || n.includes("argocd"))) frameworks.push("ArgoCD");
  if (configNames.some((n) => n.includes("fluxcd") || n === "flux-system")) frameworks.push("FluxCD");
  if (configNames.some((n) => n === "spinnaker.yml")) frameworks.push("Spinnaker");
  if (configNames.some((n) => n === "wercker.yml")) frameworks.push("Wercker");
  if (configNames.some((n) => n === "buddy.yml")) frameworks.push("Buddy");

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOUD PLATFORMS / HOSTING
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "vercel.json")) frameworks.push("Vercel");
  if (configNames.some((n) => n === "netlify.toml")) frameworks.push("Netlify");
  if (configNames.some((n) => n === "fly.toml")) frameworks.push("Fly.io");
  if (configNames.some((n) => n === "render.yaml")) frameworks.push("Render");
  if (configNames.some((n) => n === "railway.json" || n === "railway.toml")) frameworks.push("Railway");
  if (configNames.some((n) => n === "app.yaml") && allContent.includes("runtime:")) frameworks.push("Google App Engine");
  if (configNames.some((n) => n === "heroku.yml" || n === "procfile")) frameworks.push("Heroku");
  if (configNames.some((n) => n === "wrangler.toml")) frameworks.push("Cloudflare Workers");
  if (configNames.some((n) => n === "deno.json" || n === "deno.jsonc")) frameworks.push("Deno Deploy");
  if (allContent.includes("aws-lambda") || allContent.includes("@aws-cdk/aws-lambda")) frameworks.push("AWS Lambda");
  if (allContent.includes("azure-functions") || configNames.some((n) => n === "host.json")) frameworks.push("Azure Functions");
  if (allContent.includes("@google-cloud/functions")) frameworks.push("Google Cloud Functions");

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSERVABILITY / MONITORING
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "prometheus.yml" || n === "prometheus.yaml")) frameworks.push("Prometheus");
  if (allContent.includes("grafana")) frameworks.push("Grafana");
  if (allContent.includes("datadog") || allContent.includes("dd-trace")) frameworks.push("Datadog");
  if (allContent.includes("newrelic") || allContent.includes("new relic")) frameworks.push("New Relic");
  if (allContent.includes("sentry")) frameworks.push("Sentry");
  if (allContent.includes("opentelemetry") || allContent.includes("@opentelemetry")) frameworks.push("OpenTelemetry");
  if (allContent.includes("jaeger")) frameworks.push("Jaeger");
  if (allContent.includes("zipkin")) frameworks.push("Zipkin");
  if (allContent.includes("elastic-apm") || allContent.includes("elasticapm")) frameworks.push("Elastic APM");
  if (allContent.includes("logstash")) frameworks.push("Logstash");
  if (allContent.includes("fluentd") || allContent.includes("fluent-bit")) frameworks.push("Fluentd");
  if (allContent.includes("loki")) frameworks.push("Grafana Loki");
  if (allContent.includes("splunk")) frameworks.push("Splunk");
  if (allContent.includes("pagerduty")) frameworks.push("PagerDuty");

  // ═══════════════════════════════════════════════════════════════════════════
  // API / DOCUMENTATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (configNames.some((n) => n === "openapi.yaml" || n === "openapi.json" || n === "swagger.yaml" || n === "swagger.json")) {
    frameworks.push("OpenAPI/Swagger");
  }
  if (allContent.includes("graphql") && !frameworks.includes("GraphQL")) frameworks.push("GraphQL");
  if (allContent.includes("grpc") || allFilePaths.some((p) => p.endsWith(".proto"))) frameworks.push("gRPC");
  if (allContent.includes("asyncapi")) frameworks.push("AsyncAPI");
  if (allContent.includes("postman")) frameworks.push("Postman");

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION / SECURITY
  // ═══════════════════════════════════════════════════════════════════════════
  if (allContent.includes("auth0")) frameworks.push("Auth0");
  if (allContent.includes("keycloak")) frameworks.push("Keycloak");
  if (allContent.includes("okta")) frameworks.push("Okta");
  if (allContent.includes("clerk")) frameworks.push("Clerk");
  if (allContent.includes("next-auth") || allContent.includes("nextauth")) frameworks.push("NextAuth.js");
  if (allContent.includes("passport")) frameworks.push("Passport.js");
  if (allContent.includes("oauth2") || allContent.includes("oauth 2")) frameworks.push("OAuth 2.0");
  if (allContent.includes("jsonwebtoken") || allContent.includes("jwt")) frameworks.push("JWT");
  if (allContent.includes("vault") && allContent.includes("hashicorp")) frameworks.push("HashiCorp Vault");

  return [...new Set(frameworks)];
}

// Directories that are not real services (test fixtures, examples, internal modules, backups)
const NON_SERVICE_DIRS = new Set([
  // Test directories
  "test", "tests", "__tests__", "spec", "specs", "e2e", "cypress", "playwright",
  // Examples and demos
  "example", "examples", "sample", "samples", "demo", "demos",
  // Test fixtures
  "fixture", "fixtures", "mock", "mocks", "stub", "stubs", "testdata",
  // Documentation
  "doc", "docs", "documentation",
  // Scripts and tools
  "script", "scripts", "bin", "tools", "util", "utils",
  // Configuration
  "config", "configs", "configuration", "settings",
  // Vendor/third-party
  "lib", "libs", "vendor", "third-party", "third_party", "external",
  // Build output
  "generated", "gen", "build", "dist", "out", "output", "target", ".next", ".nuxt",
  // Assets
  "resources", "assets", "static", "public", "images", "fonts", "icons",
  // Java/JVM package structure (not services)
  "src", "main", "java", "kotlin", "scala", "groovy",
  "com", "org", "net", "io", "br", "us", "uk", "de", "fr", "pt",
  // Backups and archives
  "backup", "backups", "bak", "old", "archive", "archives", "deprecated", "legacy",
  "temp", "tmp", "cache", ".cache",
  // IDE and editor
  ".idea", ".vscode", ".vs", ".settings",
  // Version control
  ".git", ".svn", ".hg",
]);

const MAX_SERVICE_DEPTH = 2; // Only look at direct children or one level nested (e.g., packages/api/)

// Patterns that suggest a directory is a library, not a deployable service
const LIBRARY_NAME_PATTERNS = [
  "lib", "libs", "library", "common", "shared", "core", "utils", "helpers",
  "sdk", "client", "types", "models", "dto", "entities", "interfaces",
  "contracts", "protocol", "proto", "schema", "schemas", "domain",
  "internal", "pkg", "packages", "modules"
];

// Patterns that suggest a backend service
const BACKEND_NAME_PATTERNS = [
  "api", "backend", "server", "service", "svc", "microservice",
  "gateway", "proxy", "worker", "job", "jobs", "scheduler", "cron",
  "batch", "processor", "handler", "consumer", "producer",
  "auth", "authentication", "identity", "iam",
  "notification", "notifications", "email", "messaging", "sms",
  "payment", "billing", "checkout", "order", "orders",
  "user", "users", "account", "accounts", "profile", "profiles",
  "inventory", "catalog", "product", "products",
  "search", "indexer", "recommendation", "analytics", "reporting",
  "admin", "administration", "backoffice", "cms",
  "integration", "sync", "connector", "adapter", "bridge",
  "orchestrator", "coordinator", "saga"
];

// Patterns that suggest a frontend service
const FRONTEND_NAME_PATTERNS = [
  "web", "webapp", "website", "frontend", "front-end", "client",
  "ui", "dashboard", "portal", "console", "panel", "admin-ui",
  "spa", "pwa", "landing", "marketing", "storefront", "shop",
  "app", "application"
];

// Patterns that suggest a mobile service
const MOBILE_NAME_PATTERNS = [
  "mobile", "ios", "android", "native", "rn", "react-native", "flutter",
  "cordova", "capacitor", "ionic", "expo"
];

// Patterns that suggest infrastructure/devops
const INFRA_NAME_PATTERNS = [
  "infra", "infrastructure", "terraform", "pulumi", "cdk", "cloudformation",
  "k8s", "kubernetes", "helm", "docker", "compose", "deploy", "deployment",
  "ci", "cd", "pipeline", "build", "release"
];

function detectServices(
  projectPath: string,
  allFiles: Array<{ path: string; size: number; ext: string }>,
  configFiles: Record<string, string>
): { services: Array<{ name: string; path: string; type: "backend" | "frontend" | "mobile" | "library" | "unknown"; language: string }>; totalCount: number } {
  const allServices: Array<{ name: string; path: string; type: "backend" | "frontend" | "mobile" | "library" | "unknown"; language: string }> = [];
  const manifestFiles = allFiles.filter((f) => SERVICE_MANIFEST_FILES.has(path.basename(f.path)));

  // Group by directory (excluding root)
  const byDir: Record<string, string[]> = {};
  for (const f of manifestFiles) {
    const rel = path.relative(projectPath, f.path);
    const dir = path.dirname(rel);
    
    // Skip root-level manifests
    if (dir === ".") continue;
    
    // Only consider first MAX_SERVICE_DEPTH levels
    const depth = dir.split(path.sep).length;
    if (depth > MAX_SERVICE_DEPTH) continue;
    
    // Skip non-service directories
    const dirParts = dir.split(path.sep);
    if (dirParts.some((part) => NON_SERVICE_DIRS.has(part.toLowerCase()))) continue;
    
    if (!byDir[dir]) byDir[dir] = [];
    byDir[dir].push(path.basename(f.path));
  }

  for (const [dir, manifests] of Object.entries(byDir)) {
    const serviceName = path.basename(dir);
    const servicePath = path.join(projectPath, dir);
    const nameLower = serviceName.toLowerCase();

    // Skip if the directory name looks like a non-service
    if (NON_SERVICE_DIRS.has(nameLower)) continue;

    // Detect type and language based on manifest files
    let type: "backend" | "frontend" | "mobile" | "library" | "unknown" = "unknown";
    let language = "Unknown";

    // Check for library patterns first
    const isLikelyLibrary = LIBRARY_NAME_PATTERNS.some((p) => nameLower.includes(p));

    if (manifests.includes("pom.xml") || manifests.includes("build.gradle")) {
      language = "Java";
      // Check if it's a library by looking for common patterns
      type = isLikelyLibrary ? "library" : "backend";
    } else if (manifests.includes("go.mod")) {
      language = "Go";
      type = isLikelyLibrary ? "library" : "backend";
    } else if (manifests.includes("Cargo.toml")) {
      language = "Rust";
      type = isLikelyLibrary ? "library" : "backend";
    } else if (manifests.includes("requirements.txt") || manifests.includes("pyproject.toml")) {
      language = "Python";
      type = isLikelyLibrary ? "library" : "backend";
    } else if (manifests.includes("pubspec.yaml")) {
      type = "mobile";
      language = "Dart (Flutter)";
    } else if (manifests.includes("package.json")) {
      // Check package.json content for library indicators
      const pkgJsonPath = Object.keys(configFiles).find((p) => 
        p.includes(dir) && p.endsWith("package.json")
      );
      const pkgContent = pkgJsonPath ? configFiles[pkgJsonPath] : "";
      const hasMainExport = pkgContent.includes('"main"') || pkgContent.includes('"exports"');
      const hasBin = pkgContent.includes('"bin"');
      const hasStartScript = pkgContent.includes('"start"');
      
      // Check if frontend or backend Node.js
      const dirFiles = allFiles.filter((f) => f.path.startsWith(servicePath));
      const hasTsx = dirFiles.some((f) => f.ext === ".tsx" || f.ext === ".jsx");
      const hasVue = dirFiles.some((f) => f.ext === ".vue");
      const hasSvelte = dirFiles.some((f) => f.ext === ".svelte");

      if (hasTsx || hasVue || hasSvelte) {
        type = "frontend";
        language = hasTsx ? "TypeScript (React)" : hasVue ? "Vue" : "Svelte";
      } else if (isLikelyLibrary || (hasMainExport && !hasBin && !hasStartScript)) {
        type = "library";
        language = "TypeScript/JavaScript";
      } else {
        type = "backend";
        language = "Node.js";
      }
    }
    
    // Use service name patterns as hints for type detection
    if (type === "unknown" || type === "backend") {
      // Check if it matches frontend patterns (override backend if detected via package.json without framework)
      const matchesFrontend = FRONTEND_NAME_PATTERNS.some((p) => nameLower.includes(p));
      const matchesMobile = MOBILE_NAME_PATTERNS.some((p) => nameLower.includes(p));
      const matchesBackend = BACKEND_NAME_PATTERNS.some((p) => nameLower.includes(p));
      const matchesInfra = INFRA_NAME_PATTERNS.some((p) => nameLower.includes(p));
      
      if (matchesMobile && type === "unknown") {
        type = "mobile";
      } else if (matchesFrontend && !matchesBackend && type === "unknown") {
        type = "frontend";
      } else if (matchesBackend) {
        type = "backend";
      } else if (matchesInfra) {
        type = "library"; // Infrastructure code is more like a library/tooling
      }
    }
    
    // If still unknown and not a library pattern, default to backend (most common)
    if (type === "unknown" && !isLikelyLibrary) {
      type = "backend";
    }

    allServices.push({ name: serviceName, path: dir, type, language });
  }

  // Return all detected services (no artificial limits)
  return { services: allServices, totalCount: allServices.length };
}

function detectStack(
  projectPath: string,
  allFiles: Array<{ path: string; size: number; ext: string }>,
  configFiles: Record<string, string>
): DetectedStack {
  const languages = detectLanguages(allFiles);
  const frameworks = detectFrameworks(configFiles, allFiles);
  const { services, totalCount: totalServiceCount } = detectServices(projectPath, allFiles, configFiles);

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
    totalServiceCount,
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
