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

## How It Works

```
Step 1 ──► Run the CLI against any project
               │
               ▼
Step 2 ──► Jay Crew scans the project locally
           Builds a full snapshot (tree, configs, deps, source)
               │
               ▼
Step 3 ──► Suggests the right specialists
           based on keyword analysis of your request
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

## The Team

### Core Agents

| Agent | File | Expertise |
|-------|------|-----------|
| **Orchestrator** | `agents/core/orchestrator.md` | Coordinates the crew, decides specialists, synthesizes the final plan |
| **Radar** | `agents/core/radar.md` | Real-time research — technologies, versions, 2026 trends, best practices |
| **Engine** | `agents/core/engine.md` | Deep logic — algorithms, code quality, edge cases, design patterns |
| **Canvas** | `agents/core/canvas.md` | Creativity — user flows, UI components, user stories, product strategy |

### Specialist Agents

| Agent | File | Focus |
|-------|------|-------|
| `product-owner` | `agents/specialists/product-owner.md` | Requirements, acceptance criteria, MoSCoW, Definition of Done |
| `business-analyst` | `agents/specialists/business-analyst.md` | Business processes, rules, operational flows, entity mapping |
| `software-architect` | `agents/specialists/software-architect.md` | System architecture, C4 diagrams, ADRs, scalability |
| `backend-dev` | `agents/specialists/backend-dev.md` | APIs, database schema, auth, server logic, migrations |
| `frontend-dev` | `agents/specialists/frontend-dev.md` | Next.js 15, React, TypeScript, Tailwind, performance, a11y |
| `mobile-dev` | `agents/specialists/mobile-dev.md` | React Native, Flutter, native features, navigation |
| `devops` | `agents/specialists/devops.md` | Docker, CI/CD, Kubernetes, IaC, observability |
| `security` | `agents/specialists/security.md` | OWASP Top 10, auth security, pentest, compliance |
| `qa` | `agents/specialists/qa.md` | Unit, integration, E2E testing, coverage, automation |
| `tech-writer` | `agents/specialists/tech-writer.md` | README, Swagger/OpenAPI, developer guides, changelogs |
| `ai-ml` | `agents/specialists/ai-ml.md` | LLM integration, embeddings, RAG, ML pipelines |
| `performance` | `agents/specialists/performance.md` | Profiling, caching, query optimization, scalability |

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

### Personas

The `--persona` flag injects a context block into the generated file that instructs the Orchestrator to adapt its output style and depth for a specific audience.

| Persona | Description |
|---------|-------------|
| `new-dev` | Guided, educational, step-by-step explanations for newcomers |
| `senior-dev` | Concise and technical — patterns, tradeoffs, edge cases |
| `tech-migrator` | Migration planning — current→target state, phased strategy |
| `task-executor` | Direct implementation — production-ready code, no overhead |
| `tech-lead` | Architectural decisions, ADRs, team impact, risk assessment |
| `due-diligence` | Risk analysis, technical debt, security, compliance signals |

### Examples

```bash
# Analyze any external project
npx tsx src/index.ts --project ~/my-nextjs-app "Add JWT authentication"

# Analyze the current directory
npx tsx src/index.ts "Create a full roadmap for this project"

# Force specific specialists
npx tsx src/index.ts -p ~/my-app -s backend-dev,security,qa "Implement OAuth2 with Google"

# Full-stack feature planning
npx tsx src/index.ts -p ~/my-saas "Add a subscription billing system with Stripe"

# Onboard a new developer to an existing feature
npx tsx src/index.ts -p ~/my-app --persona new-dev "Explain how the authentication flow works"

# Get a senior-level deep-dive before a refactor
npx tsx src/index.ts -p ~/my-api --persona senior-dev "Migrate from REST to GraphQL"

# Plan a framework migration
npx tsx src/index.ts -p ~/my-app --persona tech-migrator "Migrate from Express to Fastify"

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
crew-context-2026-02-27T10-30-00.md
├── Project snapshot (tree, configs, dependencies, source samples)
│   └── Source files selected by priority: P0 (schemas/docs) → P1 (core logic) → P2 (other)
├── Persona context block (if --persona is used)
├── Suggested crew for the task
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
│   │   ├── orchestrator.md   ← Phase 1 (decision) + Phase 2 (synthesis) format
│   │   ├── radar.md          ← Real-Time Research & Validation
│   │   ├── engine.md         ← Deep Logic & Programming
│   │   └── canvas.md         ← Creativity, UX & Product Strategy
│   └── specialists/
│       ├── product-owner.md
│       ├── business-analyst.md
│       ├── software-architect.md
│       ├── backend-dev.md
│       ├── frontend-dev.md
│       ├── mobile-dev.md
│       ├── devops.md
│       ├── security.md
│       ├── qa.md
│       ├── tech-writer.md
│       ├── ai-ml.md
│       └── performance.md
├── src/
│   ├── tools/
│   │   ├── project-scanner.ts    ← Scans target project filesystem
│   │   └── path-utils.ts         ← Path helpers & file tree formatting
│   ├── types/
│   │   └── index.ts              ← TypeScript types
│   └── index.ts                  ← CLI entry point & context file builder
├── package.json
└── tsconfig.json
```

### Design Principles

- **No API calls** — Jay Crew only reads the filesystem; the AI runs externally
- **Agent definitions as markdown** — Each agent is a plain `.md` file, easy to read and extend
- **Smart specialist selection** — Keyword heuristics suggest the right crew for any request
- **Bring your own AI** — Works with Claude Code, ChatGPT, Gemini, or any AI assistant

---

## Adding a New Agent

1. Create `agents/specialists/my-agent.md` following the existing format
2. Add `"my-agent"` to the `SpecialistRole` type in `src/types/index.ts`
3. Add the keyword heuristics to `suggestSpecialists()` in `src/index.ts`

That's it — no other changes needed.

---

## Requirements

- Node.js 20+
- `npm` (or `bun`)
