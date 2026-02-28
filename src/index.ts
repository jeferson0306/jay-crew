import fs from "node:fs/promises";
import path from "node:path";
import { buildProjectSnapshot, buildProjectContext } from "./tools/project-scanner.js";
import { resolveProjectPath } from "./tools/path-utils.js";
import type { PersonaRole, SpecialistRole } from "./types/index.js";

// ─── CLI argument parsing ─────────────────────────────────────────────────────

interface CliArgs {
  projectPath: string;
  userRequest: string;
  specificSpecialists?: SpecialistRole[];
  persona?: PersonaRole;
}

const VALID_ROLES: SpecialistRole[] = [
  "radar", "engine", "canvas",
  "product-owner", "business-analyst", "software-architect",
  "backend-dev", "frontend-dev", "mobile-dev",
  "devops", "security", "qa", "tech-writer", "ai-ml", "performance",
  "data-engineer",
];

const VALID_PERSONAS: PersonaRole[] = [
  "new-dev", "senior-dev", "tech-migrator",
  "task-executor", "tech-lead", "due-diligence",
];

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  let projectPath = process.cwd();
  let specificSpecialists: SpecialistRole[] | undefined;
  let persona: PersonaRole | undefined;
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
    } else if (args[i] === "--persona" || args[i] === "-r") {
      const raw = (args[++i] ?? "").trim() as PersonaRole;
      if (VALID_PERSONAS.includes(raw)) {
        persona = raw;
      } else {
        console.error(`Warning: Unknown persona "${raw}". Valid values: ${VALID_PERSONAS.join(", ")}\n`);
      }
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

  return { projectPath, userRequest, specificSpecialists, persona };
}

