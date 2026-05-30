export type CompanyId = "fumero" | "bokas";
export type ChatKlant = CompanyId | "system";
export type WorkspaceId = "fumero" | "bokas" | "personal";

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
  /** `chat_history.id` voor feedback (alleen assistant). */
  chatHistoryId?: number;
  experimentId?: number;
  experimentVariant?: "a" | "b";
  experimentName?: string;
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
