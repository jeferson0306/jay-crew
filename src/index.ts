import fs from "node:fs/promises";
import path from "node:path";
import { buildProjectSnapshot } from "./tools/project-scanner.js";
import { resolveProjectPath } from "./tools/path-utils.js";
import { runOrchestratorPhase1, runOrchestratorPhase2 } from "./agents/core/orchestrator.js";
import { REGISTRY, VALID_ROLES } from "./agents/registry.js";
import type { AgentResult, SpecialistRole } from "./types/index.js";

// ─── Load .env if present ─────────────────────────────────────────────────────

async function loadEnv(): Promise<void> {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env not found — no problem
  }
}

// ─── CLI argument parsing ─────────────────────────────────────────────────────

interface CliArgs {
  projectPath: string;
  userRequest: string;
  specificSpecialists?: SpecialistRole[];
}

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
  --project,     -p <path>   Path to the target project (default: current directory)
  --specialists, -s <list>   Comma-separated list of specific specialists to activate
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

// ─── Progress logging ─────────────────────────────────────────────────────────

function log(emoji: string, message: string): void {
  console.log(`${emoji}  ${message}`);
}

function logTiming(label: string, ms: number): void {
  console.log(`   ↳ ${label}: ${(ms / 1000).toFixed(1)}s`);
}

// ─── Main flow ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await loadEnv();

  const { projectPath, userRequest, specificSpecialists } = parseArgs();

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║         JAY CREW — Multi-Agent AI Team          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  log("📁", `Project: ${projectPath}`);
  log("💬", `Request: "${userRequest}"`);
  console.log("");

  // ── Phase 0: Scan target project ─────────────────────────────────────────────
  log("🔍", "Scanning target project...");
  const scanStart = Date.now();
  const snapshot = await buildProjectSnapshot(projectPath);
  logTiming(`${snapshot.stats.totalFiles} files scanned`, Date.now() - scanStart);
  console.log("");

  // ── Phase 1: Orchestrator decides specialists ─────────────────────────────────
  log("🧠", "Orchestrator analyzing request...");
  const phase1Start = Date.now();
  const { decision, result: phase1Result } = await runOrchestratorPhase1(
    snapshot,
    userRequest,
    specificSpecialists
  );

  if (!phase1Result.success) {
    console.error("Orchestrator error (phase 1):", phase1Result.error);
    process.exit(1);
  }

  logTiming("decision made", Date.now() - phase1Start);
  log("✅", `Activated specialists: ${decision.activatedSpecialists.join(", ")}`);
  console.log("");

  // ── Phase 2: Parallel X-Ray ───────────────────────────────────────────────────
  const activeSpecialists = decision.activatedSpecialists.filter(
    (role) => role in REGISTRY
  );

  log("⚡", `Running X-Ray with ${activeSpecialists.length} specialist(s) in parallel...`);
  const phase2Start = Date.now();

  const xrayResults: AgentResult[] = await Promise.all(
    activeSpecialists.map((role) => {
      log("  →", `${role}...`);
      return REGISTRY[role](snapshot, userRequest);
    })
  );

  const successCount = xrayResults.filter((r) => r.success).length;
  logTiming(
    `${successCount}/${xrayResults.length} specialists completed`,
    Date.now() - phase2Start
  );
  console.log("");

  // ── Phase 3: Synthesis — execution plan ──────────────────────────────────────
  log("📊", "Orchestrator synthesizing analyses into execution plan...");
  const phase3Start = Date.now();
  const finalPlan = await runOrchestratorPhase2(
    snapshot,
    userRequest,
    phase1Result.data,
    xrayResults
  );

  logTiming("synthesis complete", Date.now() - phase3Start);
  console.log("");

  if (!finalPlan.success) {
    console.error("Orchestrator synthesis error:", finalPlan.error);
    process.exit(1);
  }

  // ── Phase 4: Save plan ────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputFile = `crew-plan-${timestamp}.md`;

  const fullReport = buildFullReport(
    snapshot.projectName,
    userRequest,
    decision.activatedSpecialists,
    phase1Result.data,
    xrayResults,
    finalPlan.data
  );

  await fs.writeFile(outputFile, fullReport, "utf8");

  log("✅", `Plan saved to: ${outputFile}`);

  // ── Timing summary ────────────────────────────────────────────────────────────
  const totalMs = xrayResults.reduce((sum, r) => sum + r.durationMs, 0) + finalPlan.durationMs;
  const parallelMs = Math.max(...xrayResults.map((r) => r.durationMs), 0) + finalPlan.durationMs;
  const saved = totalMs - parallelMs;

  console.log("");
  console.log("─────────────────────────────────────────────────");
  console.log(`⏱  Total API time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`⚡ Executed in parallel: ${(parallelMs / 1000).toFixed(1)}s`);
  if (saved > 1000) {
    console.log(`💡 Saved by parallelism: ~${(saved / 1000).toFixed(1)}s`);
  }
  console.log("─────────────────────────────────────────────────\n");
}

// ─── Full report assembler ────────────────────────────────────────────────────

function buildFullReport(
  projectName: string,
  userRequest: string,
  specialists: SpecialistRole[],
  phase1Analysis: string,
  xrayResults: AgentResult[],
  finalPlan: string
): string {
  const timestamp = new Date().toISOString();

  const xraySection = xrayResults
    .map((r) => {
      if (!r.success) {
        return `---\n\n## ❌ ${r.agentName} — FAILED\n\nError: ${r.error ?? "unknown"}\n`;
      }
      return `---\n\n${r.data}\n\n_⏱ ${(r.durationMs / 1000).toFixed(1)}s_\n`;
    })
    .join("\n");

  return `# Jay Crew — Execution Plan
> Project: **${projectName}** · Generated: ${timestamp}

## Request
> ${userRequest}

## Activated Specialists
${specialists.map((s) => `- \`${s}\``).join("\n")}

---

# Orchestrator Analysis (Phase 1)

${phase1Analysis}

---

# Specialist X-Ray Reports

${xraySection}

---

# Execution Plan — Final Synthesis

${finalPlan}
`;
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("\nFatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
