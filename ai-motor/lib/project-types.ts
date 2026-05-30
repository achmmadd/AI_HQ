export type ProjectStack = "vanilla" | "react" | "next";

/** Gestructureerde specificatie uit een domein/business-prompt. */
export type ProjectSpec = {
  title: string;
  pages: string[];
  features: string[];
  klant: string;
  description?: string;
  stack?: ProjectStack;
};

/** Multi-file project: pad → broncode. */
export type ProjectFiles = Record<string, string>;

export type BuildProjectRow = {
  id: number;
  title: string;
  slug: string;
  klant: string;
  spec_json: string;
  files_json: string;
  conversation_id: number | null;
  created_at: string;
  updated_at: string;
};
