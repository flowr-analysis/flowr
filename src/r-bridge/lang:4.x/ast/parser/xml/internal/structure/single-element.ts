import { NamedXmlBasedJson, XmlParseError } from "../../input-format"
import * as Lang from "../../../../model"
import { parseNumber } from "../values/number"
import { parseString } from "../values/string"
import { guard } from "../../../../../../../util/assert"
import { parseLog } from "../../parser"
import { ParserData } from "../../data"
import { parseExpr } from "../expression/expression"
import { parseSymbol } from "../values/symbol"
import { getWithTokenType } from "../meta"

/**
 * parses a single structure in the ast based on its type (e.g., a string, a number, a symbol, ...)
 *
 * @param data - the data used by the parser (see {@link ParserData})
 * @param elem - the element to parse
 *
 * @returns `undefined` if no parse result is to be produced (i.e., if it is skipped).
 *          Otherwise, returns the parsed element.
 */
export function tryParseOneElementBasedOnType(data: ParserData, elem: NamedXmlBasedJson): Lang.RNode | undefined {
  switch (elem.name) {
    case Lang.Type.ParenLeft:
    case Lang.Type.ParenRight:
      parseLog.debug(`skipping parenthesis information for ${JSON.stringify(elem)}`)
      return undefined
    case Lang.Type.BraceLeft:
    case Lang.Type.BraceRight:
      parseLog.debug(`skipping brace information for ${JSON.stringify(elem)}`)
      return undefined
    case Lang.Type.Comment:
      parseLog.debug(`skipping comment information for ${JSON.stringify(elem)}`)
      return undefined
    case Lang.Type.Expression:
    case Lang.Type.ExprHelpAssignWrapper:
      return parseExpr(data, elem.content)
    case Lang.Type.Number:
      return parseNumber(data.config, elem.content)
    case Lang.Type.String:
      return parseString(data.config, elem.content)
    case Lang.Type.Symbol:
    case Lang.Type.Null: {
      const symbol =  parseSymbol(data.config, getWithTokenType(data.config.tokenMap, [elem.content]))
      guard(symbol !== undefined, `should have been parsed to a symbol but was ${JSON.stringify(symbol)}`)
      return symbol
    }
    default:
      throw new XmlParseError(`unknown type ${elem.name}`)
  }
}
