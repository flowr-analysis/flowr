import { NamedXmlBasedJson, XmlParseError } from '../../input-format'
import { parseNumber, parseString, tryParseSymbol } from '../values'
import { guard } from '../../../../../../../util/assert'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { parseExpression } from '../expression'
import { getWithTokenType } from '../meta'
import { Type, RNode } from '../../../../model'
import { parseComment } from '../other'
import { parseBreak, parseNext } from '../loops'

/**
 * Parses a single structure in the ast based on its type (e.g., a string, a number, a symbol, ...)
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param elem - The element to parse
 *
 * @returns `undefined` if no parse result is to be produced (i.e., if it is skipped).
 *          Otherwise, returns the parsed element.
 */
export function tryParseOneElementBasedOnType(data: ParserData, elem: NamedXmlBasedJson): RNode | undefined {
  switch (elem.name) {
    case Type.ParenLeft:
    case Type.ParenRight:
      parseLog.debug(`skipping parenthesis information for ${JSON.stringify(elem)}`)
      return undefined
    case Type.BraceLeft:
    case Type.BraceRight:
      parseLog.debug(`skipping brace information for ${JSON.stringify(elem)}`)
      return undefined
    case Type.Comment:
      return parseComment(data, elem.content)
    case Type.ExpressionList:
    case Type.Expression:
    case Type.ExprHelpAssignWrapper:
      return parseExpression(data, elem.content)
    case Type.Number:
      return parseNumber(data, elem.content)
    case Type.String:
      return parseString(data, elem.content)
    case Type.Break:
      return parseBreak(data, elem.content)
    case Type.Next:
      return parseNext(data, elem.content)
    case Type.Symbol:
    case Type.Null: {
      const symbol =  tryParseSymbol(data, getWithTokenType(data.config.tokenMap, [elem.content]))
      guard(symbol !== undefined, () => `should have been parsed to a symbol but was ${JSON.stringify(symbol)}`)
      return symbol
    }
    default:
      throw new XmlParseError(`unknown type ${elem.name}`)
  }
}
