export type CodeAgentToolName =
  | "read_file"
  | "write_file"
  | "list_files"
  | "run_command"
  | "search_codebase";

export const CODE_AGENT_TOOLS = [
  {
    name: "read_file",
    description: "Lees de inhoud van een bestand in de workspace (relatief pad)",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relatief pad binnen het project" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Schrijf of overschrijf een bestand in de workspace",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relatief pad" },
        content: { type: "string", description: "Volledige bestandsinhoud" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "Lijst bestanden in een directory (leeg = project root)",
    input_schema: {
      type: "object" as const,
      properties: {
        directory: {
          type: "string",
          description: "Relatief pad naar directory, of leeg voor root",
        },
      },
    },
  },
  {
    name: "run_command",
    description:
      "Voer een veilig commando uit in de workspace (npm, git status, ls, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Commando om uit te voeren" },
      },
      required: ["command"],
    },
  },
  {
    name: "search_codebase",
    description: "Zoek tekst in bestanden via grep",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Zoekterm" },
        filePattern: {
          type: "string",
          description: "Glob patroon bijv. *.ts",
        },
      },
      required: ["query"],
    },
  },
];
