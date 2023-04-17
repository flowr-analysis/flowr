import { assertAst, describeSession } from '../../helper/shell'
import * as Lang from '../../../../src/r-bridge/lang/ast/model'
import { exprList, numVal } from '../../helper/ast-builder'
import { RArithmeticOpPool, RLogicalOpPool } from '../../helper/provider'
import { type RShell } from '../../../../src/r-bridge/shell'

describe('1. Parse simple expressions', () => {
  let idx = 0
  for (const opSuite of [{ label: 'arithmetic', pool: RArithmeticOpPool }, { label: 'logical', pool: RLogicalOpPool }]) {
    describeSession(`1.${++idx} ${opSuite.label} operations`, shell => {
      for (const op of opSuite.pool) {
        // TODO: we make %in% a comparison
        describePrecedenceTestsForOp(op, shell)
      }
    })
  }
  describeSession(`1.${++idx} comparison operations`, shell => {
    for (const op of ['==', '!=', '<', '>', '<=', '>=']) {
      describe(op, () => {
        const simpleInput = `1 ${op} 1`
        const opOffset = op.length - 1
        assertAst(simpleInput, shell, simpleInput, exprList(
          {
            type: Lang.Type.BinaryOp,
            op,
            flavor: 'comparison',
            location: Lang.rangeFrom(1, 3, 1, 3 + opOffset),
            lhs: {
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 1, 1, 1),
              content: numVal(1)
            },
            rhs: {
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
              content: numVal(1)
            }
          }
        ))
      })
    }
  })
})

function describePrecedenceTestsForOp(op: { flavor: 'arithmetic', str: string } | { flavor: 'logical', str: string }, shell: RShell): void {
  describe(`${op.str} (${op.flavor})`, () => {
    const simpleInput = `1 ${op.str} 1`
    const opOffset = op.str.length - 1
    assertAst(simpleInput, shell, simpleInput, exprList(
      {
        type: Lang.Type.BinaryOp,
        op: op.str,
        flavor: op.flavor,
        location: Lang.rangeFrom(1, 3, 1, 3 + opOffset),
        lhs: {
          type: Lang.Type.Number,
          location: Lang.rangeFrom(1, 1, 1, 1),
          content: numVal(1)
        },
        rhs: {
          type: Lang.Type.Number,
          location: Lang.rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
          content: numVal(1)
        }
      }
    ))

    // '^' has a different behavior when nested, TODO: will be tested below
    if (op.str === '^') {
      return
    }

    for (const defaultPrec of [ // offsets encode additional shifts by parenthesis
      { input: `1 ${op.str} 1 ${op.str} 42`, offsetL: 0, offsetC: 0, offsetR: 0 },
      { input: `(1 ${op.str} 1) ${op.str} 42`, offsetL: 1, offsetC: 2, offsetR: 2 },
      { input: `(1 ${op.str} 1) ${op.str} (42)`, offsetL: 1, offsetC: 2, offsetR: 3 }
    ]) {
      assertAst(defaultPrec.input, shell, defaultPrec.input, exprList(
        {
          type: Lang.Type.BinaryOp,
          op: op.str,
          flavor: op.flavor,
          location: Lang.rangeFrom(1, 7 + opOffset + defaultPrec.offsetC, 1, 7 + 2 * opOffset + defaultPrec.offsetC),
          lhs: {
            type: Lang.Type.BinaryOp,
            op: op.str,
            flavor: op.flavor,
            location: Lang.rangeFrom(1, 3 + defaultPrec.offsetL, 1, 3 + opOffset + defaultPrec.offsetL),
            lhs: {
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 1 + defaultPrec.offsetL, 1, 1 + defaultPrec.offsetL),
              content: numVal(1)
            },
            rhs: {
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 5 + opOffset + defaultPrec.offsetL, 1, 5 + opOffset + defaultPrec.offsetL),
              content: numVal(1)
            }
          },
          rhs: {
            type: Lang.Type.Number,
            location: Lang.rangeFrom(1, 9 + 2 * opOffset + defaultPrec.offsetR, 1, 10 + 2 * opOffset + defaultPrec.offsetR),
            content: numVal(42)
          }
        }
      ))
    }

    const invertedPrecedenceInput = `1 ${op.str} (1 ${op.str} 42)`
    assertAst(invertedPrecedenceInput, shell, invertedPrecedenceInput, exprList(
      {
        type: Lang.Type.BinaryOp,
        op: op.str,
        flavor: op.flavor,
        location: Lang.rangeFrom(1, 3, 1, 3 + opOffset),
        lhs: {
          type: Lang.Type.Number,
          location: Lang.rangeFrom(1, 1, 1, 1),
          content: numVal(1)
        },
        rhs: {
          type: Lang.Type.BinaryOp,
          op: op.str,
          flavor: op.flavor,
          // TODO: deal with brackets in location?
          location: Lang.rangeFrom(1, 8 + opOffset, 1, 8 + 2 * opOffset),
          lhs: {
            type: Lang.Type.Number,
            location: Lang.rangeFrom(1, 6 + opOffset, 1, 6 + opOffset),
            content: numVal(1)
          },
          rhs: {
            type: Lang.Type.Number,
            location: Lang.rangeFrom(1, 10 + 2 * opOffset, 1, 11 + 2 * opOffset),
            content: numVal(42)
          }
        }
      }
    ))
  })
}
