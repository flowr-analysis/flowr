import { NamedXmlBasedJson, XmlParseError } from '../../input-format'
import { tryParseOneElementBasedOnType } from '../structure/single-element'
import { retrieveMetaStructure } from '../meta'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { Type } from '../../../../model/type'
import { RIfThenElse } from '../../../../model/nodes/RIfThenElse'

/**
 * Try to parse the construct as a {@link RIfThenElse}.
 */
export function tryParseIfThenStructure(data: ParserData,
                                        tokens: [
                                          ifToken:    NamedXmlBasedJson,
                                          leftParen:  NamedXmlBasedJson,
                                          condition:  NamedXmlBasedJson,
                                          rightParen: NamedXmlBasedJson,
                                          then:       NamedXmlBasedJson
                                      ]): RIfThenElse | undefined {
  // TODO: guard-like syntax for this too?
  if (tokens[0].name !== Type.If) {
    parseLog.debug('encountered non-if token for supposed if-then structure')
    return undefined
  } else if (tokens[1].name !== Type.ParenLeft) {
    throw new XmlParseError(`expected left-parenthesis for if but found ${JSON.stringify(tokens[1])}`)
  } else if (tokens[3].name !== Type.ParenRight) {
    throw new XmlParseError(`expected right-parenthesis for if but found ${JSON.stringify(tokens[3])}`)
  }

  const parsedCondition = tryParseOneElementBasedOnType(data, tokens[2])
  const parsedThen = tryParseOneElementBasedOnType(data, tokens[4])


  if (parsedCondition === undefined || parsedThen === undefined) {
    throw new XmlParseError(`unexpected missing parts of if, received ${JSON.stringify([parsedCondition, parsedThen])} for ${JSON.stringify(tokens)}`)
  }

  const { location, content} = retrieveMetaStructure(data.config, tokens[0].content)

  return {
    type:      Type.If,
    condition: parsedCondition,
    then:      parsedThen,
    location,
    lexeme:    content
  }
}
