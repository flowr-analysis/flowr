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

