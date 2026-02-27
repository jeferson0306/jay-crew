// ─── Target project snapshot ──────────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: FileNode[];
}

export interface FileStats {
  totalFiles: number;
  totalBytes: number;
  byExtension: Record<string, number>;
  largestFiles: Array<{ path: string; size: number }>;
}

export interface SourceSampleMeta {
  totalInContext: number;   // total files included in context
  fullCount: number;        // files read fully
  skeletalCount: number;    // files read as skeleton
  budgetUsedBytes: number;  // total bytes consumed by source samples
  p0Count: number;          // P0 files included (schemas/migrations/docs)
  p1Count: number;          // P1 files included (core logic)
  p2Count: number;          // P2 files included (other, skeletal)
}

export interface ProjectSnapshot {
  projectPath: string;
  projectName: string;
  tree: FileNode;
  stats: FileStats;
  configFiles: Record<string, string>;
  depFiles: Record<string, string>;
  sourceSamples: Record<string, string>;
  entryPoints: string[];
  sourceMeta: SourceSampleMeta;
}

// ─── Available roles in Jay Crew ──────────────────────────────────────────────

export type SpecialistRole =
  | "radar"              // Real-Time Research & Validation
  | "engine"             // Deep Logic & Programming
  | "canvas"             // Creativity, UX & Product Strategy
  | "product-owner"      // Requirements & User Stories
  | "business-analyst"   // Business Processes & Rules
  | "software-architect" // Architecture & Technical Decisions
  | "backend-dev"        // APIs, Database, Authentication
  | "frontend-dev"       // Next.js, React, Tailwind, TypeScript
  | "mobile-dev"         // React Native, Flutter, iOS/Android
  | "devops"             // Docker, CI/CD, Kubernetes, IaC
  | "security"           // OWASP, Pentest, Compliance
  | "qa"                 // Unit, Integration & E2E Testing
  | "tech-writer"        // Docs, README, Swagger/OpenAPI
  | "ai-ml"              // LLMs, Embeddings, RAG, ML Pipelines
  | "performance";       // Optimization, Scalability, Cost

// ─── Persona profiles for Orchestrator output shaping ─────────────────────────

export type PersonaRole =
  | "new-dev"        // Guided, educational, step-by-step
  | "senior-dev"     // Concise, technical depth, patterns & tradeoffs
  | "tech-migrator"  // Migration planning, current→target state
  | "task-executor"  // Direct implementation, production-ready code
  | "tech-lead"      // Architectural decisions, ADRs, team impact
  | "due-diligence"; // Risk analysis, tech debt, security, compliance
