import { getKeyGuarded, XmlBasedJson, XmlParseError } from '../../common/input-format'
import { RawRType, RNode } from '../../../../model'
import { NormalizeConfiguration } from '../data'
import { XML_NAME } from '../../common/xml-to-json'
import { normalizeExpression } from './expression'
import { normalizeNumber } from './values'

const todo = (...x: unknown[]) => { throw new Error('not implemented: ' + JSON.stringify(x)) }

/**
 * Parses a single structure in the ast based on its type (e.g., a string, a number, a symbol, ...)
 *
 * @param config - The data used by the parser (see {@link ParserData})
 * @param elem - The element to parse
 *
 * @returns The parsed element as an `RNode` or an `RDelimiter` if it is such.
 */
export function normalizeSingleNode(config: NormalizeConfiguration, elem: XmlBasedJson): RNode[] {
	const name = elem[XML_NAME] as string
	switch(name) {
		case RawRType.ParenLeft:
		case RawRType.ParenRight:
		case RawRType.BraceLeft:
		case RawRType.BraceRight:
			return todo(name)
		case RawRType.Comment:
			return todo(name)
		case RawRType.LineDirective:
			return todo(name)
		case RawRType.ExpressionList:
		case RawRType.Expression:
		case RawRType.ExprOfAssignOrHelp:
			return normalizeExpression(config, getKeyGuarded(elem, config.children))
		case RawRType.NumericConst:
			return [normalizeNumber(config, elem)]
		case RawRType.StringConst:
			return todo(name)
		case RawRType.Break:
			return todo(name)
		case RawRType.Next:
			return todo(name)
		case RawRType.Symbol:
		case RawRType.Slot:
		case RawRType.NullConst: {
			return todo(name)
			/*const symbol =  tryNormalizeSymbol(config, getWithTokenType(data.config.tokenMap, [elem.content]))
			guard(symbol !== undefined, () => `should have been parsed to a symbol but was ${JSON.stringify(symbol)}`)
			return symbol*/
		}
		default:
			throw new XmlParseError(`unknown type ${name} for ${JSON.stringify(elem)} in ${JSON.stringify(config)}`)
	}
}
