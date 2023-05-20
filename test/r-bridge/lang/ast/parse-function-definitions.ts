import { assertAst, withShell } from "../../../helper/shell"
import { exprList } from "../../../helper/ast-builder"
import { rangeFrom } from "../../../../src/util/range"
import { Type } from '../../../../src/r-bridge'

describe("Parse function definitions",
  withShell((shell) => {
    describe("functions without arguments", () => {
      const noop = "function() { }"
      assertAst(`noop - ${noop}`, shell, noop,
        exprList({
          type:       Type.Function,
          location:   rangeFrom(1, 1, 1, 8),
          lexeme:     "function",
          parameters: [],
          info:       {},
          body:       exprList()
        })
      )
    })
  })
)
