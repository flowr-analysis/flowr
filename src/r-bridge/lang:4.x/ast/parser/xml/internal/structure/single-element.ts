import { NamedXmlBasedJson, XmlParseError } from '../../input-format'
import { parseNumber } from '../values/number'
import { parseString } from '../values/string'
import { guard } from '../../../../../../../util/assert'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { parseExpression } from '../expression/expression'
import { tryParseSymbol } from '../values/symbol'
import { getWithTokenType } from '../meta'
import { Type } from '../../../../model/type'
import { RNode } from '../../../../model/model'
import { parseComment } from '../other/comment'

/**
 * parses a single structure in the ast based on its type (e.g., a string, a number, a symbol, ...)
 *
 * @param data - the data used by the parser (see {@link ParserData})
 * @param elem - the element to parse
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
      return parseComment(data.config, elem.content)
    case Type.Expression:
    case Type.ExprHelpAssignWrapper:
      return parseExpression(data, elem.content)
    case Type.Number:
      return parseNumber(data, elem.content)
    case Type.String:
      return parseString(data, elem.content)
    case Type.Symbol:
    case Type.Null: {
      const symbol =  tryParseSymbol(data, getWithTokenType(data.config.tokenMap, [elem.content]))
      guard(symbol !== undefined, `should have been parsed to a symbol but was ${JSON.stringify(symbol)}`)
      return symbol
    }
    default:
      throw new XmlParseError(`unknown type ${elem.name}`)
  }
}
