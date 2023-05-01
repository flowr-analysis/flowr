import { getKeysGuarded, XmlBasedJson } from "../../input-format"
import * as Lang from "../../../../model"
import { assureTokenType } from "../meta"
import { parseBasedOnType } from "./elements"
import { ParserData } from "../../data"

export function parseRootObjToAst (data: ParserData, obj: XmlBasedJson): Lang.RExpressionList {
  const exprContent = getKeysGuarded<XmlBasedJson>(obj, Lang.Type.ExpressionList)
  assureTokenType(data.config.tokenMap, exprContent, Lang.Type.ExpressionList)

  const children = getKeysGuarded<XmlBasedJson[]>(exprContent, data.config.childrenName)
  const parsedChildren = parseBasedOnType(data, children)

  // TODO: at total object in any case of error?
  return {
    type:     Lang.Type.ExpressionList,
    children: parsedChildren,
    lexeme:   undefined
  }
}
