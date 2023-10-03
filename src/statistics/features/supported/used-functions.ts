import { Feature, FeatureProcessorInput } from '../feature'
import { appendStatisticsFile } from '../../output'
import { Writable } from 'ts-essentials'
import { RNodeWithParent, RType, visitAst } from '../../../r-bridge'
import { SourcePosition } from '../../../util/range'
import { MergeableRecord } from '../../../util/objects'

const initialFunctionUsageInfo = {
	allFunctionCalls:           0,
	/** abs, expm1, tanpi, ... */
	mathFunctions:              0,
	/** nargs, missing, is.character, ... */
	programmingFunctions:       0,
	/** browser, proc.time, gc.time, ... */
	sessionManagementFunctions: 0,
	/** `:`, `~`, `c`, `UseMethod`, `.C`, ... */
	primitiveFunctions:         0,
	/** e.g. do not evaluate part of functions, `quote`, ... */
	specialPrimitiveFunctions:  0,
	/** `body`, `environment`, `formals` */
	metaFunctions:              0,
	/** return */
	returnFunction:             0,
	parsingFunctions:           0,
	editFunctions:              0,
	assignFunctions:            0,
	getFunctions:               0,
	helpFunctions:              0,
	optionFunctions:            0,
	/** `a(b(), c(3, d()))` has 3 (`b`, `c`, `d`) */
	nestedFunctionCalls:        0,
	deepestNesting:             0,
	unnamedCalls:               0
}

export type FunctionUsageInfo = Writable<typeof initialFunctionUsageInfo>


function from(...names: string[]): RegExp {
	return new RegExp(names.join('|'))
}

/* from R internals */
const mathFunctions = from('abs', 'sign', 'sqrt', 'floor', 'ceiling', 'exp', 'expm1', 'log2', 'log10', 'log1p', 'cos', 'sin', 'tan', 'acos', 'asin', 'atan', 'cosh', 'sinh', 'tanh', 'acosh', 'asinh', 'atanh', 'cospi', 'sinpi', 'tanpi', 'gamma', 'lgamma', 'digamma', 'trigamma', 'cumsum', 'cumprod', 'cummax', 'cummin', 'Im', 'Re', 'Arg', 'Conj', 'Mod')
const programmingFunctions = from('nargs', 'missing', 'on.exit', 'interactive', 'as.call', 'as.character', 'as.complex', 'as.double', 'as.environment', 'as.integer', 'as.logical', 'as.raw', 'is.array', 'is.atomic', 'is.call', 'is.character', 'is.complex', 'is.double', 'is.environment', 'is.expression', 'is.finite', 'is.function', 'is.infinite', 'is.integer', 'is.language', 'is.list', 'is.logical', 'is.matrix', 'is.na', 'is.name', 'is.nan', 'is.null', 'is.numeric', 'is.object', 'is.pairlist', 'is.raw', 'is.real', 'is.recursive', 'is.single', 'is.symbol', 'baseenv', 'emptyenv', 'globalenv', 'pos.to.env', 'unclass', 'invisible', 'seq_along', 'seq_len')
const sessionManagementFunctions = from('browser', 'proc.time', 'gc.time', 'tracemem', 'retracemem', 'untracemem')
const primitiveFunctions = from(':', '~', 'c', 'list', 'call', 'switch', 'expression', 'substitute', 'UseMethod', 'standardGeneric', '.C', '.Fortran', '.Call', '.External', 'round', 'signif', 'rep', 'seq.int', '.Primitive', '.Internal', '.Call.graphics', '.External.graphics', '.subset', '.subset2', '.primTrace', '.primUntrace', 'lazyLoadDBfetch')
const specialPrimitiveFunctions = from('quote', 'substitute', 'missing', 'on.exit', 'call', 'expression', '.Internal')
const metaFunctions = from('body', 'environment', 'formals')
const returnFunction = /return/
const parsingFunctions = from('parse', 'deparse', 'substitute', 'quote', 'bquote', 'call', 'eval', 'evalq', 'eval.parent')
const editFunctions = from('edit', 'vi', 'emacs', 'pico', 'xemacs', 'xedit', 'fix', 'fixInNamespace')
const assignFunctions = from('assign',  'assignInNamespace', 'assignInMyNamespace')
const getFunctions = from('get', 'exists', 'getFromNamespace')
const helpFunctions = from('help', 'help.search', 'prompt')
const optionFunctions = from('options', 'getOption', '.Option')

