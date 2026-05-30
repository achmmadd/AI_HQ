"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroPageHeader } from "@/components/fumero/ops/fumero-page-header";

export default function FumeroPayPage() {
  return (
    <FumeroShell page="Pay">
      <div className="mx-auto max-w-lg">
        <FumeroPageHeader
          title="Pay"
          description="Bank- en cryptobetalingen via Max."
        />
        <div className="space-y-3 rounded-lg border border-[#E5E5E5] bg-white p-6 text-sm text-[#525252]">
          <p>
            Placeholder tot betalingen live gaan. Routes{" "}
            <code className="text-xs">/api/fumero/pay/initiate</code> en status zijn
            geïmplementeerd; zonder env-keys geeft initiate een duidelijke 503.
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs text-[#737373]">
            <li>Bank: FUMERO_PAY_IBAN, FUMERO_PAY_BENEFICIARY (optioneel BIC)</li>
            <li>Crypto: FUMERO_PAY_CRYPTO_WALLET (optioneel network/asset)</li>
          </ul>
        </div>
      </div>
    </FumeroShell>
  );
}
