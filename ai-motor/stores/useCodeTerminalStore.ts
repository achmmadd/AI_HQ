import { create } from "zustand";

type CodeTerminalState = {
  outputByKey: Record<string, string>;
  appendOutput: (key: string, text: string) => void;
  setOutput: (key: string, text: string) => void;
  clearOutput: (key: string) => void;
};

export function codeTerminalKey(klant: string, workspace: string): string {
  return `${klant}:${workspace}`;
}

export const useCodeTerminalStore = create<CodeTerminalState>((set) => ({
  outputByKey: {},
  appendOutput: (key, text) =>
    set((state) => ({
      outputByKey: {
        ...state.outputByKey,
        [key]: `${state.outputByKey[key] ?? ""}${text}`,
      },
    })),
  setOutput: (key, text) =>
    set((state) => ({
      outputByKey: { ...state.outputByKey, [key]: text },
    })),
  clearOutput: (key) =>
    set((state) => {
      const next = { ...state.outputByKey };
      delete next[key];
      return { outputByKey: next };
    }),
}));
