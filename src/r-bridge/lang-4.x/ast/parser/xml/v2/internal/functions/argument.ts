import type { XmlBasedJson } from '../../../common/input-format'
import { XmlParseError } from '../../../common/input-format'
import { getTokenType, retrieveMetaStructure } from '../../../common/meta'
import type { RNode, RSymbol } from '../../../../../model'
import { RType, RawRType } from '../../../../../model'
import type { NormalizeConfiguration } from '../../data'
import { log } from '../../../../../../../../util/log'
import { guard } from '../../../../../../../../util/assert'
import type { RDelimiter } from '../../../../../model/nodes/info'
import { normalizeSingleToken } from '../single-element'

/**
 * Either parses `[expr]` or `[SYMBOL_SUB, EQ_SUB, expr]` as an argument of a function call in R.
 * Probably directly called by the function call parser as otherwise, we do not expect to find arguments.
 *
 * @param configuration - The data used for the normalization (see {@link NormalizeConfiguration})
 * @param objs - Either `[expr]` or `[SYMBOL_FORMALS, EQ_FORMALS, expr]`
 *
 * @returns The parsed argument or `undefined` if the given object is not an argument.
 */
export function tryToNormalizeArgument(configuration: NormalizeConfiguration, objs: readonly XmlBasedJson[]): RNode | undefined {
	if(objs.length < 1 || objs.length > 3) {
		log.warn(`Either [expr|value], [SYMBOL_SUB, EQ_SUB], or [SYMBOL_SUB, EQ_SUB, expr], but got: ${objs.map(o => JSON.stringify(o)).join(', ')}`)
		return undefined
	}

	const [first] = objs
	const symbolOrExpr = getTokenType(first)
	const { location, content } = retrieveMetaStructure(first)

	let parsedValue: RNode | RDelimiter | undefined |  null
	let name: RSymbol | undefined
	if(symbolOrExpr === RawRType.Expression) {
		name = undefined
		parsedValue = normalizeSingleToken(configuration, first)
	} else if(symbolOrExpr === RawRType.SymbolSub || symbolOrExpr === RawRType.StringConst) {
		name =    {
			type:      RType.Symbol,
			location,
			content:   symbolOrExpr === RawRType.StringConst ? content.slice(1,-1) : content,
			namespace: undefined,
			lexeme:    content,
			info:      {
				fullRange:        location,
				additionalTokens: [],
				fullLexeme:       content
			}
		}
		parsedValue = normalizeWithValue(configuration, objs)
	} else {
		throw new XmlParseError(`expected symbol or expr for argument, yet received ${objs.map(o => JSON.stringify(o)).join(',')}`)
	}

	guard(parsedValue !== undefined && parsedValue?.type !== RType.Delimiter, () => `[argument] parsed value must not be undefined, yet: ${JSON.stringify(objs)}`)

	if(name === undefined) {
		return parsedValue ?? undefined
	} else {
		return {
			type:   RType.Argument,
			location,
			lexeme: content,
			name,
			value:  parsedValue ?? undefined,
			info:   {
				fullRange:        location,
				fullLexeme:       content,
				additionalTokens: []
			}
		}
	}
}

function normalizeWithValue(data: NormalizeConfiguration, [fst,eq,lst]: readonly XmlBasedJson[]): RNode | RDelimiter | undefined | null {
	const eqType = getTokenType(eq)
	guard(eqType === RawRType.EqualSub, () => `[arg-default] second element of parameter must be ${RawRType.EqualFormals}, but: ${JSON.stringify([fst,eq,lst])}`)
	guard(lst === undefined || getTokenType(lst) === RawRType.Expression, () => `[arg-default] third element of parameter must be an Expression or undefined (for 'x=') but: ${JSON.stringify([fst,eq,lst])}`)
	return lst ? normalizeSingleToken(data, lst) : null
}
