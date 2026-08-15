/**
 * P2.0 bind policy — loopback or one explicit tailnet address. Never 0.0.0.0.
 */

export const P2_DEFAULT_HOST = "127.0.0.1";
export const P2_DEFAULT_PORT = 4420;
export const P2_PINNED_HOST = "100.97.30.22";
export const P2_PINNED_PORT = 4420;
export const P2_PINNED_ORIGIN = "http://100.97.30.22:4420/motor";

const FORBIDDEN_HOSTS = new Set(["0.0.0.0", "::", "[::]", "*", ""]);

export type P2Bind = {
  readonly host: string;
  readonly port: number;
};

export function assertSafeBindHost(host: string): string {
  const trimmed = host.trim();
  if (FORBIDDEN_HOSTS.has(trimmed) || trimmed.toLowerCase() === "0.0.0.0") {
    throw new Error("P2.0 refuses to bind 0.0.0.0 or a wildcard address");
  }
  return trimmed;
}

export function resolveP2Bind(env: NodeJS.ProcessEnv = process.env): P2Bind {
  const host = assertSafeBindHost(env.PILOT_P2_HOST ?? P2_DEFAULT_HOST);
  const port = Number(env.PILOT_P2_PORT ?? String(P2_DEFAULT_PORT));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("P2.0 port is invalid");
  }
  return { host, port };
}
