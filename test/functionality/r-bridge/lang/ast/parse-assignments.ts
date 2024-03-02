import { assertAst, withShell } from '../../../_helper/shell'
import { exprList, numVal } from '../../../_helper/ast-builder'
import { RAssignmentOpPool } from '../../../_helper/provider'
import { rangeFrom } from '../../../../../src/util/range'
import { RType } from '../../../../../src'
import { label } from '../../../_helper/label'

describe('Parse simple assignments',
	withShell(shell => {
		describe('Constant Assignments', () => {
			for(const op of RAssignmentOpPool) {
				const opOffset = op.str.length - 1
				assertAst(label(`x ${op.str} 5`, ['binary-operator', 'infix-calls', 'function-calls', ...op.capabilities]),
					shell, `x ${op.str} 5`,exprList({
						type:     RType.BinaryOp,
						location: rangeFrom(1, 3, 1, 3 + opOffset),
						flavor:   'assignment',
						lexeme:   op.str,
						operator: op.str,
						info:     {},
						lhs:      {
							type:      RType.Symbol,
							location:  rangeFrom(1, 1, 1, 1),
							namespace: undefined,
							lexeme:    'x',
							content:   'x',
							info:      {}
						},
						rhs: {
							type:     RType.Number,
							location: rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
							lexeme:   '5',
							content:  numVal(5),
							info:     {}
						},
					})
				)
			}
		})

		// allow assignments to strings and function calls
		describe('Assignments to strings', () => {
			assertAst(label('Assign to given string', ['binary-operator', 'infix-calls', 'function-calls', 'local-left-assignment', 'name-quoted', 'numbers']),
				shell, '\'a\' <- 5', exprList({
					type:     RType.BinaryOp,
					location: rangeFrom(1, 5, 1, 6),
					flavor:   'assignment',
					lexeme:   '<-',
					operator: '<-',
					info:     {},
					lhs:      {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 3),
						namespace: undefined,
						lexeme:    "'a'",
						content:   'a',
						info:      {}
					},
					rhs: {
						type:     RType.Number,
						location: rangeFrom(1, 8, 1, 8),
						lexeme:   '5',
						content:  numVal(5),
						info:     {}
					},
				})
			)
		})

		describe('Assignment with an expression list', () => {
			assertAst(label('x <- { 2 * 3 }', ['binary-operator', 'infix-calls', 'function-calls', 'local-left-assignment', 'name-normal', 'numbers', 'grouping']),
				shell, 'x <- { 2 * 3 }', exprList({
					type:     RType.BinaryOp,
					location: rangeFrom(1, 3, 1, 4),
					flavor:   'assignment',
					lexeme:   '<-',
					operator: '<-',
					info:     {},
					lhs:      {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'x',
						content:   'x',
						info:      {}
					},
					rhs: {
						type:     RType.BinaryOp,
						location: rangeFrom(1, 10, 1, 10),
						flavor:   'arithmetic',
						lexeme:   '*',
						operator: '*',
						info:     {},
						lhs:      {
							type:     RType.Number,
							location: rangeFrom(1, 8, 1, 8),
							lexeme:   '2',
							content:  numVal(2),
							info:     {}
						},
						rhs: {
							type:     RType.Number,
							location: rangeFrom(1, 12, 1, 12),
							lexeme:   '3',
							content:  numVal(3),
							info:     {}
						}
					},
				}), {
					ignoreAdditionalTokens: true
				}
			)
		})
	})
)
