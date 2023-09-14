import { NamedXmlBasedJson, XmlParseError } from '../../input-format'
import { normalizeNumber, normalizeString, tryNormalizeSymbol } from '../values'
import { guard } from '../../../../../../../util/assert'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { normalizeExpression } from '../expression'
import { getWithTokenType } from '../meta'
import { RNode, RawRType } from '../../../../model'
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
		case RawRType.ParenLeft:
		case RawRType.ParenRight:
			parseLog.debug(`skipping parenthesis information for ${JSON.stringify(elem)}`)
			return undefined
		case RawRType.BraceLeft:
		case RawRType.BraceRight:
			parseLog.debug(`skipping brace information for ${JSON.stringify(elem)}`)
			return undefined
		case RawRType.Comment:
			return normalizeComment(data, elem.content)
		case RawRType.LineDirective:
			return normalizeLineDirective(data, elem.content)
		case RawRType.ExpressionList:
		case RawRType.Expression:
		case RawRType.ExprOfAssignOrHelp:
			return normalizeExpression(data, elem.content)
		case RawRType.NumericConst:
			return normalizeNumber(data, elem.content)
		case RawRType.StringConst:
			return normalizeString(data, elem.content)
		case RawRType.Break:
			return normalizeBreak(data, elem.content)
		case RawRType.Next:
			return normalizeNext(data, elem.content)
		case RawRType.Symbol:
		case RawRType.Slot:
		case RawRType.NullConst: {
			const symbol =  tryNormalizeSymbol(data, getWithTokenType(data.config.tokenMap, [elem.content]))
			guard(symbol !== undefined, () => `should have been parsed to a symbol but was ${JSON.stringify(symbol)}`)
			return symbol
		}
		default:
			throw new XmlParseError(`unknown type ${elem.name} for ${JSON.stringify(elem)} in ${JSON.stringify(data)}`)
	}
}