function printHelp(): void {
  console.log(`
Jay Crew — Multi-Agent AI Team for Project Analysis & Planning
==============================================================

USAGE:
  npx tsx src/index.ts [options] "your request"

OPTIONS:
  --project,     -p <path>     Path to target project (default: current directory)
  --specialists, -s <list>     Comma-separated list of specific specialists
  --persona,     -r <persona>  Persona profile to shape the Orchestrator output
  --help,        -h            Show this help message

AVAILABLE SPECIALISTS:
  Core:        radar, engine, canvas
  Delivery:    product-owner, business-analyst, software-architect
               backend-dev, frontend-dev, mobile-dev
  Operations:  devops, security, qa, tech-writer, ai-ml, performance
  Data:        data-engineer

AVAILABLE PERSONAS:
  new-dev        Guided, educational, step-by-step explanations for newcomers
  senior-dev     Concise and technical — patterns, tradeoffs, edge cases
  tech-migrator  Migration planning — current→target state, phased strategy
  task-executor  Direct implementation — production-ready code, no overhead
  tech-lead      Architectural decisions, ADRs, team impact, risk assessment
  due-diligence  Risk analysis, technical debt, security, compliance signals

EXAMPLES:
  npx tsx src/index.ts --project ~/my-project "Add JWT authentication"
  npx tsx src/index.ts "Analyze this project and create a roadmap"
  npx tsx src/index.ts -p ~/app -s backend-dev,security,qa "Implement Google login"
  npx tsx src/index.ts -p ~/app --persona new-dev "Explain the authentication flow"
  npx tsx src/index.ts -p ~/app --persona tech-lead "Migrate from REST to GraphQL"
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
  if (r.match(/api|endpoint|route|backend|server|service|controller|rest|graphql|grpc/)) {
    suggested.add("backend-dev");
  }
  if (r.match(/database|schema|migration|model|query|table|sql|index|data model|etl|dw|warehouse/)) {
    suggested.add("data-engineer");
  }
  if (r.match(/mobile|ios|android|react native|flutter|expo|native app/)) {
    suggested.add("mobile-dev");
  }
  if (r.match(/deploy|docker|ci|cd|kubernetes|k8s|infrastructure|devops|pipeline|cloud|container/)) {
    suggested.add("devops");
  }
  if (r.match(/security|secure|vulnerability|owasp|pentest|encrypt|permission|rbac|cve|audit/)) {
    suggested.add("security");
  }
  if (r.match(/performance|optimize|speed|slow|cache|scale|load|latency|memory|profil/)) {
    suggested.add("performance");
  }
  if (r.match(/test|testing|coverage|e2e|unit|integration|quality|tdd|bdd/)) {
    suggested.add("qa");
  }
  if (r.match(/doc|readme|swagger|openapi|documentation|guide|changelog|api doc/)) {
    suggested.add("tech-writer");
  }
  if (r.match(/\bai\b|ml|llm|gpt|claude|embedding|rag|chatbot|vector|neural|machine learning/)) {
    suggested.add("ai-ml");
  }
  if (r.match(/research|compare|evaluate|best practice|trend|library|framework|version|upgrade|update/)) {
    suggested.add("radar");
  }
  if (r.match(/feature|product|requirement|story|roadmap|business|user story|backlog|mvp/)) {
    suggested.add("product-owner");
  }
  if (r.match(/process|flow|business rule|operational|entity|integration|workflow|domain/)) {
    suggested.add("business-analyst");
  }

  // Always add engine for deep logic analysis
  suggested.add("engine");

  return Array.from(suggested).slice(0, 7);
}

// ─── Persona-aware crew boosting ─────────────────────────────────────────────

function boostCrewByPersona(specialists: SpecialistRole[], persona?: PersonaRole): SpecialistRole[] {
  if (!persona) return specialists;

  const boosted = new Set(specialists);

  switch (persona) {
    case "due-diligence":
      // Due diligence needs security, QA, and DevOps assessment
      boosted.add("security");
      boosted.add("qa");
      boosted.add("devops");
      boosted.add("radar");
      break;

    case "tech-migrator":
      // Migration needs research on current vs target technologies
      boosted.add("radar");
      boosted.add("devops");
      break;

    case "new-dev":
      // New developers benefit from documentation
      boosted.add("tech-writer");
      break;

    case "tech-lead":
      // Tech leads need security and infrastructure perspective
      boosted.add("security");
      boosted.add("devops");
      break;

    case "senior-dev":
      // Senior devs want performance insights
      boosted.add("performance");
      break;

    case "task-executor":
      // Task executors need QA to verify implementation
      boosted.add("qa");
      break;
  }

  // Limit to 8 specialists max
  return Array.from(boosted).slice(0, 8);
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

// ─── Persona context blocks ───────────────────────────────────────────────────

function buildPersonaBlock(persona: PersonaRole): string {
  const blocks: Record<PersonaRole, string> = {
    "new-dev": `## Persona Context

**Persona: New Developer**

You are guiding a developer who is new to this codebase (and possibly new to the technology stack). Adapt the crew output to be educational and practical:

- Prefer step-by-step explanations over terse instructions
- Include context for *why* decisions are made, not just *what* to do
- Flag unfamiliar concepts with brief explanations (e.g. "A JWT is a signed token that…")
- Scaffold code examples with detailed inline comments
- Highlight common pitfalls for newcomers
- Suggest learning resources where relevant
- Break complex tasks into small, verifiable milestones`,

    "senior-dev": `## Persona Context

**Persona: Senior Developer**

You are briefing a senior engineer who values depth and precision. Tune the output accordingly:

- Skip introductory explanations — go straight to technical substance
- Highlight design tradeoffs, edge cases, and non-obvious decisions
- Reference patterns by name (CQRS, Saga, Circuit Breaker, Strangler Fig, etc.)
- Flag performance, security, and concurrency implications explicitly
- Suggest alternatives and explain why the recommended approach wins
- Keep prose minimal; prefer structured lists and code snippets
- Assume familiarity with the stack — do not explain common library APIs`,

    "tech-migrator": `## Persona Context

**Persona: Tech Migrator**

The team is migrating from one technology, framework, or architecture to another. Shape the output for migration planning:

- Map current state → target state for each affected area
- Identify breaking changes and compatibility risks
- Propose a phased migration strategy (strangler fig, feature flags, parallel run)
- Flag data migration requirements and rollback plans
- Surface deprecated APIs or patterns that must be replaced
- Estimate migration complexity per component (Low / Medium / High)
- Highlight integration points that need renegotiation with other teams`,

    "task-executor": `## Persona Context

**Persona: Task Executor**

The engineer needs to implement this feature immediately with minimal overhead. Optimize for execution speed:

- Produce production-ready code snippets, not pseudocode
- Minimize explanation — show the implementation directly
- Output tasks in dependency order (prerequisites first)
- Include exact file paths, function signatures, and test assertions
- Flag only blockers or non-obvious dependencies
- Avoid architectural debates — choose the most pragmatic option
- End each step with a concrete verification command or test`,

    "tech-lead": `## Persona Context

**Persona: Tech Lead**

You are advising a tech lead who owns the technical direction for a team. Frame the output for decision-making and communication:

- Emphasize architectural decisions and their team-wide impact
- Include ADR-style reasoning (Context / Decision / Consequences) for key choices
- Surface cross-team dependencies and integration points
- Assess risks and propose mitigations the team can discuss
- Highlight what needs review or sign-off before implementation begins
- Consider maintainability, onboarding cost, and long-term ownership
- Suggest where to create tickets, spike tasks, or design reviews`,

    "due-diligence": `## Persona Context

**Persona: Due Diligence**

This analysis is being used for technical due diligence (acquisition, audit, or compliance review). Focus on risk and quality signals:

- Assess technical debt level and its business impact
- Surface security vulnerabilities and compliance gaps (OWASP, GDPR, SOC2, HIPAA, LGPD)
- Evaluate dependency health (outdated packages, abandoned libraries, license risks)
- Identify single points of failure and operational risks
- Summarize code quality signals (test coverage, linting, documentation, CI/CD maturity)
- Estimate the engineering effort to bring the codebase to production-grade quality
- Produce a structured risk register: Risk / Severity / Likelihood / Recommended Action`,
  };

  return blocks[persona];
}

// ─── Progress logging ─────────────────────────────────────────────────────────

function log(emoji: string, message: string): void {
  console.log(`${emoji}  ${message}`);
}

// ─── Main flow ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { projectPath, userRequest, specificSpecialists, persona } = parseArgs();

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║         JAY CREW — Multi-Agent AI Team          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  log("📁", `Project: ${projectPath}`);
  log("💬", `Request: "${userRequest}"`);
  if (persona) log("🎭", `Persona: ${persona}`);
  console.log("");

  // ── Scan target project ───────────────────────────────────────────────────────
  log("🔍", "Scanning target project...");
  const start = Date.now();
  const snapshot = await buildProjectSnapshot(projectPath);
  const projectContext = buildProjectContext(snapshot);
  const m = snapshot.sourceMeta;
  const budgetKb = Math.round(m.budgetUsedBytes / 1024);
  log("✅", `${snapshot.stats.totalFiles} files scanned in ${((Date.now() - start) / 1000).toFixed(1)}s — ${m.totalInContext} files in context (${m.fullCount} full · ${m.skeletalCount} skel) · ${budgetKb} KB used`);
  console.log("");

  // ── Select specialists ────────────────────────────────────────────────────────
  let specialists = specificSpecialists ?? suggestSpecialists(userRequest);
  
  // Apply persona-based crew boosting
  specialists = boostCrewByPersona(specialists, persona);
  
  log("🧠", `Crew selected: ${specialists.join(", ")}`);
  if (persona) {
    log("🎯", `Persona "${persona}" boosted the crew with relevant specialists`);
  }
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
  const content = buildContextFile(snapshot, projectContext, userRequest, specialists, orchestratorDef, agentDefs, persona);

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
  agentDefs: Array<{ role: string; definition: string }>,
  persona?: PersonaRole
): string {
  const timestamp = new Date().toISOString();

  const agentSection = agentDefs
    .map(({ definition }) => `---\n\n${definition}`)
    .join("\n\n");

  const personaSection = persona
    ? `\n\n${buildPersonaBlock(persona)}\n`
    : "";

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
${personaSection}
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

1. **Detect the technology stack** first (languages, frameworks, databases, tools)
2. Confirm or adjust the suggested crew based on the request and detected stack
3. Run each specialist's X-Ray analysis (use their exact output format)
4. Synthesize all X-Ray results into a final **Execution Plan** following the Orchestrator's Phase 2 format
`;
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("\nFatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
