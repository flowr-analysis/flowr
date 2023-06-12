import { type RNumberValue, Type, RExpressionList, RNode, RArgument } from '../../src/r-bridge'
import { SourceRange } from '../../src/util/range'

const emptyInfo = { range: undefined, additionalTokens: [] }

export function exprList(...children: RNode[]): RExpressionList {
  return { type: Type.ExpressionList, children, lexeme: undefined, info: emptyInfo }
}
export function numVal(value: number, markedAsInt = false, complexNumber = false): RNumberValue {
  return { num: value, markedAsInt, complexNumber }
}

export function argument(name: string, location: SourceRange, defaultValue?: RNode, special = false): RArgument  {
  return {
    type:    Type.Argument,
    location,
    special,
    lexeme:  name,
    content: name,
    defaultValue,
    name:    {
      type:      Type.Symbol,
      location,
      lexeme:    name,
      content:   name,
      namespace: undefined,
      info:      emptyInfo
    },
    info: emptyInfo
  }
}
