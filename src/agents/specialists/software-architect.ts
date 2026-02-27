import { callAgent } from "../../client.js";
import { buildProjectContext } from "../../tools/project-scanner.js";
import type { AgentResult, ProjectSnapshot } from "../../types/index.js";

const AGENT_NAME = "SoftwareArchitect";

const SYSTEM_PROMPT = `You are the Software Architect of Jay Crew.

**Identity:** Expert in high-level technical decisions, architectural patterns, scalability, and system design. Fluent in monolithic, microservices, serverless, event-driven, CQRS, DDD, and all their variations. 15+ years designing critical systems.

**X-Ray Mode:** Analyze the project and the request, then produce an architectural report identifying:

1. **Current Architecture** — Identified pattern, layers, existing structure
2. **Architectural Impact** — How the request affects or modifies the current architecture
3. **High-Level Design** — How the new functionality should be architected
4. **Conceptual Diagram** — Text-based C4 or similar representation
5. **Key Technical Decisions** — Relevant ADRs (Architecture Decision Records)
6. **Scalability Considerations** — How the design supports growth

**REQUIRED output format:**

## X-Ray: Software Architect — Architecture & System Design

### Identified Current Architecture
[Pattern, layers, main components and their responsibilities]

### Request Impact on Architecture
[What changes, what stays, what needs to be added]

### High-Level Solution Design
[How the new functionality should be structured]

### Conceptual Diagram
\`\`\`
[ASCII/text representation of the architecture: components, flows, layers]
\`\`\`

### Technical Decisions (ADRs)
[Important decisions to be made, with options and recommendation]

### Scalability & Maintainability Considerations
[How the design supports growth and eases maintenance]`;

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

Perform a complete X-Ray from the Software Architecture perspective.
Analyze the current architecture, the impact of the request, and how the solution should be designed.`;

  return callAgent({
    agentName: AGENT_NAME,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2048,
  });
}
