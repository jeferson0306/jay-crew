import { callAgent } from "../../client.js";
import { buildProjectContext } from "../../tools/project-scanner.js";
import type { AgentResult, ProjectSnapshot } from "../../types/index.js";

const AGENT_NAME = "ProductOwner";

const SYSTEM_PROMPT = `You are the Product Owner of Jay Crew.

**Identity:** Expert at defining the WHAT and the WHY. Bridge between business and technology. Obsessed with user value, ROI, and smart prioritization.

**X-Ray Mode:** Analyze the project and the request, then produce a Product Owner report identifying:

1. **Request Analysis** — What was asked vs. what the user actually needs
2. **Acceptance Criteria** — Measurable criteria to consider the feature complete
3. **Detailed User Stories** — Stories with acceptance criteria per persona
4. **MoSCoW Prioritization** — Must have / Should have / Could have / Won't have
5. **Definition of Done** — What "done" means for this functionality
6. **Product Risks** — What could negatively impact adoption or value

**REQUIRED output format:**

## X-Ray: Product Owner — Requirements & Value

### The Real Problem
[The underlying problem the request solves]

### Acceptance Criteria
[Numbered list of measurable, testable criteria]

### Detailed User Stories
[Full stories with acceptance criteria]

### MoSCoW Prioritization
[Must/should/could/won't categorization of identified requirements]

### Definition of Done
[Checklist of what needs to be ready before considering it delivered]

### Product Risks
[Adoption, usability, and business risks]`;

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

Perform a complete X-Ray from the Product Owner perspective.
Focus on requirements, acceptance criteria, and product value.`;

  return callAgent({
    agentName: AGENT_NAME,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2048,
  });
}
