import { NamedXmlBasedJson } from '../../input-format'
import { parseLog } from '../../parser'
import { retrieveMetaStructure } from '../meta'
import { RNode, Type, RSymbol, RArgument, RawRType } from '../../../../model'
import { ParserData } from '../../data'
import { executeHook, executeUnknownHook } from '../../hooks'
import { log } from '../../../../../../../util/log'
import { guard } from '../../../../../../../util/assert'
import { tryNormalizeSingleNode } from '../structure'

/**
 * Either parses `[expr]` or `[SYMBOL_SUB, EQ_SUB, expr]` as an argument of a function call in R.
 * Probably directly called by the function call parser as otherwise, we do not expect to find arguments.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param objs - Either `[expr]` or `[SYMBOL_FORMALS, EQ_FORMALS, expr]`
 *
 * @returns The parsed argument or `undefined` if the given object is not an argument.
 */
export function tryToNormalizeArgument(data: ParserData, objs: NamedXmlBasedJson[]): RArgument | undefined {
	parseLog.debug(`[argument]`)
	objs = executeHook(data.hooks.functions.onArgument.before, data, objs)

	if(objs.length !== 1 && objs.length !== 3) {
		log.warn(`Either [expr|value] or [SYMBOL_SUB, EQ_SUB, expr], but got: ${objs.map(o => o.name).join(', ')}`)
		return executeUnknownHook(data.hooks.functions.onArgument.unknown, data, objs)
	}


	const symbolOrExpr = objs[0]
	const { location, content } = retrieveMetaStructure(data.config, symbolOrExpr.content)

	let parsedValue: RNode | undefined
	let name: RSymbol | undefined
	if(symbolOrExpr.name === RawRType.Expression) {
		name = undefined
		parsedValue = tryNormalizeSingleNode(data, symbolOrExpr)
	} else if(symbolOrExpr.name === RawRType.SymbolFormals) {
		name =    {
			type:      Type.Symbol,
			location, content,
			namespace: undefined,
			lexeme:    content,
			info:      {
				fullRange:        location,
				additionalTokens: [],
				fullLexeme:       content
			}
		}
		parsedValue = parseWithValue(data, objs)
	} else {
		log.warn(`expected symbol or expr for argument, yet received ${objs.map(o => o.name).join(',')}`)
		return executeUnknownHook(data.hooks.functions.onArgument.unknown, data, objs)
	}

	guard(parsedValue !== undefined, () => `[argument] parsed value must not be undefined, yet: ${JSON.stringify(objs)}`)

	const result: RArgument = {
		type:   Type.Argument,
		location,
		lexeme: content,
		name,
		value:  parsedValue,
		info:   {
			fullRange:        location,
			fullLexeme:       content,
			additionalTokens: []
		}
	}

	return executeHook(data.hooks.functions.onArgument.after, data, result)
}

function parseWithValue(data: ParserData, objs: NamedXmlBasedJson[]): RNode | undefined {
	guard(objs[1].name === RawRType.EqFormals, () => `[arg-default] second element of parameter must be ${RawRType.EqFormals}, but: ${JSON.stringify(objs)}`)
	guard(objs[2].name === RawRType.Expression, () => `[arg-default] third element of parameter must be an Expression but: ${JSON.stringify(objs)}`)
	return tryNormalizeSingleNode(data, objs[2])
}
