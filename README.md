# Jay Crew

> A multi-agent AI team that scans any project and generates a complete, structured briefing — ready to be executed by Claude Code or any AI assistant. No API key required.

```
╔══════════════════════════════════════════════════╗
║         JAY CREW — Multi-Agent AI Team          ║
╚══════════════════════════════════════════════════╝
```

---

## What is Jay Crew?

Jay Crew is a CLI tool that **scans a software project** and generates a `crew-context.md` file containing:

- The full project snapshot (tree, config files, dependencies, source samples)
- The relevant agent definitions for the requested task
- Activation instructions for the Orchestrator

You paste that file into **Claude Code** (or any AI assistant), say _"Run the Jay Crew"_, and the AI acts as the Orchestrator — running each specialist's X-Ray and synthesizing a complete execution plan.

**No Anthropic API key. No standalone AI calls. Jay Crew is the framework; you bring the AI.**

---

## Technology Agnostic

Jay Crew works with **any technology stack**:

- **Backend**: Java (Spring Boot, Quarkus), Node.js, Python, Go, Rust, .NET, PHP
- **Frontend**: React, Vue, Angular, Svelte, or any framework
- **Mobile**: React Native, Flutter, native iOS/Android
- **Databases**: PostgreSQL, MySQL, MongoDB, Oracle, Teradata, Snowflake
- **Infrastructure**: Docker, Kubernetes, AWS, Azure, GCP

The agents automatically detect the project's stack and adapt their analysis accordingly.

---

## How It Works

```
Step 1 ──► Run the CLI against any project
               │
               ▼
Step 2 ──► Jay Crew scans the project locally
           Builds a full snapshot (tree, configs, deps, source)
               │
               ▼
Step 3 ──► Detects the technology stack automatically
           Suggests the right specialists based on your request
               │
               ▼
Step 4 ──► Generates crew-context-{timestamp}.md
           with project context + agent definitions
               │
               ▼
Step 5 ──► You paste the file into Claude Code
           "Run the Jay Crew on this context"
               │
               ▼
Step 6 ──► Claude acts as the Orchestrator
           Runs each specialist's X-Ray
           Produces the final Execution Plan
```

---

## Two-Step Workflow

