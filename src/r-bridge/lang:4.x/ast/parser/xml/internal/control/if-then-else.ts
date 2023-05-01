import { NamedXmlBasedJson, XmlParseError } from "../../input-format"
import { RIfThenElse } from "../../../../model"
import * as Lang from "../../../../model"
import { tryParseOneElementBasedOnType } from "../structure/single-element"
import { retrieveMetaStructure } from "../meta"
import { parseLog } from "../../parser"
import { ParserData } from "../../data"

/**
 * Try to parse the construct as a {@link Lang.RIfThenElse}.
 */
export function parseIfThenStructure (data: ParserData, ifToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, then: NamedXmlBasedJson): RIfThenElse | undefined {
  // TODO: guard-like syntax for this too?
  if (ifToken.name !== Lang.Type.If) {
    parseLog.debug('encountered non-if token for supposed if-then structure')
    return undefined
  } else if (leftParen.name !== Lang.Type.ParenLeft) {
    throw new XmlParseError(`expected left-parenthesis for if but found ${JSON.stringify(leftParen)}`)
  } else if (rightParen.name !== Lang.Type.ParenRight) {
    throw new XmlParseError(`expected right-parenthesis for if but found ${JSON.stringify(rightParen)}`)
  }

  const parsedCondition = tryParseOneElementBasedOnType(data, condition)
  const parsedThen = tryParseOneElementBasedOnType(data, then)


  if (parsedCondition === undefined || parsedThen === undefined) {
    throw new XmlParseError(`unexpected missing parts of if, received ${JSON.stringify([parsedCondition, parsedThen])} for ${JSON.stringify([ifToken, condition, then])}`)
  }

  const { location, content} = retrieveMetaStructure(data.config, ifToken.content)

  return {
    type:      Lang.Type.If,
    condition: parsedCondition,
    then:      parsedThen,
    location,
    lexeme:    content
  }
}

/**
 * Try to parse the construct as a {@link Lang.RIfThenElse}.
 */
// TODO: named tuples
export function parseIfThenElseStructure (data: ParserData, ifToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, then: NamedXmlBasedJson, elseToken: NamedXmlBasedJson, elseBlock: NamedXmlBasedJson): RIfThenElse | undefined {
  // we start by parsing a regular if-then structure
  parseLog.trace(`trying to parse if-then-else structure for ${JSON.stringify([ifToken, leftParen, condition, rightParen, then, elseToken, elseBlock])}`)
  const parsedIfThen = parseIfThenStructure(data, ifToken, leftParen, condition, rightParen, then)
  if (parsedIfThen === undefined) {
    return undefined
  }
  parseLog.trace(`if-then part successful, now parsing else part for ${JSON.stringify([elseToken, elseBlock])}`)
  if (elseToken.name !== Lang.Type.Else) {
    throw new XmlParseError(`expected right-parenthesis for if but found ${JSON.stringify(rightParen)}`)
  }
  const parsedElse = tryParseOneElementBasedOnType(data, elseBlock)
  if (parsedElse === undefined) {
    throw new XmlParseError(`unexpected missing else-part of if-then-else, received ${JSON.stringify([parsedIfThen, parsedElse])} for ${JSON.stringify([ifToken, condition, then, elseToken, elseBlock])}`)
  }
  return {
    ...parsedIfThen,
    otherwise: parsedElse
  }
}
