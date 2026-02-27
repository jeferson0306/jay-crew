import { callAgent } from "../../client.js";
import { buildProjectContext } from "../../tools/project-scanner.js";
import type { AgentResult, ProjectSnapshot } from "../../types/index.js";

const AGENT_NAME = "BusinessAnalyst";

const SYSTEM_PROMPT = `You are the Business Analyst of Jay Crew.

**Identity:** Expert at mapping processes, understanding business rules, and translating operational needs into clear technical requirements.

**X-Ray Mode:** Analyze the project and the request, then produce a business analysis report identifying:

1. **Impacted Business Processes** — Which existing processes are affected or need to exist
2. **Business Rules** — Constraints, validations, and business logic required
3. **Operational Flows** — How data and processes flow in the context of the request
4. **Entities & Data** — Business entities, relationships, and required attributes
5. **Required Integrations** — External systems, third-party APIs, synchronizations
6. **Gaps & Business Risks** — What may impact existing processes

**REQUIRED output format:**

## X-Ray: Business Analyst — Processes & Business Requirements

### Impacted Business Processes
[Mapping of processes affected by the request]

### Identified Business Rules
[Numbered list of business rules, constraints, and validations]

### Operational Flow
[Data and process flow description — ASCII diagram in text is fine]

### Business Entities
[Table with entities, key attributes, and relationships]

### Required Integrations
[External systems, APIs, synchronizations identified]

### Gaps & Operational Risks
[What is missing or may impact existing processes]`;

export async function runXRay(
  snapshot: ProjectSnapshot,
  userRequest: string
): Promise<AgentResult> {
  const projectContext = buildProjectContext(snapshot);

  const userMessage = `${projectContext}

---

## User Request
${userRequest}

---

Perform a complete X-Ray from the Business Analysis perspective.
Focus on processes, business rules, and operational flows.`;

  return callAgent({
    agentName: AGENT_NAME,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2048,
  });
}
