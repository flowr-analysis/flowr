import { SinglePackageInfo } from './usedPackages'
import { FunctionNameInfo } from './definedFunctions'
import { Feature, FeatureInfo, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { append, extractNodeContent } from '../statisticsFile'

export interface UsedFunction {
  package:  SinglePackageInfo,
  function: FunctionNameInfo
}


// TODO: get corresponding package with getNamespaceExports etc?
export interface FunctionUsageInfo extends FeatureInfo {
  allCalls:                   number
  /** abs, expm1, tanpi, ... */
  mathFunctions:              number
  /** nargs, missing, is.character, ... */
  programmingFunctions:       number
  /** browser, proc.time, gc.time, ... */
  sessionManagementFunctions: number
  /** `:`, `~`, `c`, `UseMethod`, `.C`, ... */
  primitiveFunctions:         number
  /** e.g. do not evaluate part of functions, `quote`, ... */
  specialPrimitiveFunctions:  number
  /** `.Primitive`, `.Internal`, `lazyLoadDBfetch`, ... */
  internalFunctions:          number
}

export const initialFunctionUsageInfo = (): FunctionUsageInfo => ({
  allCalls:                   0,
  mathFunctions:              0,
  programmingFunctions:       0,
  sessionManagementFunctions: 0,
  primitiveFunctions:         0,
  specialPrimitiveFunctions:  0,
  internalFunctions:          0
})

function from(...names: string[]): RegExp {
  return new RegExp(names.join('|'))
}

/** from R internals */
const mathFunctions = from('abs', 'sign', 'sqrt', 'floor', 'ceiling',
  'exp', 'expm1', 'log2', 'log10', 'log1p', 'cos', 'sin', 'tan', 'acos', 'asin', 'atan',
  'cosh', 'sinh', 'tanh', 'acosh', 'asinh', 'atanh', 'cospi', 'sinpi', 'tanpi', 'gamma',
  'lgamma', 'digamma', 'trigamma', 'cumsum', 'cumprod', 'cummax', 'cummin',
  'Im', 'Re', 'Arg', 'Conj', 'Mod')

const programmingFunctions = from('nargs', 'missing', 'on.exit', 'interactive',
  'as.call', 'as.character', 'as.complex', 'as.double', 'as.environment', 'as.integer', 'as.logical', 'as.raw',
  'is.array', 'is.atomic', 'is.call', 'is.character', 'is.complex', 'is.double', 'is.environment', 'is.expression',
  'is.finite', 'is.function', 'is.infinite', 'is.integer', 'is.language', 'is.list', 'is.logical', 'is.matrix',
  'is.na', 'is.name', 'is.nan', 'is.null', 'is.numeric', 'is.object', 'is.pairlist', 'is.raw',
  'is.real', 'is.recursive', 'is.single', 'is.symbol', 'baseenv', 'emptyenv', 'globalenv', 'pos.to.env',
  'unclass', 'invisible', 'seq_along', 'seq_len')

const sessionManagementFunctions = from('browser', 'proc.time', 'gc.time', 'tracemem', 'retracemem', 'untracemem')

function collectFunctionByName(names: string[], info: FunctionUsageInfo, field: keyof FunctionUsageInfo, name: RegExp, filepath: string | undefined): void {
  const matchingNames = names.filter(n => name.test(n))
  info[field] += matchingNames.length
  append(usedFunctions.name, field, matchingNames, filepath)
}


const functionCallQuery: Query = xpath.parse(`//SYMBOL_FUNCTION_CALL`)

export const usedFunctions: Feature<FunctionUsageInfo> = {
  name:        'used functions',
  description: 'all functions called, split into various sub-categories',

  append(existing: FunctionUsageInfo, input: Document, filepath: string | undefined): FunctionUsageInfo {
    const allFunctionCalls = functionCallQuery.select({ node: input })

    existing.allCalls += allFunctionCalls.length
    append(this.name, 'allFunctionCalls', allFunctionCalls, filepath)

    const names = allFunctionCalls.map(extractNodeContent)

    collectFunctionByName(names, existing, 'mathFunctions', mathFunctions, filepath)
    collectFunctionByName(names, existing, 'programmingFunctions', programmingFunctions, filepath)
    collectFunctionByName(names, existing, 'sessionManagementFunctions', sessionManagementFunctions, filepath)

    return existing
  },

  toString(data: FunctionUsageInfo): string {
    return `---used functions-------------
\tall calls: ${data.allCalls}
\t\tsys.*: ${data.systemCalls}
    `
  }
}
