import { NamedXmlBasedJson, XmlParseError } from '../../input-format'
import { normalizeNumber, normalizeString, tryNormalizeSymbol } from '../values'
import { guard } from '../../../../../../../util/assert'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { normalizeExpression } from '../expression'
import { getWithTokenType } from '../meta'
import { Type, RNode } from '../../../../model'
import { normalizeComment } from '../other'
import { normalizeBreak, normalizeNext } from '../loops'
import { normalizeLineDirective } from '../other/line-directive'

/**
 * Parses a single structure in the ast based on its type (e.g., a string, a number, a symbol, ...)
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param elem - The element to parse
 *
 * @returns `undefined` if no parse result is to be produced (i.e., if it is skipped).
 *          Otherwise, returns the parsed element.
 */
export function tryNormalizeSingleNode(data: ParserData, elem: NamedXmlBasedJson): RNode | undefined {
	switch(elem.name) {
		case Type.ParenLeft:
		case Type.ParenRight:
			parseLog.debug(`skipping parenthesis information for ${JSON.stringify(elem)}`)
			return undefined
		case Type.BraceLeft:
		case Type.BraceRight:
			parseLog.debug(`skipping brace information for ${JSON.stringify(elem)}`)
			return undefined
		case Type.Comment:
			return normalizeComment(data, elem.content)
		case Type.LineDirective:
			return normalizeLineDirective(data, elem.content)
		case Type.ExpressionList:
		case Type.Expression:
		case Type.ExprHelpAssignWrapper:
			return normalizeExpression(data, elem.content)
		case Type.Number:
			return normalizeNumber(data, elem.content)
		case Type.String:
			return normalizeString(data, elem.content)
		case Type.Break:
			return normalizeBreak(data, elem.content)
		case Type.Next:
			return normalizeNext(data, elem.content)
		case Type.Symbol:
		case Type.Slot:
		case Type.Null: {
			const symbol =  tryNormalizeSymbol(data, getWithTokenType(data.config.tokenMap, [elem.content]))
			guard(symbol !== undefined, () => `should have been parsed to a symbol but was ${JSON.stringify(symbol)}`)
			return symbol
		}
		default:
			throw new XmlParseError(`unknown type ${elem.name} for ${JSON.stringify(elem)} in ${JSON.stringify(data)}`)
	}
}
