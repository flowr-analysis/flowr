import * as Lang from '../../../src/r-bridge/lang/ast/model'
import { type RNumberValue } from '../../../src/r-bridge/lang/values'

export function exprList(...children: Lang.RNode[]): Lang.RExprList {
  return { type: Lang.Type.ExprList, children }
}

export function numVal(value: number, markedAsInt: boolean = false, complexNumber: boolean = false): RNumberValue {
  return { num: value, markedAsInt, complexNumber }
}
