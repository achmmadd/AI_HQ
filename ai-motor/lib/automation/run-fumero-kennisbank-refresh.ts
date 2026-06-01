import { runTenantKennisbankRefresh } from "@/lib/scrape/kennisbank-refresh";

export async function runFumeroKennisbankRefresh(): Promise<{
  ok: boolean;
  detail: string;
}> {
  return runTenantKennisbankRefresh("fumero");
}
