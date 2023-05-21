import { type RNumberValue, Type, RExpressionList, RNode } from '../../src/r-bridge'
import { SourceRange } from '../../src/util/range'
import { RParameter } from '../../src/r-bridge/lang:4.x/ast/model/nodes/RParameter'

export function exprList(...children: RNode[]): RExpressionList {
  return { type: Type.ExpressionList, children, lexeme: undefined, info: {} }
}
export function numVal(value: number, markedAsInt = false, complexNumber = false): RNumberValue {
  return { num: value, markedAsInt, complexNumber }
}

export function parameter(name: string, location: SourceRange, defaultValue?: RNode): RParameter  {
  return {
    type:    Type.Parameter,
    location,
    lexeme:  name,
    content: name,
    defaultValue,
    name:    {
      type:      Type.Symbol,
      location,
      lexeme:    name,
      content:   name,
      namespace: undefined,
      info:      {}
    },
    info: {}
  }
}
