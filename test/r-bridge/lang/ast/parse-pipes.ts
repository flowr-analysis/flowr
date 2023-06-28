import { assertAst, withShell } from "../../../helper/shell"
import { exprList } from '../../../helper/ast-builder'
import { rangeFrom } from '../../../../src/util/range'
import { Type } from '../../../../src/r-bridge'

describe("Parse Pipes", withShell(shell => {
  assertAst(
    "x |> f()",
    shell,
    "x |> f()",
    exprList({
      type:     Type.Pipe,
      location: rangeFrom(1, 3, 1, 4),
      lexeme:   '|>',
      info:     {},
      lhs:      {
        type:      Type.Symbol,
        location:  rangeFrom(1, 1, 1, 1),
        lexeme:    'x',
        content:   'x',
        namespace: undefined,
        info:      {},
      },
      rhs: {
        type:         Type.FunctionCall,
        location:     rangeFrom(1, 6, 1, 6),
        lexeme:       'f',
        info:         {},
        arguments:    [],
        functionName: {
          type:      Type.Symbol,
          location:  rangeFrom(1, 6, 1, 6),
          lexeme:    'f',
          content:   'f',
          namespace: undefined,
          info:      {},
        }
      }
    })
  )
  /* TODO: Sys.setenv(`_R_USE_PIPEBIND_` = TRUE)
  assertAst(
    "With pipe bind: x |> . => f(.)",
    shell,
    "x |> . => f(.)",
    exprList({
      type:         Type.FunctionCall,
      location:     rangeFrom(1, 1, 1, 1),
      lexeme:       "f", // TODO: make this more sensible?
      info:         {},
      functionName: {
        type:      Type.Symbol,
        location:  rangeFrom(1, 1, 1, 1),
        lexeme:    "f",
        content:   "f",
        namespace: undefined,
        info:      {},
      },
      arguments: [],
    })
  )
    */
}))

