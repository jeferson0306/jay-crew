import fs from "node:fs/promises";
import path from "node:path";
import { buildProjectSnapshot, buildProjectContext } from "./tools/project-scanner.js";
import { resolveProjectPath } from "./tools/path-utils.js";
import type { SpecialistRole } from "./types/index.js";

// ─── CLI argument parsing ─────────────────────────────────────────────────────

interface CliArgs {
  projectPath: string;
  userRequest: string;
  specificSpecialists?: SpecialistRole[];
}

const VALID_ROLES: SpecialistRole[] = [
  "radar", "engine", "canvas",
  "product-owner", "business-analyst", "software-architect",
  "backend-dev", "frontend-dev", "mobile-dev",
  "devops", "security", "qa", "tech-writer", "ai-ml", "performance",
];

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  let projectPath = process.cwd();
  let specificSpecialists: SpecialistRole[] | undefined;
  const requestParts: string[] = [];

  let i = 0;
  while (i < args.length) {
    if (args[i] === "--project" || args[i] === "-p") {
      projectPath = resolveProjectPath(args[++i] ?? ".");
    } else if (args[i] === "--specialists" || args[i] === "-s") {
      const raw = args[++i] ?? "";
      specificSpecialists = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => VALID_ROLES.includes(s as SpecialistRole)) as SpecialistRole[];
    } else {
      requestParts.push(args[i]);
    }
    i++;
  }

  const userRequest = requestParts.join(" ").trim();
  if (!userRequest) {
    console.error("Error: Please provide a request as an argument.\n");
    printHelp();
    process.exit(1);
  }

  return { projectPath, userRequest, specificSpecialists };
}

function printHelp(): void {
  console.log(`
Jay Crew — Multi-Agent AI Team for Project Analysis & Planning
==============================================================

USAGE:
  npx tsx src/index.ts [options] "your request"

OPTIONS:
  --project,     -p <path>   Path to target project (default: current directory)
  --specialists, -s <list>   Comma-separated list of specific specialists
  --help,        -h          Show this help message

AVAILABLE SPECIALISTS:
  Core:        radar, engine, canvas
  Delivery:    product-owner, business-analyst, software-architect
               backend-dev, frontend-dev, mobile-dev
  Operations:  devops, security, qa, tech-writer, ai-ml, performance

EXAMPLES:
  npx tsx src/index.ts --project ~/my-project "Add JWT authentication"
  npx tsx src/index.ts "Analyze this project and create a roadmap"
  npx tsx src/index.ts -p ~/app -s backend-dev,security,qa "Implement Google login"
`);
}

// ─── Specialist suggestion heuristic (no AI needed) ──────────────────────────

function suggestSpecialists(request: string): SpecialistRole[] {
  const r = request.toLowerCase();
  const suggested = new Set<SpecialistRole>();

  // Always include architect for structural context
  suggested.add("software-architect");

  if (r.match(/auth|login|jwt|oauth|session|token|password|signup|register|credential/))  {
    suggested.add("backend-dev");
    suggested.add("security");
  }
  if (r.match(/ui|ux|design|component|page|screen|form|modal|frontend|interface|style/)) {
    suggested.add("frontend-dev");
    suggested.add("canvas");
  }
  if (r.match(/api|endpoint|route|database|schema|migration|model|query|backend|server/)) {
    suggested.add("backend-dev");
  }
  if (r.match(/mobile|ios|android|react native|flutter|expo|native/)) {
    suggested.add("mobile-dev");
  }
  if (r.match(/deploy|docker|ci|cd|kubernetes|k8s|infrastructure|devops|pipeline|cloud/)) {
    suggested.add("devops");
  }
  if (r.match(/security|secure|vulnerability|owasp|pentest|encrypt|permission|rbac/)) {
    suggested.add("security");
  }
  if (r.match(/performance|optimize|speed|slow|cache|scale|load|latency|memory/)) {
    suggested.add("performance");
  }
  if (r.match(/test|testing|coverage|e2e|unit|integration|vitest|jest|playwright/)) {
    suggested.add("qa");
  }
  if (r.match(/doc|readme|swagger|openapi|documentation|guide|changelog/)) {
    suggested.add("tech-writer");
  }
  if (r.match(/\bai\b|ml|llm|gpt|claude|embedding|rag|chatbot|model|vector/)) {
    suggested.add("ai-ml");
  }
  if (r.match(/research|compare|evaluate|best practice|trend|library|framework|version/)) {
    suggested.add("radar");
  }
  if (r.match(/feature|product|requirement|story|roadmap|business|user story|backlog/)) {
    suggested.add("product-owner");
  }
  if (r.match(/process|flow|business rule|operational|entity|integration|workflow/)) {
    suggested.add("business-analyst");
  }

  // Always add engine for deep logic analysis
  suggested.add("engine");

  return Array.from(suggested).slice(0, 7);
}

