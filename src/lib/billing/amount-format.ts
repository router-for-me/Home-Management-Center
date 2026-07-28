type AmountLocale = string | string[] | undefined

const SUMMARY_FRACTION_DIGITS = 2
const PRECISE_FRACTION_DIGITS = 6

function formatThreshold(fractionDigits: number, locale: AmountLocale) {
  const threshold = 10 ** -fractionDigits
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  }).format(threshold)
}

function formatAmount(
  value: number,
  locale: AmountLocale,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
) {
  const normalizedValue = value === 0 ? 0 : value
  const absoluteValue = Math.abs(normalizedValue)
  const threshold = 10 ** -maximumFractionDigits

  if (absoluteValue > 0 && absoluteValue < threshold) {
    const sign = normalizedValue < 0 ? '-' : ''
    return `${sign}<${formatThreshold(maximumFractionDigits, locale)}`
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(normalizedValue)
}

function formatSignedAmount(value: number, formatter: (value: number) => string) {
  const normalizedValue = value === 0 ? 0 : value
  const absolute = formatter(Math.abs(normalizedValue))
  if (normalizedValue === 0) return absolute
  return `${normalizedValue > 0 ? '+' : '-'}${absolute}`
}

export function formatCreditAmount(value: number, locale?: AmountLocale) {
  return formatAmount(value, locale, SUMMARY_FRACTION_DIGITS, SUMMARY_FRACTION_DIGITS)
}

export function formatSignedCreditAmount(value: number, locale?: AmountLocale) {
  return formatSignedAmount(value, (absolute) => formatCreditAmount(absolute, locale))
}

export function formatDetailedCreditAmount(value: number, locale?: AmountLocale) {
  return formatAmount(value, locale, SUMMARY_FRACTION_DIGITS, PRECISE_FRACTION_DIGITS)
}

export function formatSignedDetailedCreditAmount(value: number, locale?: AmountLocale) {
  return formatSignedAmount(value, (absolute) => formatDetailedCreditAmount(absolute, locale))
}

export function formatModelPrice(value: number, locale?: AmountLocale) {
  return formatAmount(value, locale, SUMMARY_FRACTION_DIGITS, PRECISE_FRACTION_DIGITS)
}

export function formatUsageAmount(value: number, locale?: AmountLocale) {
  return formatAmount(value, locale, SUMMARY_FRACTION_DIGITS, PRECISE_FRACTION_DIGITS)
}
