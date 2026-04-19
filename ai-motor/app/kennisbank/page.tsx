import { AppShell } from "@/components/app-shell";
import { KennisbankSearch } from "@/components/kennisbank-search";
import { KennisbankAdd } from "@/components/kennisbank-add";

export default function KennisbankPage() {
  return (
    <AppShell title="Kennisbank">
      <div className="space-y-8">
        <KennisbankAdd />
        <KennisbankSearch />
      </div>
    </AppShell>
  );
}
