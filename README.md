# Jay Crew

[![npm version](https://img.shields.io/npm/v/jay-crew.svg)](https://www.npmjs.com/package/jay-crew)
[![npm downloads](https://img.shields.io/npm/dm/jay-crew.svg)](https://www.npmjs.com/package/jay-crew)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A multi-agent AI team that scans any project and generates a complete, structured briefing — ready to be executed by Claude Code or any AI assistant. No API key required.

📦 **npm:** https://www.npmjs.com/package/jay-crew

```
╔══════════════════════════════════════════════════╗
║         JAY CREW — Multi-Agent AI Team          ║
╚══════════════════════════════════════════════════╝
```

## What is Jay Crew?

Jay Crew is a CLI tool that **scans a software project** and generates a `crew-context.md` file containing:

- Full project snapshot (tree, config files, dependencies, source samples)
- **Automatic technology stack detection** (200+ frameworks supported)
- **Monorepo and multi-service detection**
- Relevant agent definitions for the requested task
- Activation instructions for the Orchestrator

You paste that file into **Claude Code** (or any AI assistant), say _"Run the Jay Crew"_, and the AI acts as the Orchestrator — running each specialist's X-Ray and synthesizing a complete execution plan.

**No API key. No external calls. Jay Crew is the framework; you bring the AI.**

---

## Quick Start

```bash
# Run directly with npx (no installation needed)
npx jay-crew@latest -p ~/my-project "Full technical analysis"
```

### First Run Experience

```
$ npx jay-crew@latest -p ~/my-project "Full analysis"

Need to install the following packages:
  jay-crew@0.1.3
Ok to proceed? (y) y

╔══════════════════════════════════════════════════╗
║         JAY CREW — Multi-Agent AI Team          ║
╚══════════════════════════════════════════════════╝

📁  Project: /Users/you/my-project
💬  Request: "Full analysis"

🔍  Scanning target project...
✅  234 files scanned in 0.1s — 133 files in context (35 full · 98 skel) · 100 KB used
🔬  Stack detected: Java · Spring Boot, Docker, PostgreSQL
📦  Monorepo with 3 services detected

🧠  Crew selected: software-architect, backend-dev, devops, qa, engine

📖  Loading agent definitions...
✅  Context file saved: crew-context-2024-01-15T10-30-00.md

─────────────────────────────────────────────────
  Paste this file into Claude Code and say:
  "Run the Jay Crew on this context."
─────────────────────────────────────────────────
```

### Alternative: Install Globally

```bash
npm install -g jay-crew
jay-crew -p ~/my-app "Add authentication with JWT"
```

---

## Automatic Stack Detection

Jay Crew **automatically detects** the technology stack of any project:

```
🔬  Stack detected: TypeScript (React), Go · Gin, Tailwind CSS, Next.js, PostgreSQL
📦  Monorepo with 3 services detected
🧠  Crew selected: software-architect, backend-dev, frontend-dev, devops, qa
```

### 200+ Technologies Supported

<details>
<summary><strong>Languages (80+ extensions)</strong></summary>

| Category | Languages |
|----------|-----------|
| **JVM** | Java, Kotlin, Scala, Groovy, Clojure |
| **Systems** | Go, Rust, C, C++, Zig, Nim, D |
| **Scripting** | Python, Ruby, PHP, Perl, Lua |
| **.NET** | C#, F#, Visual Basic |
| **Functional** | Elixir, Erlang, Haskell, OCaml, Elm, PureScript |
| **Data/Scientific** | R, Julia, MATLAB |
| **Enterprise** | COBOL, Fortran, Ada, ABAP |
| **Frontend** | TypeScript, JavaScript, Vue, Svelte, Astro |
| **Mobile** | Swift, Kotlin, Dart |

</details>

<details>
<summary><strong>Frameworks & Tools</strong></summary>

| Category | Frameworks |
|----------|------------|
| **Java** | Spring Boot, Quarkus, Micronaut, Dropwizard, Vert.x, Helidon, Jakarta EE |
| **Go** | Gin, Echo, Fiber, Chi, Gorilla Mux, Beego |
| **Rust** | Actix, Axum, Rocket, Warp, Tauri, Yew, Leptos |
| **Python** | Django, FastAPI, Flask, Tornado, Pyramid, Celery, Airflow |
| **Node.js** | Express, NestJS, Fastify, Hapi, Koa, AdonisJS, Strapi |
| **Ruby** | Rails, Sinatra, Hanami, Grape |
| **PHP** | Laravel, Symfony, CakePHP, WordPress, Drupal |
| **.NET** | ASP.NET Core, Blazor, MAUI, Entity Framework |
| **Elixir** | Phoenix, LiveView, Nerves, Absinthe |
| **Frontend** | React, Vue, Angular, Svelte, Solid, Qwik, Astro, htmx |
| **Mobile** | Flutter, React Native, Expo, Capacitor, Ionic |
| **Styling** | Tailwind CSS, Styled Components, Emotion |
| **State** | Redux, Zustand, MobX, Recoil, Jotai, TanStack Query |
| **Testing** | Jest, Vitest, Cypress, Playwright |
| **ORM/Data** | Prisma, TypeORM, Sequelize, SQLAlchemy, Hibernate, Drizzle |
| **Queues** | Kafka, RabbitMQ, BullMQ, NATS, AWS SQS |
| **Databases** | PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, Neo4j, DynamoDB |
| **Auth** | Auth0, Keycloak, Okta, Clerk, NextAuth, Passport |

</details>

<details>
<summary><strong>Infrastructure & DevOps</strong></summary>

| Category | Tools |
|----------|-------|
| **Containers** | Docker, Docker Compose, Podman |
| **Orchestration** | Kubernetes, Helm, Kustomize, Skaffold |
| **IaC** | Terraform, Pulumi, Ansible, CloudFormation, AWS CDK |
| **CI/CD** | GitHub Actions, GitLab CI, Jenkins, Azure Pipelines, CircleCI, ArgoCD, FluxCD, Tekton |
| **Cloud** | Vercel, Netlify, Fly.io, Railway, Heroku, Cloudflare Workers |
| **Serverless** | AWS Lambda, Azure Functions, Google Cloud Functions, Serverless Framework |
| **Observability** | Prometheus, Grafana, Datadog, Sentry, OpenTelemetry, Jaeger |
| **Monorepo** | Nx, Lerna, Turborepo, pnpm Workspaces |

</details>

---

## How It Works

```
Step 1 ──► Run: npx jay-crew -p ~/my-app "your task"
               │
               ▼
Step 2 ──► Jay Crew scans the project locally
           Detects stack, services, and structure
               │
               ▼
Step 3 ──► Auto-selects specialists based on:
           • Keywords in your request
           • Detected technology stack
           • Persona (if specified)
               │
               ▼
Step 4 ──► Generates crew-context-{timestamp}.md
               │
               ▼
Step 5 ──► You paste into Claude Code and say:
           "Run the Jay Crew on this context"
               │
               ▼
Step 6 ──► AI acts as the Orchestrator
           Runs each specialist's X-Ray
           Produces the final Execution Plan
```

---

## Caching

Jay Crew automatically caches project scans to speed up subsequent runs.

### How It Works

On the **first run**, Jay Crew scans your project and saves the results to `.jay-crew-cache/`:

```bash
$ npx jay-crew -p ~/my-project "Analyze this"

🔍  Scanning target project...
✅  234 files scanned in 2.1s
💾  Cache saved to .jay-crew-cache/
```

On **subsequent runs** (if the project hasn't changed), Jay Crew loads from cache instantly:

```bash
$ npx jay-crew -p ~/my-project "Different task"

⚡  Cache hit! Loading previous analysis...
🔬  Stack detected: Java · Spring Boot, Docker, PostgreSQL
```

### Cache Details

- **Location**: `.jay-crew-cache/` inside your project (not in node_modules)
- **Contents**: Project structure hash, detected stack, file list
- **Smart invalidation**: Cache is automatically refreshed if any key files change:
  - `package.json`, `pom.xml`, `build.gradle`, `go.mod`, `Cargo.toml`, `pyproject.toml`
  - Docker config, CI/CD workflows, dependency files
- **Safe**: Add `.jay-crew-cache/` to `.gitignore` (already done by default)

### Bypass Cache

To force a full re-scan without using the cache:

```bash
npx jay-crew --no-cache -p ~/my-project "Force re-scan"
```

---

## The Team

### Core Agents

| Agent | Expertise |
|-------|-----------|
| **Orchestrator** | Coordinates the crew, decides specialists, resolves conflicts, synthesizes the final plan |
| **Radar** | Real-time research — technologies, versions, trends, best practices |
| **Engine** | Deep logic — algorithms, code quality, edge cases, design patterns |
| **Canvas** | Creativity — user flows, UI components, user stories, product strategy |

### Specialist Agents

| Agent | Focus |
|-------|-------|
| `product-owner` | Requirements, acceptance criteria, MoSCoW, Definition of Done |
| `business-analyst` | Business processes, rules, operational flows, entity mapping |
| `software-architect` | System architecture, C4 diagrams, ADRs, scalability |
| `backend-dev` | APIs, database schema, auth, server logic — any backend stack |
| `frontend-dev` | Web UI — any frontend framework |
| `mobile-dev` | Mobile apps — React Native, Flutter, native iOS/Android |
| `data-engineer` | Database design, migrations, query optimization, data pipelines |
| `devops` | Docker, CI/CD, Kubernetes, IaC, observability |
| `security` | OWASP Top 10, dependency vulnerabilities, auth security, compliance |
| `qa` | Testing strategy, coverage analysis, quality red flags |
| `tech-writer` | README, API docs, developer guides, changelogs |
| `ai-ml` | LLM integration, embeddings, RAG, ML pipelines — when AI adds value |
| `performance` | Profiling, caching, query optimization, scalability |

---

## Personas

Use `--persona` (or `-r`) to shape how the Orchestrator presents its analysis.

| Persona | Best for | Auto-boost specialists |
|---------|----------|------------------------|
| `new-dev` | Developer new to the codebase | +tech-writer |
| `senior-dev` | Refactor audit or deep technical review | +performance |
| `tech-migrator` | Planning a stack or framework migration | +radar, +devops |
| `task-executor` | Preparing context for an AI agent task | +qa |
| `tech-lead` | Onboarding material or team briefing | +security, +devops |
| `due-diligence` | Evaluating a legacy or external codebase | +security, +qa, +devops, +radar |

---

## Usage

```bash
npx jay-crew [options] "your request"
```

### Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--project <path>` | `-p` | Path to the target project (default: current directory) |
| `--specialists <list>` | `-s` | Comma-separated list of specific specialists to force |
| `--persona <type>` | `-r` | Persona profile to shape the Orchestrator output |
| `--no-cache` | | Bypass cache and re-scan the project |
| `--help` | `-h` | Show help message |

### Examples

```bash
# Analyze any project — stack is auto-detected
npx jay-crew --project ~/my-project "Full technical analysis"

# Force specific specialists
npx jay-crew -p ~/my-app -s backend-dev,security,data-engineer "Add user audit logs"

# Use personas for different analysis styles
npx jay-crew -p ~/my-app --persona new-dev "Explain the codebase"
npx jay-crew -p ~/my-app --persona senior-dev "Optimize performance"
npx jay-crew -p ~/my-app --persona due-diligence "Full technical audit"
```

### Output

```
✅  234 files scanned in 0.1s — 133 files in context (35 full · 98 skel) · 100 KB used
🔬  Stack detected: Java · Spring Boot, Docker, PostgreSQL
📦  Monorepo with 3 services detected
🧠  Crew selected: software-architect, backend-dev, devops, qa, engine
✅  Context file saved: crew-context-{timestamp}.md
```

**Then paste it into Claude Code and say:**
> _"Run the Jay Crew on this context."_

---

## Smart Crew Selection

Jay Crew selects specialists using **three layers**:

### 1. Keyword-based (from your request)

| Keywords | Specialists Added |
|----------|-------------------|
| auth, login, jwt, oauth | backend-dev, security |
| database, schema, migration | data-engineer |
| docker, kubernetes, ci/cd | devops |
| test, coverage, quality | qa |
| performance, optimize | performance |

### 2. Stack-based (from detected technologies)

| Detected Stack | Specialists Added |
|----------------|-------------------|
| Java, Go, Python, Node.js | backend-dev |
| React, Vue, Angular | frontend-dev |
| Flutter, React Native | mobile-dev |
| Docker, Kubernetes | devops |
| SQL files, Prisma | data-engineer |

### 3. Persona-based (from --persona flag)

| Persona | Auto-adds |
|---------|-----------|
| `due-diligence` | security, qa, devops, radar |
| `tech-migrator` | radar, devops |
| `tech-lead` | security, devops |

---

## Architecture

```
jay-crew/
├── agents/
│   ├── core/
│   │   ├── orchestrator.md   ← Coordination + conflict resolution
│   │   ├── radar.md          ← Research & validation
│   │   ├── engine.md         ← Deep logic & programming
│   │   └── canvas.md         ← UX & product strategy
│   └── specialists/          ← 13 specialist agents
├── src/
│   ├── tools/
│   │   ├── project-scanner.ts   ← Stack detection (200+ techs)
│   │   └── path-utils.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts                 ← CLI entry point
├── bin/
│   └── jay-crew.js              ← npx entry point
└── package.json
```

### Design Principles

- **No API calls** — Jay Crew only reads the filesystem; the AI runs externally
- **Technology agnostic** — Each agent detects and adapts to the project's stack
- **Automatic stack detection** — 80+ languages, 200+ frameworks
- **Monorepo aware** — Identifies and classifies services
- **Smart crew selection** — Keywords + stack + personas
- **Agent definitions as markdown** — Easy to read and extend
- **Bring your own AI** — Works with Claude, ChatGPT, Gemini, or any AI

---

## Requirements

- Node.js 18+

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

---

Made with ❤️ by [Jeferson Siqueira](https://github.com/jeferson0306)
