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
- **Automatic technology stack detection** (languages, frameworks, databases)
- **Monorepo and multi-service detection**
- The relevant agent definitions for the requested task
- Activation instructions for the Orchestrator

You paste that file into **Claude Code** (or any AI assistant), say _"Run the Jay Crew"_, and the AI acts as the Orchestrator — running each specialist's X-Ray and synthesizing a complete execution plan.

**No Anthropic API key. No standalone AI calls. Jay Crew is the framework; you bring the AI.**

---

## Automatic Stack Detection

Jay Crew **automatically detects** the technology stack of any project:

```
🔬  Stack detected: Java · Spring Boot, Docker
📦  Monorepo with 3 services detected
🧠  Crew selected: software-architect, backend-dev, devops, qa, engine
```

Based on the detected stack, Jay Crew **automatically selects the right specialists** — even with generic requests like "Full analysis".

### Supported Technologies

| Category | Technologies |
|----------|-------------|
| **Backend** | Java (Spring Boot, Quarkus, Micronaut), Kotlin, Go, Rust, Python, Node.js, .NET, PHP, Ruby |
| **Frontend** | React, Vue, Angular, Svelte, Astro, Next.js, Nuxt, SvelteKit |
| **Mobile** | Flutter, React Native, Swift, Kotlin |
| **Databases** | PostgreSQL, MySQL, MongoDB, Oracle, SQL Server, Teradata, Snowflake, Redis |
| **Infrastructure** | Docker, Kubernetes, GitHub Actions, GitLab CI, Azure Pipelines, Jenkins |
| **Monorepo Tools** | Nx, Lerna, Turborepo |

---

## Monorepo & Multi-Service Support

Jay Crew detects **monorepos and multi-service architectures**:

- Identifies individual services within the repository
- Classifies each service by type (backend, frontend, mobile, library)
- Detects the primary language of each service
- Automatically includes `software-architect` and `devops` for complex architectures

```
📦  Monorepo with 3 services detected
    - api-gateway (backend) — Java
    - web-app (frontend) — TypeScript (React)
    - mobile-app (mobile) — Dart (Flutter)
```

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
Step 3 ──► Detects technology stack automatically
           Identifies languages, frameworks, and services
               │
               ▼
Step 4 ──► Auto-selects specialists based on:
           • Keywords in your request
           • Detected technology stack
           • Persona (if specified)
               │
               ▼
Step 5 ──► Generates crew-context-{timestamp}.md
           with project context + agent definitions
               │
               ▼
Step 6 ──► You paste the file into Claude Code
           "Run the Jay Crew on this context"
               │
               ▼
Step 7 ──► Claude acts as the Orchestrator
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
│  ✓ Detected stack: languages, frameworks, services              │
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
│  ✓ Orchestrator confirms the detected stack                     │
│  ✓ Each specialist runs their X-Ray analysis                    │
│  ✓ Final Execution Plan synthesized from all X-Rays             │
└─────────────────────────────────────────────────────────────────┘
```

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
| `frontend-dev` | `agents/specialists/frontend-dev.md` | Web UI — any frontend framework |
| `mobile-dev` | `agents/specialists/mobile-dev.md` | Mobile apps — React Native, Flutter, native iOS/Android |
| `data-engineer` | `agents/specialists/data-engineer.md` | Database design, migrations, query optimization, data pipelines |
| `devops` | `agents/specialists/devops.md` | Docker, CI/CD, Kubernetes, IaC, observability |
| `security` | `agents/specialists/security.md` | OWASP Top 10, dependency vulnerabilities, auth security, compliance |
| `qa` | `agents/specialists/qa.md` | Testing strategy, coverage analysis, quality red flags |
| `tech-writer` | `agents/specialists/tech-writer.md` | README, API docs, developer guides, changelogs |
| `ai-ml` | `agents/specialists/ai-ml.md` | LLM integration, embeddings, RAG, ML pipelines — when AI adds value |
| `performance` | `agents/specialists/performance.md` | Profiling, caching, query optimization, scalability |

---

## Smart Crew Selection

Jay Crew selects specialists using **three layers**:

### 1. Keyword-based (from your request)

| Keywords in Request | Specialists Added |
|---------------------|-------------------|
| auth, login, jwt, oauth | backend-dev, security |
| ui, component, frontend | frontend-dev, canvas |
| database, schema, migration | data-engineer |
| docker, ci/cd, kubernetes | devops |
| test, coverage, quality | qa |
| performance, optimize, cache | performance |

### 2. Stack-based (from detected technologies)

| Detected Stack | Specialists Added |
|----------------|-------------------|
| Java, Go, Python, Node.js | backend-dev |
| React, Vue, Angular, Svelte | frontend-dev |
| Flutter, Swift, Dart | mobile-dev |
| SQL files, migrations, Prisma | data-engineer |
| Docker, Kubernetes, CI/CD | devops |
| Test files detected | qa |
| Monorepo detected | software-architect, devops |

### 3. Persona-based (from --persona flag)

| Persona | Specialists Added |
|---------|-------------------|
| `due-diligence` | security, qa, devops, radar |
| `tech-migrator` | radar, devops |
| `tech-lead` | security, devops |
| `senior-dev` | performance |
| `new-dev` | tech-writer |
| `task-executor` | qa |

---

## Personas

Use `--persona` (or `-r`) to shape how the Orchestrator presents its analysis.

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
# Analyze any project — stack is auto-detected
npx tsx src/index.ts --project ~/my-project "Full analysis"

# The CLI will output something like:
# 🔬  Stack detected: Java · Spring Boot, Docker
# 🧠  Crew selected: software-architect, backend-dev, devops, qa, engine

# Force specific specialists if needed
npx tsx src/index.ts -p ~/my-app -s backend-dev,security,data-engineer "Add user audit logs"

# Use personas for different analysis styles
npx tsx src/index.ts -p ~/my-app --persona new-dev "Explain the codebase"
npx tsx src/index.ts -p ~/my-app --persona senior-dev "Optimize performance"
npx tsx src/index.ts -p ~/my-app --persona tech-lead "Evaluate architecture"
npx tsx src/index.ts -p ~/my-app --persona due-diligence "Full technical audit"

# Monorepo analysis
npx tsx src/index.ts -p ~/my-monorepo "Analyze all services"
# 📦  Monorepo with 5 services detected
```

