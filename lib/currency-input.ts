export function parseCurrencyInput(value: string) {
  const normalized = normalizeCurrencyInput(value);
  return normalized === "" ? 0 : Number(normalized);
}

export function formatCurrencyInput(value: string | number) {
  const numeric = typeof value === "number" ? value : parseCurrencyInput(value);

  if (!Number.isFinite(numeric) || numeric === 0) {
    return "";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numeric);
}

function normalizeCurrencyInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const signal = trimmed.startsWith("-") ? "-" : "";
  const sanitized = trimmed.replace(/[^\d,.-]/g, "");
  const unsigned = sanitized.replace(/-/g, "");

  if (!unsigned) {
    return "";
  }

  const separators = [...unsigned.matchAll(/[.,]/g)];

  if (!separators.length) {
    const digits = unsigned.replace(/\D/g, "");
    return digits ? `${signal}${Number(digits) / 100}` : "";
  }

  const lastSeparator = separators[separators.length - 1];
  const lastSeparatorIndex = lastSeparator.index ?? -1;
  const integerPart = unsigned.slice(0, lastSeparatorIndex);
  const decimalPart = unsigned.slice(lastSeparatorIndex + 1);
  const integerDigits = integerPart.replace(/\D/g, "");
  const decimalDigits = decimalPart.replace(/\D/g, "");
  const hasSingleSeparator = separators.length === 1;

  if (hasSingleSeparator && decimalDigits.length === 3) {
    return `${signal}${integerDigits}${decimalDigits}`;
  }

  if (!decimalDigits) {
    return integerDigits ? `${signal}${integerDigits}` : "";
  }

  const normalizedInteger = integerDigits || "0";
  const normalizedDecimal = decimalDigits.slice(0, 2).padEnd(2, "0");
  return `${signal}${normalizedInteger}.${normalizedDecimal}`;
}
