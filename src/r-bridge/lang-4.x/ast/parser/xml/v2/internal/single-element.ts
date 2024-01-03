import { getKeyGuarded, XmlBasedJson, XmlParseError } from '../../common/input-format'
import { RawRType, RNode } from '../../../../model'
import { NormalizeConfiguration } from '../data'
import { normalizeExpression } from './expression'
import { normalizeNumber } from './values'
import { normalizeString } from './values/string'
import { tryNormalizeSymbolNoNamespace } from './values/symbol'
import { guard } from '../../../../../../../util/assert'
import { normalizeComment } from './other'
import { normalizeLineDirective } from './other/line-directive'
import { getTokenType } from '../../common/meta'

const todo = (...x: unknown[]) => { throw new Error('not implemented: ' + JSON.stringify(x)) }

/**
 * Parses a single structure in the ast based on its type (e.g., a string, a number, a symbol, ...)
 *
 * @param config - The data used by the parser (see {@link ParserData})
 * @param token  - The element to parse
 *
 * @returns The parsed element as an `RNode` or an `RDelimiter` if it is such.
 */
export function normalizeSingleToken(config: NormalizeConfiguration, token: XmlBasedJson): RNode {
	const name = getTokenType(config.tokenMap, token)

	switch(name) {
		case RawRType.ParenLeft:
		case RawRType.ParenRight:
		case RawRType.BraceLeft:
		case RawRType.BraceRight:
			return todo(name)
		case RawRType.Comment:
			return normalizeComment(config, token)
		case RawRType.LineDirective:
			return normalizeLineDirective(config, token)
		case RawRType.ExpressionList:
		case RawRType.Expression:
		case RawRType.ExprOfAssignOrHelp: {
			config.currentLexeme = token[config.content] as string
			const res = normalizeExpression(config, getKeyGuarded(token, config.children))
			guard(res.length === 1, () => `expected only one element in the expression list, yet received ${JSON.stringify(res)}`)
			return res[0]
		}
		case RawRType.NumericConst:
			return normalizeNumber(config, token)
		case RawRType.StringConst:
			return normalizeString(config, token)
		case RawRType.Break:
			return todo(name)
		case RawRType.Next:
			return todo(name)
		case RawRType.Symbol:
		case RawRType.Slot:
		case RawRType.NullConst: {
			// TODO: optimize manually?
			const symbol = tryNormalizeSymbolNoNamespace(config, token)
			guard(symbol !== undefined, () => `should have been parsed to a symbol but was ${JSON.stringify(symbol)}`)
			return symbol
		}
		default:
			throw new XmlParseError(`unknown type ${name} for ${JSON.stringify(token)} in ${JSON.stringify(config)}`)
	}
}