### Output

```
✅  234 files scanned in 0.1s — 133 files in context (35 full · 98 skel) · 100 KB used
🔬  Stack detected: Java · Spring Boot, Docker
📦  Monorepo with 3 services detected
🧠  Crew selected: software-architect, backend-dev, devops, qa, engine
🎯  Persona "due-diligence" boosted the crew with relevant specialists
✅  Context file saved: crew-context-{timestamp}.md
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
│   │   ├── project-scanner.ts    ← Scans filesystem, detects stack & services
│   │   └── path-utils.ts         ← Path helpers & file tree formatting
│   ├── types/
│   │   └── index.ts              ← TypeScript types (including DetectedStack)
│   └── index.ts                  ← CLI entry point, stack boosting, context builder
├── package.json
└── tsconfig.json
```

### Design Principles

- **No API calls** — Jay Crew only reads the filesystem; the AI runs externally
- **Technology agnostic** — Each agent detects and adapts to the project's stack
- **Automatic stack detection** — Languages, frameworks, and services are detected automatically
- **Monorepo aware** — Identifies and classifies services within complex repositories
- **Smart specialist selection** — Keywords + stack detection + personas suggest the right crew
- **Agent definitions as markdown** — Each agent is a plain `.md` file, easy to read and extend
- **Bring your own AI** — Works with Claude Code, ChatGPT, Gemini, or any AI assistant

---

## Adding a New Agent

1. Create `agents/specialists/my-agent.md` following the existing format
2. Add `"my-agent"` to the `SpecialistRole` type in `src/types/index.ts`
3. Add `"my-agent"` to the `VALID_ROLES` array in `src/index.ts`
4. Add keyword heuristics to `suggestSpecialistsByRequest()` in `src/index.ts`
5. (Optional) Add stack-based boosting to `boostCrewByStack()` if relevant
6. (Optional) Add persona-based boosting to `boostCrewByPersona()` if relevant

That's it — no other changes needed.

---

## Full Workflow Example

### Step 1 — Generate the context file

```bash
npx tsx src/index.ts \
  --project ~/my-project \
  --persona senior-dev \
  "Full technical audit"
```

Output:
```
✅  234 files scanned in 0.1s — 133 files in context (35 full · 98 skel) · 100 KB used
🔬  Stack detected: Java · Spring Boot, Docker
🧠  Crew selected: software-architect, backend-dev, devops, qa, engine, performance
🎯  Persona "senior-dev" boosted the crew with relevant specialists
✅  Context file saved: crew-context-{timestamp}.md
```

### Step 2 — Run the AI analysis

Open the generated file and paste its full contents into Claude (claude.ai or Claude Code).

Then send this message:

> **"You are the Jay Crew Orchestrator. Run the full crew analysis for the task described below."**

Claude will act as the Orchestrator, run each specialist's X-Ray, and produce a complete structured report.

### What you get

A full multi-specialist report with:

| Specialist | Delivers |
|------------|----------|
| `software-architect` | Architecture overview, component diagram, integration points |
| `security` | Auth flow audit, OWASP gaps, dependency vulnerabilities |
| `backend-dev` | API contracts, data models, migration plan (adapted to your stack) |
| `devops` | Infrastructure analysis, CI/CD recommendations, deployment strategy |
| `qa` | Test coverage, quality red flags, testing strategy |
| `engine` | Code quality, logic edge cases, refactoring priorities |
| **Orchestrator** | **Phased Execution Plan** — all findings synthesized into actionable steps |

All grounded in the actual code of your project, not generic advice.

---

## Requirements

- Node.js 20+
- `npm` (or `bun`)
