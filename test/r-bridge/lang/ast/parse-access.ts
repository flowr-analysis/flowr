import { assertAst, withShell } from "../../../helper/shell"
import { exprList } from '../../../helper/ast-builder'


// TODO: try slicing of something like
/*
 * a <- function() { x <- 3; i }
 * i <- 4
 * b <- function(f) { i <- 5; f() }
 * b(a)
 */
describe("Parse value access", withShell(shell => {
  describe("Bracket Access", () => {
    assertAst("Simple bracket access", shell, "a[1]", exprList())
  })
}))

