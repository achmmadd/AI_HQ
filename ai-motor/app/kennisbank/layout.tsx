import { KennisbankCatalog } from "@/components/kennisbank-catalog";
import { KennisbankChunkPreview } from "@/components/kennisbank-chunk-preview";
import { KennisbankFileIngest } from "@/components/kennisbank-file-ingest";

export default function KennisbankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      {children}
      <KennisbankCatalog />
      <KennisbankFileIngest />
      <KennisbankChunkPreview />
    </div>
  );
}
