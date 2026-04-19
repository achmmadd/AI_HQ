import { AppShell } from "@/components/app-shell";
import { KennisbankSearch } from "@/components/kennisbank-search";

export default function KennisbankPage() {
  return (
    <AppShell title="Kennisbank">
      <KennisbankSearch />
    </AppShell>
  );
}
