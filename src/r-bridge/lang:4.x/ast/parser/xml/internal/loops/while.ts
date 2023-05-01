import { NamedXmlBasedJson, XmlParseError } from "../../input-format"
import { RWhileLoop } from "../../../../model"
import * as Lang from "../../../../model"
import { retrieveMetaStructure } from "../meta"
import { parseLog } from "../../parser"
import { tryParseOneElementBasedOnType } from "../structure/single-element"
import { ParserData } from "../../data"

export function parseWhileLoopStructure (data: ParserData, whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson,  condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson): RWhileLoop | undefined {
  if (whileToken.name !== Lang.Type.While) {
    parseLog.debug('encountered non-while token for supposed while-loop structure')
    return undefined
  }  else if (leftParen.name !== Lang.Type.ParenLeft) {
    throw new XmlParseError(`expected left-parenthesis for while but found ${JSON.stringify(leftParen)}`)
  } else if (rightParen.name !== Lang.Type.ParenRight) {
    throw new XmlParseError(`expected right-parenthesis for while but found ${JSON.stringify(rightParen)}`)
  }

  parseLog.debug(`trying to parse while-loop with ${JSON.stringify([whileToken, condition, body])}`)

  const parsedCondition = tryParseOneElementBasedOnType(data, condition)
  const parseBody = tryParseOneElementBasedOnType(data, body)

  if (parsedCondition === undefined || parseBody === undefined) {
    throw new XmlParseError(`unexpected under-sided while-loop, received ${JSON.stringify([parsedCondition, parseBody])} for ${JSON.stringify([whileToken, condition, body])}`)
  }

  const { location, content } = retrieveMetaStructure(data.config, whileToken.content)

  // TODO: assert exists as known operator
  return {
    type:      Lang.Type.While,
    condition: parsedCondition,
    body:      parseBody,
    lexeme:    content,
    location
  }
}