Jay Crew produces a **context file** — it does not produce the analysis itself. The analysis happens in the AI.

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1 — CLI (your machine)                                    │
│                                                                 │
│  npx tsx src/index.ts -p ~/my-app "Add JWT auth"                │
│                                                                 │
│  Output: crew-context-{timestamp}.md                            │
│  ✓ File tree + config files + dependency list                   │
│  ✓ Source files (full or skeletal, up to 200 KB budget)         │
│  ✓ Agent definitions (Orchestrator + selected specialists)      │
│  ✗ No AI calls. No analysis yet. Just structured context.       │
└──────────────────────────────┬──────────────────────────────────┘
                               │  paste the file
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2 — AI (Claude Code, claude.ai, or any AI assistant)      │
│                                                                 │
│  > "You are the Jay Crew Orchestrator.                          │
│     Run the full crew analysis for the task described below."   │
│                                                                 │
│  ✓ Orchestrator detects the stack and assembles the crew        │
│  ✓ Each specialist runs their X-Ray analysis                    │
│  ✓ Final Execution Plan synthesized from all X-Rays             │
└─────────────────────────────────────────────────────────────────┘
```

> **The CLI output (metrics like "56 files in context · 42 KB used") is not the analysis.**
> It tells you what was packed into the context file. The actual multi-specialist report
> is generated in Step 2 by the AI.

---

## The Team

### Core Agents

| Agent | File | Expertise |
|-------|------|-----------|
| **Orchestrator** | `agents/core/orchestrator.md` | Coordinates the crew, decides specialists, resolves conflicts, synthesizes the final plan |
| **Radar** | `agents/core/radar.md` | Real-time research — technologies, versions, trends, best practices |
| **Engine** | `agents/core/engine.md` | Deep logic — algorithms, code quality, edge cases, design patterns |
| **Canvas** | `agents/core/canvas.md` | Creativity — user flows, UI components, user stories, product strategy |

### Specialist Agents

| Agent | File | Focus |
|-------|------|-------|
| `product-owner` | `agents/specialists/product-owner.md` | Requirements, acceptance criteria, MoSCoW, Definition of Done |
| `business-analyst` | `agents/specialists/business-analyst.md` | Business processes, rules, operational flows, entity mapping |
| `software-architect` | `agents/specialists/software-architect.md` | System architecture, C4 diagrams, ADRs, scalability |
| `backend-dev` | `agents/specialists/backend-dev.md` | APIs, database schema, auth, server logic — any backend stack |
| `frontend-dev` | `agents/specialists/frontend-dev.md` | Web UI — any frontend framework (React, Vue, Angular, Svelte, etc.) |
| `mobile-dev` | `agents/specialists/mobile-dev.md` | Mobile apps — React Native, Flutter, native iOS/Android |
| `data-engineer` | `agents/specialists/data-engineer.md` | Database design, migrations, query optimization, data pipelines |
| `devops` | `agents/specialists/devops.md` | Docker, CI/CD, Kubernetes, IaC, observability |
| `security` | `agents/specialists/security.md` | OWASP Top 10, dependency vulnerabilities, auth security, compliance |
| `qa` | `agents/specialists/qa.md` | Testing strategy, coverage analysis, quality red flags |
| `tech-writer` | `agents/specialists/tech-writer.md` | README, API docs, developer guides, changelogs |
| `ai-ml` | `agents/specialists/ai-ml.md` | LLM integration, embeddings, RAG, ML pipelines — when AI adds value |
| `performance` | `agents/specialists/performance.md` | Profiling, caching, query optimization, scalability |

---

## Personas

Use `--persona` (or `-r`) to shape how the Orchestrator presents its analysis.
Each persona injects a context block that instructs the AI to adapt its tone, depth, and focus.

**Personas also boost the crew** — relevant specialists are automatically added based on the persona.

| Persona | Best for | Auto-boost |
|---------|----------|------------|
| `new-dev` | Developer new to the codebase | +tech-writer |
| `senior-dev` | Refactor audit or deep technical review | +performance |
| `tech-migrator` | Planning a stack or framework migration | +radar, +devops |
| `task-executor` | Preparing context for an AI agent task | +qa |
| `tech-lead` | Onboarding material or team briefing | +security, +devops |
| `due-diligence` | Evaluating a legacy or external codebase | +security, +qa, +devops, +radar |

No `--persona` flag? The Orchestrator uses its default style — balanced, technical, and structured.

---

## Setup

**1. Clone and install**

```bash
git clone https://github.com/jeferson0306/jay-crew.git
cd jay-crew
npm install
```

No `.env`, no API key, no external service needed.

---

## Usage

```bash
npx tsx src/index.ts [options] "your request"
```

### Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--project <path>` | `-p` | Path to the target project (default: current directory) |
| `--specialists <list>` | `-s` | Comma-separated list of specific specialists to force |
| `--persona <type>` | `-r` | Persona profile to shape the Orchestrator output |
| `--help` | `-h` | Show help message |

### Available Specialists

```
Core:        radar, engine, canvas
Delivery:    product-owner, business-analyst, software-architect
             backend-dev, frontend-dev, mobile-dev
Operations:  devops, security, qa, tech-writer, ai-ml, performance
Data:        data-engineer
```

### Examples

```bash
# Analyze any external project (any stack)
npx tsx src/index.ts --project ~/my-spring-boot-app "Add JWT authentication"

# Analyze a Python/Django project
npx tsx src/index.ts --project ~/my-django-app "Add caching layer"

# Analyze a Node.js project
npx tsx src/index.ts --project ~/my-express-api "Implement rate limiting"

# Force specific specialists
npx tsx src/index.ts -p ~/my-app -s backend-dev,security,data-engineer "Add user audit logs"

# Full-stack feature planning
npx tsx src/index.ts -p ~/my-saas "Add a subscription billing system with Stripe"

# Onboard a new developer to an existing feature
npx tsx src/index.ts -p ~/my-app --persona new-dev "Explain how the authentication flow works"

# Get a senior-level deep-dive before a refactor
npx tsx src/index.ts -p ~/my-api --persona senior-dev "Optimize database queries"

# Plan a framework migration
npx tsx src/index.ts -p ~/my-app --persona tech-migrator "Migrate from monolith to microservices"

# Get straight to implementation with no fluff
npx tsx src/index.ts -p ~/my-app --persona task-executor "Add rate limiting to the API"

# Prepare a technical decision for the team
npx tsx src/index.ts -p ~/my-saas --persona tech-lead "Evaluate adding a message queue"

# Audit the codebase for acquisition due diligence
npx tsx src/index.ts -p ~/their-project --persona due-diligence "Full technical audit"
```

### Output

A `crew-context-{timestamp}.md` file is generated containing everything the AI needs:

