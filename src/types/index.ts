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

export interface ProjectSnapshot {
  projectPath: string;
  projectName: string;
  tree: FileNode;
  stats: FileStats;
  configFiles: Record<string, string>;
  depFiles: Record<string, string>;
  sourceSamples: Record<string, string>;
  entryPoints: string[];
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
