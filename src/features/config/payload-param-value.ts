type PayloadParamValueType = 'string' | 'number' | 'boolean' | 'json'

type PayloadParamEntry = {
  path: string
  valueType: PayloadParamValueType
  value: string
}

function stringifyPayloadPrimitiveValue(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return ''
}

function parsePayloadParamValue(value: unknown): {
  valueType: PayloadParamValueType
  value: string
} {
  if (typeof value === 'number') {
    return { valueType: 'number', value: String(value) }
  }
  if (typeof value === 'boolean') {
    return { valueType: 'boolean', value: String(value) }
  }
  if (value === null || typeof value === 'object') {
    return { valueType: 'json', value: JSON.stringify(value, null, 2) }
  }

  return { valueType: 'string', value: stringifyPayloadPrimitiveValue(value) }
}

function serializePayloadParamValue(param: PayloadParamEntry): unknown {
  const value = param.value.trim()

  if (param.valueType === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : param.value
  }
  if (param.valueType === 'boolean') {
    return value.toLowerCase() === 'true'
  }
  if (param.valueType === 'json') {
    try {
      return JSON.parse(param.value) as unknown
    } catch {
      return param.value
    }
  }

  return param.value
}

// Compare the decimal value that would actually be written, allowing equivalent spellings.
function decimalSignature(value: string) {
  const [mantissa, exponent = '0'] = value.toLowerCase().split('e')
  const [whole, fraction = ''] = mantissa.split('.')
  const significant = (whole + fraction).replace(/^[+-]?0*/, '')
  if (!significant) return '0'
  let end = significant.length
  while (significant[end - 1] === '0') end--
  const power = Number(exponent) - fraction.length + (significant.length - end)
  return `${mantissa.startsWith('-') ? '-' : ''}${significant.slice(0, end)}e${power}`
}

function preservesNumber(value: string) {
  const number = Number(value)
  if (!Number.isFinite(number)) return false
  if (/^0[xbo]/i.test(value)) return BigInt(value) === BigInt(number)
  return decimalSignature(value) === decimalSignature(String(number))
}

function getPayloadParamValidationError(param: PayloadParamEntry, rawValues = false) {
  const value = param.value.trim()

  if (rawValues || param.valueType === 'json') {
    try {
      JSON.parse(value)
    } catch {
      return 'json'
    }
    if (!rawValues) {
      // Skip quoted strings, including keys and escaped quotes, when checking JSON numbers.
      for (const [token] of value.matchAll(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)) {
        if (token[0] !== '"' && !preservesNumber(token)) return 'precision'
      }
    }
    return null
  }
  if (param.valueType === 'number') {
    if (!value || Number.isNaN(Number(value)) || /^[+-]?Infinity$/.test(value)) return 'number'
    return preservesNumber(value) ? null : 'precision'
  }
  if (param.valueType === 'boolean') {
    const normalized = value.toLowerCase()
    return normalized === 'true' || normalized === 'false' ? null : 'boolean'
  }
  return null
}

function convertPayloadParamValue(
  param: PayloadParamEntry,
  raw: boolean,
): Pick<PayloadParamEntry, 'valueType' | 'value'> {
  if (!param.path.trim() && param.value === '')
    return { valueType: raw ? 'json' : 'string', value: '' }
  if (raw) {
    if (
      param.valueType === 'number' &&
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(param.value.trim())
    ) {
      return { valueType: 'json', value: param.value }
    }
    const value =
      param.valueType === 'json' || getPayloadParamValidationError(param)
        ? param.value
        : JSON.stringify(serializePayloadParamValue(param), null, 2)
    return { valueType: 'json', value }
  }
  try {
    const parsed = JSON.parse(param.value) as unknown
    if (typeof parsed === 'number') return { valueType: 'number', value: param.value }
    if (parsed === null || typeof parsed === 'object')
      return { valueType: 'json', value: param.value }
    return parsePayloadParamValue(parsed)
  } catch {
    return { valueType: 'json', value: param.value }
  }
}

function getPayloadParamPathIssues(params: PayloadParamEntry[]) {
  const seen = new Set<string>()
  return params.map((param) => {
    const path = param.path.trim()
    if (!path) return 'paramPathRequired'
    if (seen.has(path)) return 'paramPathDuplicate'
    seen.add(path)
    return null
  })
}

export {
  type PayloadParamEntry,
  type PayloadParamValueType,
  convertPayloadParamValue,
  getPayloadParamPathIssues,
  getPayloadParamValidationError,
  parsePayloadParamValue,
  serializePayloadParamValue,
  stringifyPayloadPrimitiveValue,
}
