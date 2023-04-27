import * as Lang from '../../src/r-bridge/lang:4.x/ast/model'
import { type RNumberValue } from '../../src/r-bridge/lang:4.x/values'

export function exprList(...children: Lang.RNode[]): Lang.RExpressionList {
  return { type: Lang.Type.ExpressionList, children, lexeme: undefined }
}
export function numVal(value: number, markedAsInt = false, complexNumber = false): RNumberValue {
  return { num: value, markedAsInt, complexNumber }
}
