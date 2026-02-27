import { callAgent } from "../../client.js";
import type {
  AgentResult,
  OrchestratorDecision,
  ProjectSnapshot,
  SpecialistRole,
} from "../../types/index.js";

const AGENT_NAME = "Orchestrator";

const MODEL_MAX_TOKENS = 3000;

// ─── Specialists catalog ──────────────────────────────────────────────────────

const SPECIALISTS_CATALOG = `
- **radar**: Real-Time Research & Validation — validates technologies, versions, libs, 2026 trends, best practices
- **engine**: Deep Logic & Programming — algorithms, debugging, optimization, edge cases, clean code
- **canvas**: Creativity, UX & Product Strategy — user flows, UI, product strategy, user stories
- **product-owner**: Product Owner — requirements, prioritization, acceptance criteria
- **business-analyst**: Business Analyst — processes, business rules, operational flows
- **software-architect**: Software Architect — system architecture, C4 diagrams, technical decisions
- **backend-dev**: Senior Backend Developer — REST/GraphQL APIs, database, authentication, server logic
- **frontend-dev**: Senior Frontend Developer — Next.js 15, React, TypeScript, Tailwind, performance, accessibility
- **mobile-dev**: Senior Mobile Developer — React Native, Flutter, iOS/Android, mobile UX
- **devops**: DevOps Engineer — Docker, CI/CD, Kubernetes, IaC, observability, monitoring
- **security**: Security Engineer — OWASP, secure auth, pentest, compliance, secrets management
- **qa**: QA Engineer — unit, integration, E2E testing, coverage, automation
- **tech-writer**: Technical Writer — README, Swagger/OpenAPI, user docs, guides
- **ai-ml**: AI/ML Specialist — LLM integration, embeddings, RAG, ML pipelines
- **performance**: Performance Engineer — profiling, caching, CDN, query optimization, scalability
`.trim();

// ─── Phase 1: Decision — which specialists to activate ───────────────────────

const PHASE1_SYSTEM_PROMPT = `You are the Main Orchestrator of Jay Crew — the ultimate leader of a team of specialized AI agents.

**Identity:** Tech Lead with 15+ years of experience at startups and big tech companies. 360° vision. Prioritizes efficiency, quality, and what the user ACTUALLY needs.

**Your mission in this phase:** Analyze the user's request and the target project snapshot, then decide which team specialists need to be activated to perform a thorough X-Ray.

**Available specialists:**
${SPECIALISTS_CATALOG}

**Decision rules:**
- Activate ONLY the specialists needed for the specific request
- Minimum: 2 specialists. Maximum: 8 specialists
- Always consider dependencies (e.g., auth → backend-dev + security)
- For full web projects: software-architect + backend-dev + frontend-dev
- For general analysis: software-architect + engine + radar
- Prefer quality over quantity

**REQUIRED response format:**

## Request Analysis
[Concise and insightful analysis of what the user needs, identifying the real nature of the problem]

## Activated Specialists
\`\`\`json
["role1", "role2", ...]
\`\`\`

## Reasoning
[Why these specialists were chosen and how each one contributes]

## Initial Task Breakdown
[High-level list of main tasks identified, without going into technical details]`;

export async function runOrchestratorPhase1(
  snapshot: ProjectSnapshot,
  userRequest: string,
  forceSpecialists?: SpecialistRole[]
): Promise<{ decision: OrchestratorDecision; result: AgentResult }> {
  if (forceSpecialists && forceSpecialists.length > 0) {
    const result: AgentResult = {
      success: true,
      data: `## User-Specified Specialists\n\nUsing provided specialists: ${forceSpecialists.join(", ")}`,
      agentName: AGENT_NAME,
      durationMs: 0,
    };
    return {
      decision: { activatedSpecialists: forceSpecialists, rawResponse: result.data },
      result,
    };
  }

  const userMessage = `## Target Project: ${snapshot.projectName}
- Files: ${snapshot.stats.totalFiles}
- Detected entry points: ${snapshot.entryPoints.length}
- Config files found: ${Object.keys(snapshot.configFiles).join(", ") || "none"}
- Dependency files: ${Object.keys(snapshot.depFiles).join(", ") || "none"}

**User request:**
${userRequest}

Analyze this request and the project, then decide which specialists to activate.`;

  const result = await callAgent({
    agentName: AGENT_NAME,
    systemPrompt: PHASE1_SYSTEM_PROMPT,
    userMessage,
    maxTokens: MODEL_MAX_TOKENS,
  });

  const activatedSpecialists = extractSpecialistsFromResponse(result.data);

  return {
    decision: { activatedSpecialists, rawResponse: result.data },
    result,
  };
}

function extractSpecialistsFromResponse(response: string): SpecialistRole[] {
  const match = response.match(/```json\s*(\[[\s\S]*?\])\s*```/);
  if (!match) {
    console.warn("[Orchestrator] Could not extract specialists from JSON. Using fallback.");
    return ["software-architect", "engine"];
  }
  try {
    return JSON.parse(match[1]) as SpecialistRole[];
  } catch {
    return ["software-architect", "engine"];
  }
}

// ─── Phase 2: Synthesis — detailed execution plan ─────────────────────────────

const PHASE2_SYSTEM_PROMPT = `You are the Main Orchestrator of Jay Crew.

**Your mission in this phase:** Synthesize the X-Ray reports from all activated specialists into a detailed, coherent, and actionable Execution Plan.

**Critical rules:**
- Do NOT simply concatenate the reports. SYNTHESIZE them into a unified narrative.
- Resolve contradictions between specialists using your best judgment.
- Identify dependencies BETWEEN tasks from different specialists.
- Prioritize by impact and logical implementation sequence.
- The plan must be executable: who does what, in what order, with what dependencies.
- Respond in English, organized, professional, and actionable.

**REQUIRED sections (in this order):**

1. **Executive Summary** — What will be done, why, expected impact
2. **Specialist Diagnostics** — Table with specialist | key findings | priority
3. **Implementation Roadmap** — Ordered phases with specific tasks and owner
4. **Dependency Map** — What needs to be done before what
5. **Risks & Mitigations** — Top 3–5 identified risks and how to mitigate
6. **Recommended Stack** — Technologies and tools recommended by specialists
7. **Immediate Next Steps** — The first 3–5 concrete actions to get started`;

export async function runOrchestratorPhase2(
  snapshot: ProjectSnapshot,
  userRequest: string,
  phase1Response: string,
  xrayResults: AgentResult[]
): Promise<AgentResult> {
  const xraySection = xrayResults
    .filter((r) => r.success)
    .map((r) => `\n---\n## X-Ray: ${r.agentName}\n\n${r.data}`)
    .join("\n");

  const failedAgents = xrayResults
    .filter((r) => !r.success)
    .map((r) => r.agentName);

  const userMessage = `## Project: ${snapshot.projectName}

**Original Request:**
${userRequest}

**Orchestrator Initial Analysis (Phase 1):**
${phase1Response}

**Specialist X-Ray Reports:**
${xraySection}
${failedAgents.length > 0 ? `\n_Specialists that failed (partial data): ${failedAgents.join(", ")}_` : ""}

Synthesize all reports above into a complete and actionable Execution Plan.`;

  return callAgent({
    agentName: AGENT_NAME,
    systemPrompt: PHASE2_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 4096,
  });
}
