/**
 * P2 private-context / knowledge gate.
 *
 * P2 stays synthetic. There is no allowed private source in P2.1:
 * no file read, no P0 volume, no Qdrant, no connector.
 */

export const P2_CONTEXT_STATES = ["synthetic", "private_declared_absent", "private_blocked"] as const;
export type P2ContextState = (typeof P2_CONTEXT_STATES)[number];

const BLOCKED_ENV_KEYS = [
  "CONTEXT_FILE",
  "QDRANT_URL",
  "QDRANT_HOST",
  "QDRANT_API_KEY",
  "MODEL_PORT_URL",
  "PILOT_P2_CONTEXT_VOLUME",
  "PILOT_CONTEXT_VOLUME",
] as const;

export type P2ContextGate = {
  readonly state: P2ContextState;
};

function present(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function privateFlag(env: Record<string, string | undefined>): boolean {
  const mode = env.PILOT_P2_CONTEXT_MODE ?? env.CONTEXT_MODE;
  return mode === "private";
}

function blockedWiring(env: Record<string, string | undefined>): boolean {
  for (const key of BLOCKED_ENV_KEYS) {
    if (present(env[key])) return true;
  }
  return false;
}

export function resolveP2ContextGate(
  env: Record<string, string | undefined> = process.env,
): P2ContextGate {
  if (blockedWiring(env)) return { state: "private_blocked" };
  if (privateFlag(env)) return { state: "private_declared_absent" };
  return { state: "synthetic" };
}

export function p2ContextWriteError(gate: P2ContextGate): string | null {
  if (gate.state === "synthetic") return null;
  return gate.state;
}
