import type { CodeTreeNode } from "@/lib/code-workspace";

export function flattenFilePaths(nodes: CodeTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "file") paths.push(node.path);
    else if (node.children?.length) paths.push(...flattenFilePaths(node.children));
  }
  return paths.sort((a, b) => a.localeCompare(b));
}
