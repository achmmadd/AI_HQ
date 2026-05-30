export type FumeroPayBankMeta = {
  iban: string;
  beneficiary: string;
  qr_payload: string;
};

export type FumeroPayCryptoMeta = {
  wallet: string;
  network: string;
  asset: string;
  amount_usdt: string;
};

export function fumeroPayBankMeta(
  amount: number,
  ref: string
): FumeroPayBankMeta {
  const iban =
    process.env.FUMERO_PAY_IBAN?.trim() || "NL00BANK0000000000";
  const beneficiary =
    process.env.FUMERO_PAY_BENEFICIARY?.trim() || "Fumero B.V.";
  const bic = process.env.FUMERO_PAY_BIC?.trim() || "BICPLACEHOLDER";
  return {
    iban,
    beneficiary,
    qr_payload: `BCD|001|1|SCT|${bic}|${beneficiary}|${iban}|EUR${amount.toFixed(2)}|${ref}`,
  };
}

export function fumeroPayCryptoMeta(amount: number): FumeroPayCryptoMeta {
  return {
    wallet:
      process.env.FUMERO_PAY_CRYPTO_WALLET?.trim() ||
      process.env.FUMERO_CRYPTO_WALLET?.trim() ||
      "",
    network: process.env.FUMERO_PAY_CRYPTO_NETWORK?.trim() || "ERC20",
    asset: process.env.FUMERO_PAY_CRYPTO_ASSET?.trim() || "USDT",
    amount_usdt: amount.toFixed(2),
  };
}

export function isFumeroPayConfigured(method: "bank" | "crypto"): boolean {
  if (method === "bank") {
    return Boolean(process.env.FUMERO_PAY_IBAN?.trim());
  }
  return Boolean(
    process.env.FUMERO_PAY_CRYPTO_WALLET?.trim() ||
      process.env.FUMERO_CRYPTO_WALLET?.trim()
  );
}