function collectFunctionByName(name: string, info: FunctionUsageInfo, field: keyof FunctionUsageInfo, regex: RegExp): void {
	if(regex.test(name)) {
		info[field]++
	}
}

function analyzeFunctionName(name: string, info: FunctionUsageInfo) {
	collectFunctionByName(name, info, 'mathFunctions', mathFunctions)
	collectFunctionByName(name, info, 'programmingFunctions', programmingFunctions)
	collectFunctionByName(name, info, 'sessionManagementFunctions', sessionManagementFunctions)
	collectFunctionByName(name, info, 'primitiveFunctions', primitiveFunctions)
	collectFunctionByName(name, info, 'specialPrimitiveFunctions', specialPrimitiveFunctions)
	collectFunctionByName(name, info, 'metaFunctions', metaFunctions)
	collectFunctionByName(name, info, 'returnFunction', returnFunction)
	collectFunctionByName(name, info, 'parsingFunctions', parsingFunctions)
	collectFunctionByName(name, info, 'editFunctions', editFunctions)
	collectFunctionByName(name, info, 'assignFunctions', assignFunctions)
	collectFunctionByName(name, info, 'getFunctions', getFunctions)
	collectFunctionByName(name, info, 'helpFunctions', helpFunctions)
	collectFunctionByName(name, info, 'optionFunctions', optionFunctions)
}

export interface FunctionCallInformation extends MergeableRecord {
	/** the name of the called function, or undefined if this was an unnamed function call */
	name:              string | undefined,
	location:          SourcePosition
	numberOfArguments: number
}

function visitCalls(info: FunctionUsageInfo, input: FeatureProcessorInput): void {
	const calls: RNodeWithParent[] = []
	const allCalls: FunctionCallInformation[] = []

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type !== RType.FunctionCall) {
				return
			}

			if(calls.length > 0) {
				info.nestedFunctionCalls++
				appendStatisticsFile(usedFunctions.name, 'nested-calls', [node.lexeme], input.filepath)
				info.deepestNesting = Math.max(info.deepestNesting, calls.length)
			}

			if(node.flavor === 'unnamed') {
				info.unnamedCalls++
				appendStatisticsFile(usedFunctions.name, 'unnamed-calls', [node.lexeme], input.filepath)
				allCalls.push({ name: node.calledFunction.lexeme ?? '<unknown>', named: false, location: node.location.start, numberOfArguments: node.arguments.length })
			} else {
				analyzeFunctionName(node.functionName.lexeme, info)
				allCalls.push({ name: node.functionName.lexeme, named: true, location: node.location.start, numberOfArguments: node.arguments.length })
			}

			calls.push(node)
		}, node => {
			// drop again :D
			if(node.type === RType.FunctionCall) {
				calls.pop()
			}
		}
	)

	info.allFunctionCalls += allCalls.length
	appendStatisticsFile(usedFunctions.name, 'all-calls', allCalls.map(s => JSON.stringify(s)), input.filepath)
}


export const usedFunctions: Feature<FunctionUsageInfo> = {
	name:        'Used Functions',
	description: 'All functions called, split into various sub-categories',

	process(existing: FunctionUsageInfo, input: FeatureProcessorInput): FunctionUsageInfo {
		visitCalls(existing, input)
		return existing
	},

	initialValue: initialFunctionUsageInfo
}
