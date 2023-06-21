import { type RNumberValue, Type, RExpressionList, RNode, RParameter } from '../../src/r-bridge'
import { SourceRange } from '../../src/util/range'

const emptyInfo = { fullRange: undefined, additionalTokens: [], fullLexeme: undefined }

export function exprList(...children: RNode[]): RExpressionList {
  return { type: Type.ExpressionList, children, lexeme: undefined, info: emptyInfo }
}
export function numVal(value: number, markedAsInt = false, complexNumber = false): RNumberValue {
  return { num: value, markedAsInt, complexNumber }
}

export function argument(name: string, location: SourceRange, defaultValue?: RNode, special = false): RParameter  {
  return {
    type:    Type.Parameter,
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