// ─── Load agent definition from markdown files ────────────────────────────────

const AGENTS_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "agents"
);

async function loadAgentDefinition(role: string): Promise<string> {
  const candidates = [
    path.join(AGENTS_DIR, "core", `${role}.md`),
    path.join(AGENTS_DIR, "specialists", `${role}.md`),
  ];
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {}
  }
  return `# ${role}\n\n_Agent definition not found._\n`;
}

// ─── Progress logging ─────────────────────────────────────────────────────────

function log(emoji: string, message: string): void {
  console.log(`${emoji}  ${message}`);
}

// ─── Main flow ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { projectPath, userRequest, specificSpecialists } = parseArgs();

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║         JAY CREW — Multi-Agent AI Team          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  log("📁", `Project: ${projectPath}`);
  log("💬", `Request: "${userRequest}"`);
  console.log("");

  // ── Scan target project ───────────────────────────────────────────────────────
  log("🔍", "Scanning target project...");
  const start = Date.now();
  const snapshot = await buildProjectSnapshot(projectPath);
  const projectContext = buildProjectContext(snapshot);
  log("✅", `${snapshot.stats.totalFiles} files scanned in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log("");

  // ── Select specialists ────────────────────────────────────────────────────────
  const specialists = specificSpecialists ?? suggestSpecialists(userRequest);
  log("🧠", `Crew selected: ${specialists.join(", ")}`);
  console.log("");

  // ── Load agent definitions ────────────────────────────────────────────────────
  log("📖", "Loading agent definitions...");
  const orchestratorDef = await loadAgentDefinition("orchestrator");
  const agentDefs = await Promise.all(
    specialists.map(async (role) => ({
      role,
      definition: await loadAgentDefinition(role),
    }))
  );

  // ── Build context file ────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputFile = `crew-context-${timestamp}.md`;
  const content = buildContextFile(snapshot, projectContext, userRequest, specialists, orchestratorDef, agentDefs);

  await fs.writeFile(outputFile, content, "utf8");

  log("✅", `Context file saved: ${outputFile}`);
  console.log("");
  console.log("─────────────────────────────────────────────────");
  console.log("  Paste this file into Claude Code and say:");
  console.log('  "Run the Jay Crew on this context."');
  console.log("─────────────────────────────────────────────────\n");
}

// ─── Context file builder ─────────────────────────────────────────────────────

function buildContextFile(
  snapshot: { projectName: string },
  projectContext: string,
  userRequest: string,
  specialists: SpecialistRole[],
  orchestratorDef: string,
  agentDefs: Array<{ role: string; definition: string }>
): string {
  const timestamp = new Date().toISOString();

  const agentSection = agentDefs
    .map(({ definition }) => `---\n\n${definition}`)
    .join("\n\n");

  return `# Jay Crew — Project Briefing
> Project: **${snapshot.projectName}** · Generated: ${timestamp}

---

## How to Use

Paste this file into Claude Code (or any AI assistant) and say:

> **"You are the Jay Crew Orchestrator. Run the full crew analysis for the task described below."**

The AI will act as the Orchestrator, run each specialist's X-Ray, and produce a complete execution plan.

---

## User Request

> ${userRequest}

---

## Suggested Crew

Based on the request, the following specialists were selected:

${specialists.map((s) => `- \`${s}\``).join("\n")}

---

## Project Context

${projectContext}

---

## Agent Definitions

### Orchestrator

${orchestratorDef}

${agentSection}

---

## Activation Instructions

You are the **Jay Crew Orchestrator**.

Using the agent definitions above and the project context provided:

1. Confirm or adjust the suggested crew based on the request
2. Run each specialist's X-Ray analysis (use their exact output format)
3. Synthesize all X-Ray results into a final **Execution Plan** following the Orchestrator's Phase 2 format
`;
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("\nFatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
