import * as Lang from '../../../src/r-bridge/lang:4.x/ast/model'
import { type RNumberValue } from '../../../src/r-bridge/lang:4.x/values'

export function exprList(...children: Lang.RNode[]): Lang.RExprList {
  return { type: Lang.Type.ExprList, children, lexeme: undefined }
}

export function exprListWithContent(content: string, ...children: Lang.RNode[]): Lang.RExprList {
  return { type: Lang.Type.ExprList, children, lexeme: undefined, content }
}

export function numVal(value: number, markedAsInt: boolean = false, complexNumber: boolean = false): RNumberValue {
  return { num: value, markedAsInt, complexNumber }
}
