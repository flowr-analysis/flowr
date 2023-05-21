import { type RNumberValue, Type, RExpressionList, RNode } from '../../src/r-bridge'
import { SourceRange } from '../../src/util/range'
import { RArgument } from '../../src/r-bridge/lang:4.x/ast/model/nodes/RArgument'

export function exprList(...children: RNode[]): RExpressionList {
  return { type: Type.ExpressionList, children, lexeme: undefined, info: {} }
}
export function numVal(value: number, markedAsInt = false, complexNumber = false): RNumberValue {
  return { num: value, markedAsInt, complexNumber }
}

export function argument(name: string, location: SourceRange, defaultValue?: RNode): RArgument  {
  return {
    type:    Type.Argument,
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
