export type CompanyId = "fumero" | "bokas";

export interface ServiceStatus {
  n8n: boolean;
  qdrant: boolean;
  ollama: boolean;
  dify: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface Department {
  id: string;
  name: string;
  handle: string;
  status: "idle" | "active" | "error";
  lastActivity?: string;
  costEur?: number;
}

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  category: string;
  state: "installed" | "available" | "soon";
  costHint?: string;
}