```
crew-context-{timestamp}.md
├── Project snapshot (tree, configs, dependencies, source samples)
│   └── Source files selected by priority: P0 (schemas/docs) → P1 (core logic) → P2 (other)
├── Persona context block (if --persona is used)
├── Suggested crew for the task (boosted by persona)
├── Orchestrator definition (Phase 1 + Phase 2 format)
└── Each selected specialist's definition (identity + X-Ray format)
```

**Then paste it into Claude Code and say:**
> _"Run the Jay Crew on this context."_

---

## Architecture

```
jay-crew/
├── agents/
│   ├── core/
│   │   ├── orchestrator.md   ← Phase 1 (decision) + Phase 2 (synthesis) + conflict resolution
│   │   ├── radar.md          ← Real-Time Research & Validation
│   │   ├── engine.md         ← Deep Logic & Programming
│   │   └── canvas.md         ← Creativity, UX & Product Strategy
│   └── specialists/
│       ├── product-owner.md
│       ├── business-analyst.md
│       ├── software-architect.md
│       ├── backend-dev.md     ← Tech-agnostic (Java, Node, Python, Go, etc.)
│       ├── frontend-dev.md    ← Tech-agnostic (React, Vue, Angular, Svelte, etc.)
│       ├── mobile-dev.md      ← Tech-agnostic (React Native, Flutter, native)
│       ├── data-engineer.md   ← Database design, migrations, query optimization
│       ├── devops.md
│       ├── security.md        ← Includes dependency vulnerability scanning
│       ├── qa.md              ← Includes code quality red flag detection
│       ├── tech-writer.md
│       ├── ai-ml.md           ← Critical: evaluates if AI is actually needed
│       └── performance.md
├── src/
│   ├── tools/
│   │   ├── project-scanner.ts    ← Scans target project filesystem
│   │   └── path-utils.ts         ← Path helpers & file tree formatting
│   ├── types/
│   │   └── index.ts              ← TypeScript types
│   └── index.ts                  ← CLI entry point, persona boosting, context builder
├── package.json
└── tsconfig.json
```

### Design Principles

- **No API calls** — Jay Crew only reads the filesystem; the AI runs externally
- **Technology agnostic** — Each agent detects and adapts to the project's stack
- **Agent definitions as markdown** — Each agent is a plain `.md` file, easy to read and extend
- **Smart specialist selection** — Keyword heuristics + persona boosting suggest the right crew
- **Bring your own AI** — Works with Claude Code, ChatGPT, Gemini, or any AI assistant

---

## Adding a New Agent

1. Create `agents/specialists/my-agent.md` following the existing format
2. Add `"my-agent"` to the `SpecialistRole` type in `src/types/index.ts`
3. Add `"my-agent"` to the `VALID_ROLES` array in `src/index.ts`
4. Add the keyword heuristics to `suggestSpecialists()` in `src/index.ts`
5. (Optional) Add the agent to `boostCrewByPersona()` if it should be auto-added for certain personas

That's it — no other changes needed.

---

## Full Workflow Example

### Step 1 — Generate the context file

```bash
npx tsx src/index.ts \
  --project ~/my-ecommerce \
  --persona senior-dev \
  "Audit the authentication flow and create an implementation plan for RBAC"
```

Output:
```
✅  96 files scanned in 0.0s — 56 files in context (11 full · 45 skel) · 42 KB used
🧠  Crew selected: software-architect, security, backend-dev, engine, performance
🎯  Persona "senior-dev" boosted the crew with relevant specialists
✅  Context file saved: crew-context-{timestamp}.md
```

### Step 2 — Run the AI analysis

Open the generated file and paste its full contents into Claude (claude.ai or Claude Code).

Then send this message:

> **"You are the Jay Crew Orchestrator. Run the full crew analysis for the task described below."**

Claude will act as the Orchestrator, run each specialist's X-Ray, and produce a complete structured report.

### What you get

A full multi-specialist report with, for example:

| Specialist | Delivers |
|------------|----------|
| `software-architect` | Architecture overview, component diagram, integration points |
| `security` | Auth flow audit, OWASP gaps, dependency vulnerabilities, RBAC risk assessment |
| `backend-dev` | API contracts, DB schema changes, migration plan (adapted to your stack) |
| `engine` | Code quality, logic edge cases, refactoring priorities |
| **Orchestrator** | **Phased Execution Plan** — all findings synthesized into actionable steps |

All grounded in the actual code of your project, not generic advice.

---

## Requirements

- Node.js 20+
- `npm` (or `bun`)
