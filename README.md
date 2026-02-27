# Jay Crew

> A multi-agent AI team that analyzes any project and produces a detailed, actionable execution plan — powered by Claude Opus.

```
╔══════════════════════════════════════════════════╗
║         JAY CREW — Multi-Agent AI Team          ║
╚══════════════════════════════════════════════════╝
```

---

## What is Jay Crew?

Jay Crew is a CLI tool that deploys a full team of specialized AI agents to analyze a software project from every angle. You give it a project path and a task — it activates the right specialists, runs their X-Ray analyses in parallel, and the Orchestrator synthesizes everything into a single, structured execution plan.

Think of it as summoning a senior tech team on demand for any project.

---

## How It Works

```
Phase 0 ──► Scan target project locally (no API calls)
               │
               ▼
Phase 1 ──► Orchestrator analyzes the request
            and decides which specialists to activate
               │
               ▼
Phase 2 ──► Activated specialists run X-Ray in parallel
            Each one examines the project from their domain
               │
               ▼
Phase 3 ──► Orchestrator synthesizes all X-Ray reports
            into a unified Execution Plan
               │
               ▼
Phase 4 ──► crew-plan-{timestamp}.md is saved
```

---

## The Team

### Core Agents

| Agent | Role | Expertise |
|-------|------|-----------|
| **Orchestrator** | Team Lead | Coordinates all agents, decides who to activate, synthesizes the final plan |
| **Radar** | Real-Time Research & Validation | Technologies, versions, 2026 trends, best practices, trade-offs |
| **Engine** | Deep Logic & Programming | Algorithms, code quality, edge cases, design patterns, technical debt |
| **Canvas** | Creativity, UX & Product Strategy | User flows, UI components, user stories, product strategy |

### Specialist Agents

| Agent | Role | Focus |
|-------|------|-------|
| `product-owner` | Product Owner | Requirements, acceptance criteria, MoSCoW, Definition of Done |
| `business-analyst` | Business Analyst | Business processes, rules, operational flows, entity mapping |
| `software-architect` | Software Architect | System architecture, C4 diagrams, ADRs, scalability |
| `backend-dev` | Senior Backend Developer | APIs, database schema, auth, server logic, migrations |
| `frontend-dev` | Senior Frontend Developer | Next.js 15, React, TypeScript, Tailwind, performance, a11y |
| `mobile-dev` | Senior Mobile Developer | React Native, Flutter, native features, navigation |
| `devops` | DevOps Engineer | Docker, CI/CD, Kubernetes, IaC, observability |
| `security` | Security Engineer | OWASP Top 10, auth security, pentest, compliance |
| `qa` | QA Engineer | Unit, integration, E2E testing, coverage, automation |
| `tech-writer` | Technical Writer | README, Swagger/OpenAPI, developer guides, changelogs |
| `ai-ml` | AI/ML Specialist | LLM integration, embeddings, RAG, ML pipelines |
| `performance` | Performance Engineer | Profiling, caching, query optimization, scalability |

---

## Setup

**1. Clone and install dependencies**

```bash
git clone https://github.com/jeferson0306/jay-crew.git
cd jay-crew
npm install
```

**2. Configure your API key**

```bash
cp .env.example .env
```

Open `.env` and add your key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

> Get your key at [console.anthropic.com](https://console.anthropic.com)

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
| `--help` | `-h` | Show help message |

### Examples

**Analyze any external project:**
```bash
npx tsx src/index.ts --project ~/my-nextjs-app "Add JWT authentication"
```

**Analyze the current directory:**
```bash
npx tsx src/index.ts "Create a full roadmap for this project"
```

**Force specific specialists:**
```bash
npx tsx src/index.ts -p ~/my-app -s backend-dev,security,qa "Implement OAuth2 with Google"
```

**Full-stack feature planning:**
```bash
npx tsx src/index.ts -p ~/my-saas "Add a subscription billing system with Stripe"
```

**Security audit:**
```bash
npx tsx src/index.ts -p ~/my-api -s security,backend-dev "Security audit and hardening"
```

---

## Output

The tool generates a `crew-plan-{timestamp}.md` file containing:

1. **Orchestrator Analysis** — Initial decision: which specialists were activated and why
2. **Specialist X-Ray Reports** — Each agent's analysis from their domain perspective
3. **Execution Plan** — The final synthesized plan with:
   - Executive Summary
   - Specialist Diagnostics (table)
   - Implementation Roadmap (ordered phases)
   - Dependency Map
   - Risks & Mitigations
   - Recommended Stack
   - Immediate Next Steps

---

## Architecture

```
jay-crew/
├── src/
│   ├── agents/
│   │   ├── core/
│   │   │   ├── orchestrator.ts   ← Phase 1 (decision) + Phase 3 (synthesis)
│   │   │   ├── radar.ts          ← Real-Time Research & Validation
│   │   │   ├── engine.ts         ← Deep Logic & Programming
│   │   │   └── canvas.ts         ← Creativity, UX & Product Strategy
│   │   ├── specialists/
│   │   │   ├── product-owner.ts
│   │   │   ├── business-analyst.ts
│   │   │   ├── software-architect.ts
│   │   │   ├── backend-dev.ts
│   │   │   ├── frontend-dev.ts
│   │   │   ├── mobile-dev.ts
│   │   │   ├── devops.ts
│   │   │   ├── security.ts
│   │   │   ├── qa.ts
│   │   │   ├── tech-writer.ts
│   │   │   ├── ai-ml.ts
│   │   │   └── performance.ts
│   │   └── registry.ts           ← Maps role names → runXRay functions
│   ├── tools/
│   │   ├── project-scanner.ts    ← Scans target project (no API calls)
│   │   └── path-utils.ts         ← Path helpers & file tree formatting
│   ├── types/
│   │   └── index.ts              ← All TypeScript types
│   ├── client.ts                 ← Anthropic SDK wrapper
│   └── index.ts                  ← CLI entry point & main pipeline
├── .env.example
├── package.json
└── tsconfig.json
```

### Design Principles

- **Parallel execution** — All specialist X-Rays run concurrently (saves 60–80% of API time)
- **Local scan first** — The project snapshot is built locally before any API call
- **Graceful degradation** — If one specialist fails, the rest continue and contribute to the plan
- **Role-based registry** — Adding a new specialist is as simple as creating one file and registering it

---

## Model

Jay Crew uses **Claude Opus 4.6** (`claude-opus-4-6`) for all agents — the most capable model for complex analysis and synthesis tasks.

---

## Requirements

- Node.js 20+
- `npm` (or `bun`)
- Anthropic API key
