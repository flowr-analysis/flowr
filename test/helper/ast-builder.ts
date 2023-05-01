import { type RNumberValue } from "../../src/r-bridge/lang:4.x/values"
import { Type } from "../../src/r-bridge/lang:4.x/ast/model/type"
import { RExpressionList } from "../../src/r-bridge/lang:4.x/ast/model/nodes/RExpressionList"
import { RNode } from "../../src/r-bridge/lang:4.x/ast/model/model"

export function exprList(...children: RNode[]): RExpressionList {
  return { type: Type.ExpressionList, children, lexeme: undefined }
}
export function numVal(value: number, markedAsInt = false, complexNumber = false): RNumberValue {
  return { num: value, markedAsInt, complexNumber }
}
