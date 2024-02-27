import type { XmlBasedJson } from '../../../common/input-format'
import { getTokenType, retrieveMetaStructure } from '../../../common/meta'
import type { RNode, RParameter } from '../../../../../model'
import { RType, RawRType } from '../../../../../model'
import { log } from '../../../../../../../../util/log'
import { guard } from '../../../../../../../../util/assert'
import type { NormalizeConfiguration } from '../../data'
import { normalizeSingleToken } from '../single-element'

/**
 * Either parses `[SYMBOL_FORMALS]` or `[SYMBOL_FORMALS, EQ_FORMALS, expr]` as a parameter of a function definition in R.
 * Probably directly called by the function definition parser as otherwise, we do not expect to find parameters.
 *
 * @param config - The config used by the parser (see {@link NormalizeConfiguration})
 * @param objs - Either `[SYMBOL_FORMALS]` or `[SYMBOL_FORMALS, EQ_FORMALS, expr]`
 *
 * @returns The parsed parameter or `undefined` if the given object is not a parameter.
 */
export function tryNormalizeParameter(config: NormalizeConfiguration, objs: readonly XmlBasedJson[]): RParameter | undefined {
	if(objs.length !== 1 && objs.length !== 3) {
		log.warn(`Either [SYMBOL_FORMALS] or [SYMBOL_FORMALS, EQ_FORMALS, expr], but got: ${JSON.stringify(objs)}`)
		return undefined
	}

	const symbol = objs[0]
	if(getTokenType(symbol) !== RawRType.SymbolFormals) {
		log.warn(`expected symbol for parameter, yet received ${JSON.stringify(objs)}`)
		return undefined
	}

	const defaultValue: RNode | undefined = objs.length === 3 ? parseWithDefaultValue(config, objs) : undefined

	const { location, content } = retrieveMetaStructure(symbol)

	return {
		type:    RType.Parameter,
		location,
		special: content === '...',
		lexeme:  content,
		name:    {
			type:      RType.Symbol,
			location, content,
			namespace: undefined,
			lexeme:    content,
			info:      {
				fullRange:        location,
				additionalTokens: [],
				fullLexeme:       content
			}
		},
		defaultValue,
		info: {
			fullRange:  location,
			fullLexeme: content
		}
	}
}

function parseWithDefaultValue(config: NormalizeConfiguration, objs: readonly XmlBasedJson[]): RNode | undefined {
	guard(getTokenType(objs[1]) === RawRType.EqualFormals, () => `[arg-default] second element of parameter must be ${RawRType.EqualFormals}, but: ${JSON.stringify(objs)}`)
	guard(getTokenType(objs[2]) === RawRType.Expression, () => `[arg-default] third element of parameter must be an Expression but: ${JSON.stringify(objs)}`)
	return normalizeSingleToken(config, objs[2])
}
