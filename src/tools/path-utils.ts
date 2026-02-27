import path from "node:path";
import type { FileNode } from "../types/index.js";

export function resolveProjectPath(input: string): string {
  if (path.isAbsolute(input)) return path.normalize(input);
  return path.resolve(process.cwd(), input);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function treeToString(node: FileNode, prefix = "", isLast = true): string {
  const connector = isLast ? "└── " : "├── ";
  const childPrefix = isLast ? "    " : "│   ";

  let result = prefix + connector + node.name;
  if (node.type === "dir") result += "/";
  if (node.size !== undefined && node.type === "file") {
    result += `  (${formatBytes(node.size)})`;
  }
  result += "\n";

  if (node.children && node.children.length > 0) {
    node.children.forEach((child, idx) => {
      const last = idx === node.children!.length - 1;
      result += treeToString(child, prefix + childPrefix, last);
    });
  }

  return result;
}

export function projectTreeString(root: FileNode): string {
  let result = root.name + "/\n";
  if (root.children && root.children.length > 0) {
    root.children.forEach((child, idx) => {
      const last = idx === root.children!.length - 1;
      result += treeToString(child, "", last);
    });
  }
  return result;
}
