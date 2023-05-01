import {
  getKeysGuarded,
  NamedXmlBasedJson,
  XmlBasedJson,
  XmlParseError,
} from "../../input-format"
import { getTokenType, getWithTokenType, retrieveMetaStructure } from "../meta"
import { parseLog } from "../../parser"
import { guard } from "../../../../../../../util/assert"
import { ParserData } from "../../data"
import { parseSymbol } from "../values/symbol"
import { parseBasedOnType } from "../structure/elements"
import { tryParseOneElementBasedOnType } from "../structure/single-element"
import { Type } from "../../../../model/type"
import { RSymbol } from "../../../../model/nodes/RSymbol"
import { RForLoop } from "../../../../model/nodes/RForLoop"
import { RNode } from "../../../../model/model"

export function tryParseForLoopStructure(
  data: ParserData,
  forToken: NamedXmlBasedJson,
  condition: NamedXmlBasedJson,
  body: NamedXmlBasedJson
): RForLoop | undefined {
  // funny, for does not use top-level parenthesis
  if (forToken.name !== Type.For) {
    parseLog.debug("encountered non-for token for supposed for-loop structure")
    return undefined
  } else if (condition.name !== Type.ForCondition) {
    throw new XmlParseError(
      `expected condition for for-loop but found ${JSON.stringify(condition)}`
    )
  } else if (body.name !== Type.Expression) {
    throw new XmlParseError(
      `expected expr body for for-loop but found ${JSON.stringify(body)}`
    )
  }

  parseLog.debug(
    `trying to parse for-loop with ${JSON.stringify([
      forToken,
      condition,
      body,
    ])}`
  )

  const { variable: parsedVariable, vector: parsedVector } =
    parseForLoopCondition(data, condition.content)
  const parseBody = tryParseOneElementBasedOnType(data, body)

  if (
    parsedVariable === undefined ||
    parsedVector === undefined ||
    parseBody === undefined
  ) {
    throw new XmlParseError(
      `unexpected under-sided for-loop, received ${JSON.stringify([
        parsedVariable,
        parsedVariable,
        parseBody,
      ])} for ${JSON.stringify([forToken, condition, body])}`
    )
  }

  const { location, content } = retrieveMetaStructure(
    data.config,
    forToken.content
  )

  // TODO: assert exists as known operator
  return {
    type:     Type.For,
    variable: parsedVariable,
    vector:   parsedVector,
    body:     parseBody,
    lexeme:   content,
    location,
  }
}

function parseForLoopCondition(data: ParserData, forCondition: XmlBasedJson): { variable: RSymbol | undefined, vector: RNode | undefined } {
  // must have a child which is `in`, a variable on the left, and a vector on the right
  const children: NamedXmlBasedJson[] = getKeysGuarded<XmlBasedJson[]>(forCondition, data.config.childrenName).map(content => ({
    name: getTokenType(data.config.tokenMap, content),
    content
  }))
  const inPosition = children.findIndex(elem => elem.name === Type.ForIn)
  guard(inPosition > 0 && inPosition < children.length - 1, `for loop searched in and found at ${inPosition}, but this is not in legal bounds for ${JSON.stringify(children)}`)
  const variable = parseSymbol(data.config, getWithTokenType(data.config.tokenMap, [children[inPosition - 1].content]))
  guard(variable !== undefined, `for loop variable should have been parsed to a symbol but was ${JSON.stringify(variable)}`)
  // TODO: just parse single element directly
  const vector = parseBasedOnType(data, [children[inPosition + 1].content])
  guard(vector.length === 1, `for loop vector should have been parsed to a single element but was ${JSON.stringify(vector)}`)

  return { variable, vector: vector[0] }
}
