import Link from "next/link";
import { ArrowLeft, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOTORSAI } from "@/lib/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#69C400]/15 ring-1 ring-[#69C400]/25">
        <Cpu className="h-6 w-6 text-[#69C400]" aria-hidden />
      </div>
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        Pagina niet gevonden
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Deze pagina bestaat niet of is verplaatst. Ga terug naar home of neem contact op via{" "}
        <a href={`mailto:${MOTORSAI.contactEmail}`} className="text-[#69C400] underline">
          {MOTORSAI.contactEmail}
        </a>
        .
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button className="gap-2 rounded-xl bg-[#69C400] hover:bg-[#5db000]" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Naar home
          </Link>
        </Button>
        <Button variant="outline" className="rounded-xl" asChild>
          <Link href="/demo">Plan een demo</Link>
        </Button>
      </div>
    </div>
  );
}
