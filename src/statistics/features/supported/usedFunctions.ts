import { SinglePackageInfo } from './usedPackages'
import { FunctionNameInfo } from './definedFunctions'
import { Feature, FeatureInfo, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { append, extractNodeContent } from '../../output'

export interface UsedFunction {
  package:  SinglePackageInfo,
  function: FunctionNameInfo
}


// TODO: general register function to allow to register these counters with optional writes if necessary from all features
// together with sub-search which works on the result of a given regex

// TODO: get corresponding package with getNamespaceExports etc?
export interface FunctionUsageInfo extends FeatureInfo {
  allFunctionCalls:           number
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
  /** `body`, `environment`, `formals` */
  metaFunctions:              number
  /** return */
  returnFunction:             number
  parsingFunctions:           number
  editFunctions:              number
  assignFunctions:            number
  getFunctions:               number
  helpFunctions:              number
  optionFunctions:            number
  // TODO: others from the list
}

const initialFunctionUsageInfo = (): FunctionUsageInfo => ({
  allFunctionCalls:           0,
  mathFunctions:              0,
  programmingFunctions:       0,
  sessionManagementFunctions: 0,
  primitiveFunctions:         0,
  specialPrimitiveFunctions:  0,
  internalFunctions:          0,
  metaFunctions:              0,
  returnFunction:             0,
  parsingFunctions:           0,
  editFunctions:              0,
  assignFunctions:            0,
  getFunctions:               0,
  helpFunctions:              0,
  optionFunctions:            0
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

const parsingFunctions = from('parse', 'deparse', 'substitute', 'quote', 'bquote', 'call', 'eval', 'evalq', 'eval.parent')
const editFunctions = from('edit', 'vi', 'emacs', 'pico', 'xemacs', 'xedit', 'fix', 'fixInNamespace')
const assignFunctions = from('assign',  'assignInNamespace', 'assignInMyNamespace')
const getFunctions = from('get', 'exists', 'getFromNamespace')
const helpFunctions = from('help', 'help.search', 'prompt')
const optionFunctions = from('options', 'getOption', '.Option')

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
  name:        'Used Functions',
  description: 'All functions called, split into various sub-categories',

  process(existing: FunctionUsageInfo, input: Document, filepath: string | undefined): FunctionUsageInfo {
    const allFunctionCalls = functionCallQuery.select({ node: input })

    existing.allFunctionCalls += allFunctionCalls.length
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
    collectFunctionByName(names, existing, 'parsingFunctions', parsingFunctions)
    collectFunctionByName(names, existing, 'editFunctions', editFunctions)
    collectFunctionByName(names, existing, 'assignFunctions', assignFunctions)
    collectFunctionByName(names, existing, 'getFunctions', getFunctions)
    collectFunctionByName(names, existing, 'helpFunctions', helpFunctions)
    collectFunctionByName(names, existing, 'optionFunctions', optionFunctions)

    return existing
  },

  initialValue: initialFunctionUsageInfo
}
