export function cleanFiscalId(value: string) {
  return value.replace(/[-\s]/g, "");
}

export function isValidRncOrCedula(value: string) {
  const clean = cleanFiscalId(value);
  return /^\d+$/.test(clean) && (clean.length === 9 || clean.length === 11);
}

export function isValidENcf(value: string) {
  return /^E\d{12}$/.test(value);
}

export function formatMoney(value: number) {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function formatEcfDate(value: Date) {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const year = value.getUTCFullYear();

  return `${day}-${month}-${year}`;
}

export function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
