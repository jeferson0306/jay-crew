import { runXRay as radarXRay } from "./core/radar.js";
import { runXRay as engineXRay } from "./core/engine.js";
import { runXRay as canvasXRay } from "./core/canvas.js";
import { runXRay as productOwnerXRay } from "./specialists/product-owner.js";
import { runXRay as businessAnalystXRay } from "./specialists/business-analyst.js";
import { runXRay as softwareArchitectXRay } from "./specialists/software-architect.js";
import { runXRay as backendDevXRay } from "./specialists/backend-dev.js";
import { runXRay as frontendDevXRay } from "./specialists/frontend-dev.js";
import { runXRay as mobileDevXRay } from "./specialists/mobile-dev.js";
import { runXRay as devopsXRay } from "./specialists/devops.js";
import { runXRay as securityXRay } from "./specialists/security.js";
import { runXRay as qaXRay } from "./specialists/qa.js";
import { runXRay as techWriterXRay } from "./specialists/tech-writer.js";
import { runXRay as aimlXRay } from "./specialists/ai-ml.js";
import { runXRay as performanceXRay } from "./specialists/performance.js";
import type { AgentXRayFn, SpecialistRole } from "../types/index.js";

export const REGISTRY: Record<SpecialistRole, AgentXRayFn> = {
  "radar": radarXRay,
  "engine": engineXRay,
  "canvas": canvasXRay,
  "product-owner": productOwnerXRay,
  "business-analyst": businessAnalystXRay,
  "software-architect": softwareArchitectXRay,
  "backend-dev": backendDevXRay,
  "frontend-dev": frontendDevXRay,
  "mobile-dev": mobileDevXRay,
  "devops": devopsXRay,
  "security": securityXRay,
  "qa": qaXRay,
  "tech-writer": techWriterXRay,
  "ai-ml": aimlXRay,
  "performance": performanceXRay,
};

export const VALID_ROLES = Object.keys(REGISTRY) as SpecialistRole[];
