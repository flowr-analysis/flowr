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
  internalFunctions:          number,
  /** `body`, `environment`, `formals` */
  metaFunctions:              number,
  /** return */
  returnFunction:             number
  // TODO: from the list
}

export const initialFunctionUsageInfo = (): FunctionUsageInfo => ({
  allCalls:                   0,
  mathFunctions:              0,
  programmingFunctions:       0,
  sessionManagementFunctions: 0,
  primitiveFunctions:         0,
  specialPrimitiveFunctions:  0,
  internalFunctions:          0,
  metaFunctions:              0,
  returnFunction:             0
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

const markedAsInternalOnly = ['.Primitive', '.Internal',
  '.Call.graphics', '.External.graphics', '.subset', '.subset2',
  '.primTrace', '.primUntrace', 'lazyLoadDBfetch']

const primitiveFunctions = from(':', '~', 'c', 'list', 'call', 'switch', 'expression', 'substitute',
  'UseMethod', 'standardGeneric', '.C', '.Fortran', '.Call', '.External',
  'round', 'signif', 'rep', 'seq.int', ...markedAsInternalOnly)

const specialPrimitiveFunctions = from('quote', 'substitute', 'missing', 'on.exit', 'call', 'expression', '.Internal')

const internalOnlyFunctions = from(...markedAsInternalOnly)

const metaFunctions = from('body', 'environment', 'formals')

const returnFunction = from('return')

function collectFunctionByName(names: string[], info: FunctionUsageInfo, field: keyof FunctionUsageInfo, name: RegExp): void {
  collectFunctionByPredicate(names, info, field, n => name.test(n))
}

function collectFunctionByPredicate(names: string[], info: FunctionUsageInfo, field: keyof FunctionUsageInfo, pred: (name: string) => boolean): void {
  const matchingNames = names.filter(pred)
  info[field] += matchingNames.length
  // as they all are recorded as part of the allFunctionCalls, we do not need to append them separately
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

    collectFunctionByName(names, existing, 'mathFunctions', mathFunctions)
    collectFunctionByName(names, existing, 'programmingFunctions', programmingFunctions)
    collectFunctionByName(names, existing, 'sessionManagementFunctions', sessionManagementFunctions)
    collectFunctionByName(names, existing, 'primitiveFunctions', primitiveFunctions)
    collectFunctionByName(names, existing, 'specialPrimitiveFunctions', specialPrimitiveFunctions)
    collectFunctionByName(names, existing, 'internalFunctions', internalOnlyFunctions)
    collectFunctionByName(names, existing, 'metaFunctions', metaFunctions)
    collectFunctionByName(names, existing, 'returnFunction', returnFunction)

    return existing
  },

  toString(data: FunctionUsageInfo): string {
    return `---used functions-------------
\tall calls: ${data.allCalls}
\t\tmath functions:               ${data.mathFunctions}
\t\tprogramming functions:        ${data.programmingFunctions}
\t\tsession management functions: ${data.sessionManagementFunctions}
\t\tprimitive functions:          ${data.primitiveFunctions}
\t\tspecial primitive functions:  ${data.specialPrimitiveFunctions}
\t\tinternal functions:           ${data.internalFunctions}
\t\tmeta functions:               ${data.metaFunctions}
\t\treturn function:              ${data.returnFunction}
    `
  }
}
