import { NamedXmlBasedJson, XmlParseError } from "../../input-format"
import { RIfThenElse } from "../../../../model"
import * as Lang from "../../../../model"
import { tryParseOneElementBasedOnType } from "../structure/single-element"
import { parseLog } from "../../parser"
import { ParserData } from "../../data"
import { parseIfThenStructure } from "./if-then"
import { guard } from "../../../../../../../util/assert"

/**
 * Try to parse the construct as a {@link Lang.RIfThenElse}.
 */
// TODO: named tuples
export function parseIfThenElseStructure (data: ParserData,
                                          tokens: [
                                            ifToken:    NamedXmlBasedJson,
                                            leftParen:  NamedXmlBasedJson,
                                            condition:  NamedXmlBasedJson,
                                            rightParen: NamedXmlBasedJson,
                                            then:       NamedXmlBasedJson,
                                            elseToken:  NamedXmlBasedJson,
                                            elseBlock:  NamedXmlBasedJson
                                          ]): RIfThenElse | undefined {
  // we start by parsing a regular if-then structure
  parseLog.trace(`trying to parse if-then-else structure for ${JSON.stringify(tokens)}`)
  const parsedIfThen = parseIfThenStructure(data, [tokens[0], tokens[1], tokens[2], tokens[3], tokens[4]])
  if (parsedIfThen === undefined) {
    return undefined
  }
  parseLog.trace(`if-then part successful, now parsing else part for ${JSON.stringify([tokens[5], tokens[6]])}`)
  guard(tokens[5].name === Lang.Type.Else, `expected else token for if-then-else but found ${JSON.stringify(tokens[5])}`)

  const parsedElse = tryParseOneElementBasedOnType(data, tokens[6])
  guard(parsedElse !== undefined, `unexpected missing else-part of if-then-else, received ${JSON.stringify([parsedIfThen, parsedElse])} for ${JSON.stringify(tokens)}`)

  return {
    ...parsedIfThen,
    otherwise: parsedElse
  }
}
