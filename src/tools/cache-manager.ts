import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export interface CacheMetadata {
  timestamp: number;
  projectHash: string;
  "jay-crew-version": string;
  fileHashes: Record<string, string>;
}

export interface CacheEntry {
  metadata: CacheMetadata;
  detectedStack: any;
  prioritizedFiles: any;
}

const CACHE_DIR = ".jay-crew-cache";
const METADATA_FILE = "metadata.json";
const DETECTION_FILE = "detection.json";

export async function initializeCache(projectPath: string): Promise<void> {
  const cachePath = path.join(projectPath, CACHE_DIR);
  try {
    await fs.mkdir(cachePath, { recursive: true });

    // Create .gitignore in cache directory
    const gitignorePath = path.join(cachePath, ".gitignore");
    try {
      await fs.access(gitignorePath);
    } catch {
      await fs.writeFile(gitignorePath, "*\n!.gitignore\n");
    }
  } catch {
    // Silently fail if we can't create cache dir
  }
}

function calculateFileHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function getKeyFileHashes(
  projectPath: string
): Promise<Record<string, string>> {
  const keyFiles = [
    "package.json",
    "package-lock.json",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "go.mod",
    "go.sum",
    "Cargo.toml",
    "pyproject.toml",
    "requirements.txt",
    "Gemfile",
    ".ruby-version",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".dockerignore",
    "Dockerfile",
    ".github/workflows",
    ".gitlab-ci.yml",
    ".travis.yml",
  ];

  const hashes: Record<string, string> = {};

  for (const file of keyFiles) {
    const filePath = path.join(projectPath, file);
    try {
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        // For directories, hash the list of files inside
        const files = await fs.readdir(filePath);
        hashes[file] = calculateFileHash(files.sort().join("\n"));
      } else {
        // For files, hash the content
        const content = await fs.readFile(filePath, "utf-8");
        hashes[file] = calculateFileHash(content);
      }
    } catch {
      // File doesn't exist, skip it
    }
  }

  return hashes;
}

function calculateProjectHash(fileHashes: Record<string, string>): string {
  const sortedKeys = Object.keys(fileHashes).sort();
  const hashString = sortedKeys.map((k) => `${k}:${fileHashes[k]}`).join("|");
  return calculateFileHash(hashString);
}

export async function getCachedResult(
  projectPath: string,
  useCache: boolean
): Promise<CacheEntry | null> {
  if (!useCache) return null;

  const cachePath = path.join(projectPath, CACHE_DIR);
  const metadataPath = path.join(cachePath, METADATA_FILE);

  try {
    const metadataContent = await fs.readFile(metadataPath, "utf-8");
    const cached = JSON.parse(metadataContent) as CacheMetadata;

    // Check if any key files have changed
    const currentHashes = await getKeyFileHashes(projectPath);
    const currentHash = calculateProjectHash(currentHashes);

    if (currentHash === cached.projectHash) {
      // Cache is valid, load the detection result
      const detectionPath = path.join(cachePath, DETECTION_FILE);
      const detectionContent = await fs.readFile(detectionPath, "utf-8");
      const detection = JSON.parse(detectionContent);

      return {
        metadata: cached,
        detectedStack: detection.detectedStack,
        prioritizedFiles: detection.prioritizedFiles,
      };
    }
  } catch {
    // Cache doesn't exist or is invalid
  }

  return null;
}

export async function saveCache(
  projectPath: string,
  detectedStack: any,
  prioritizedFiles: any
): Promise<void> {
  const cachePath = path.join(projectPath, CACHE_DIR);

  try {
    await initializeCache(projectPath);

    const fileHashes = await getKeyFileHashes(projectPath);
    const projectHash = calculateProjectHash(fileHashes);

    const metadata: CacheMetadata = {
      timestamp: Date.now(),
      projectHash,
      "jay-crew-version": "0.1.1",
      fileHashes,
    };

    const metadataPath = path.join(cachePath, METADATA_FILE);
    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      "utf-8"
    );

    const detectionPath = path.join(cachePath, DETECTION_FILE);
    await fs.writeFile(
      detectionPath,
      JSON.stringify(
        {
          detectedStack,
          prioritizedFiles,
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch {
    // Silently fail if we can't save cache (don't break the tool)
  }
}

export function getCacheDirName(): string {
  return CACHE_DIR;
}
