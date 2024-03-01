import { assertAst, withShell } from '../../../_helper/shell'
import { exprList, numVal } from '../../../_helper/ast-builder'
import { RArithmeticBinaryOpPool, RLogicalBinaryOpPool, RUnaryOpPool } from '../../../_helper/provider'
import type { RExpressionList } from '../../../../../src'
import { OperatorDatabase } from '../../../../../src'
import { ComparisonOperators, type RShell, RType } from '../../../../../src'
import { rangeFrom } from '../../../../../src/util/range'
import { DESUGAR_NORMALIZE, NORMALIZE } from '../../../../../src/core/steps/all/core/10-normalize'
import { label } from '../../../_helper/label'

describe('Parse simple operations', withShell(shell => {
	describe('unary operations', () => {
		for(const opSuite of RUnaryOpPool) {
			describe(`${opSuite.label} operations`, () => {
				for(const op of opSuite.pool) {
					const simpleInput = `${op.str}42`
					const opOffset = op.str.length - 1
					const opData = OperatorDatabase[op.str]
					assertAst(label(`${simpleInput}`, ['unary-operator', 'numbers', ...opData.capabilities]),
						shell, simpleInput, [
							{
								step:   NORMALIZE,
								wanted: exprList({
									type:     RType.UnaryOp,
									operator: op.str,
									flavor:   op.flavor,
									lexeme:   op.str,
									location: rangeFrom(1, 1, 1, 1 + opOffset),
									info:     {},
									operand:  {
										type:     RType.Number,
										location: rangeFrom(1, 2 + opOffset, 1, 3 + opOffset),
										lexeme:   '42',
										content:  numVal(42),
										info:     {}
									},
								})
							},
							{
								step:   DESUGAR_NORMALIZE,
								wanted: exprList({
									type:         RType.FunctionCall,
									lexeme:       simpleInput,
									flavor:       'named',
									location:     rangeFrom(1, 1, 1, 1 + opOffset),
									info:         {},
									functionName: {
										type:      RType.Symbol,
										lexeme:    op.str,
										content:   op.str,
										namespace: undefined,
										location:  rangeFrom(1, 1, 1, 1 + opOffset),
										info:      {}
									},
									arguments: [{
										type:     RType.Number,
										location: rangeFrom(1, 2 + opOffset, 1, 3 + opOffset),
										lexeme:   '42',
										content:  numVal(42),
										info:     {}
									}]
								})
							}
						]
					)
				}
			})
		}
	})
	describe('? question', () => {
		assertAst(label('? x', ['unary-operator', 'built-in-help', 'name-normal']),
			shell, '? x', [
				{
					step:   NORMALIZE,
					wanted: exprList({
						type:     RType.UnaryOp,
						location: rangeFrom(1, 1, 1, 1),
						operator: '?',
						lexeme:   '?',
						flavor:   'logical',
						info:     {},
						operand:  {
							type:      RType.Symbol,
							location:  rangeFrom(1, 3, 1, 3),
							lexeme:    'x',
							content:   'x',
							namespace: undefined,
							info:      {}
						}
					})
				},
				{
					step:   DESUGAR_NORMALIZE,
					wanted: exprList({
						type:         RType.FunctionCall,
						lexeme:       '? x',
						flavor:       'named',
						location:     rangeFrom(1, 1, 1, 1),
						info:         {},
						functionName: {
							type:      RType.Symbol,
							lexeme:    '?',
							content:   '?',
							namespace: undefined,
							location:  rangeFrom(1, 1, 1, 1),
							info:      {}
						},
						arguments: [{
							type:      RType.Symbol,
							location:  rangeFrom(1, 3, 1, 3),
							lexeme:    'x',
							content:   'x',
							namespace: undefined,
							info:      {}
						}]
					})
				}
			]
		)
	})

	describe('binary operations', () => {
		for(const opSuite of [
			{ label: 'arithmetic', pool: RArithmeticBinaryOpPool },
			{
				label: 'logical',
				pool:  RLogicalBinaryOpPool,
			},
		]) {
			describe(`${opSuite.label} operations`, () => {
				for(const op of opSuite.pool) {
					describePrecedenceTestsForOp(op, shell)
				}
			})
		}
		describe('comparison operations', () => {
			for(const op of ComparisonOperators) {
				describe(op, () => {
					const simpleInput = `1 ${op} 1`
					const opOffset = op.length - 1
					const opData = OperatorDatabase[op]
					assertAst(label(simpleInput, ['binary-operator', 'infix-calls', 'function-calls', 'numbers', ...opData.capabilities]),
						shell, simpleInput, [
							{
								step:   NORMALIZE,
								wanted: exprList({
									type:     RType.BinaryOp,
									operator: op,
									lexeme:   op,
									flavor:   'comparison',
									location: rangeFrom(1, 3, 1, 3 + opOffset),
									info:     {},
									lhs:      {
										type:     RType.Number,
										location: rangeFrom(1, 1, 1, 1),
										lexeme:   '1',
										content:  numVal(1),
										info:     {}
									},
									rhs: {
										type:     RType.Number,
										location: rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
										lexeme:   '1',
										content:  numVal(1),
										info:     {}
									},
								})
							},
							{
								step:   DESUGAR_NORMALIZE,
								wanted: exprList({
									type:         RType.FunctionCall,
									lexeme:       simpleInput,
									flavor:       'named',
									location:     rangeFrom(1, 3, 1, 3 + opOffset),
									info:         {},
									functionName: {
										type:      RType.Symbol,
										lexeme:    op,
										content:   op,
										namespace: undefined,
										location:  rangeFrom(1, 3, 1, 3 + opOffset),
										info:      {}
									},
									arguments: [
										{
											type:     RType.Number,
											location: rangeFrom(1, 1, 1, 1),
											lexeme:   '1',
											content:  numVal(1),
											info:     {}
										},
										{
											type:     RType.Number,
											location: rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
											lexeme:   '1',
											content:  numVal(1),
											info:     {}
										}
									]
								})
							}
						]
					)
				})
			}
		})

		describe('Intermixed with comments', () => {
			assertAst(label('1 + # comment\n2', ['binary-operator', 'infix-calls', 'function-calls', 'numbers', 'comments', 'newlines']),
				shell, '1 + # comment\n2', [
					{
						step:   NORMALIZE,
						wanted: exprList({ // hoist children
							type:     RType.ExpressionList,
							location: rangeFrom(1, 1, 2, 1),
							info:     {},
							lexeme:   '1 + # comment\n2',
							children: [
								{
									type:     RType.Comment,
									content:  ' comment',
									lexeme:   '# comment',
									location: rangeFrom(1, 5, 1, 13),
									info:     {}
								},
								{
									type:     RType.BinaryOp,
									flavor:   'arithmetic',
									info:     {},
									lexeme:   '+',
									operator: '+',
									location: rangeFrom(1, 3, 1, 3),
									lhs:      {
										type:     RType.Number,
										content:  numVal(1),
										info:     {},
										lexeme:   '1',
										location: rangeFrom(1, 1, 1, 1)
									},
									rhs: {
										type:     RType.Number,
										content:  numVal(2),
										info:     {},
										lexeme:   '2',
										location: rangeFrom(2, 1, 2, 1)
									}
								}
							]
						})
					},
					{
						step:   DESUGAR_NORMALIZE,
						wanted: exprList({
							type:     RType.FunctionCall,
							lexeme:   '1 + # comment\n2',
							flavor:   'named',
							location: rangeFrom(1, 3, 1, 3),
							info:     {
								additionalTokens: [
									{
										type:     RType.Comment,
										content:  ' comment',
										lexeme:   '# comment',
										location: rangeFrom(1, 5, 1, 13),
										info:     {}
									}
								]
							},
							functionName: {
								type:      RType.Symbol,
								lexeme:    '+',
								content:   '+',
								namespace: undefined,
								location:  rangeFrom(1, 3, 1, 3),
								info:      {}
							},
							arguments: [
								{
									type:     RType.Number,
									content:  numVal(1),
									info:     {},
									lexeme:   '1',
									location: rangeFrom(1, 1, 1, 1)
								},
								{
									type:     RType.Number,
									content:  numVal(2),
									info:     {},
									lexeme:   '2',
									location: rangeFrom(2, 1, 2, 1)
								}
							]
						})
					}
				], {
					ignoreAdditionalTokens: false
				}
			)
		})
		describe('Using unknown special infix operator', () => {
			assertAst(label('1 %xx% 2', ['binary-operator', 'infix-calls', 'function-calls', 'numbers', 'special-operator']),
				shell, '1 %xx% 2', [
					{
						step:   NORMALIZE,
						wanted: exprList({
							type:         RType.FunctionCall,
							flavor:       'named',
							infixSpecial: true,
							info:         {},
							lexeme:       '1 %xx% 2',
							functionName: {
								type:      RType.Symbol,
								lexeme:    '%xx%',
								content:   '%xx%',
								namespace: undefined,
								location:  rangeFrom(1, 3, 1, 6),
								info:      {}
							},
							location:  rangeFrom(1, 3, 1, 6),
							arguments: [
								{
									type:     RType.Argument,
									info:     {},
									lexeme:   '1',
									name:     undefined,
									location: rangeFrom(1, 1, 1, 1),
									value:    {
										type:     RType.Number,
										content:  numVal(1),
										info:     {},
										lexeme:   '1',
										location: rangeFrom(1, 1, 1, 1)
									}
								}, {
									type:     RType.Argument,
									info:     {},
									lexeme:   '2',
									name:     undefined,
									location: rangeFrom(1, 8, 1, 8),
									value:    {
										type:     RType.Number,
										content:  numVal(2),
										info:     {},
										lexeme:   '2',
										location: rangeFrom(1, 8, 1, 8)
									}
								}
							]
						})
					},
					{
						step:   DESUGAR_NORMALIZE,
						wanted: exprList({
							type:         RType.FunctionCall,
							flavor:       'named',
							info:         {},
							lexeme:       '1 %xx% 2',
							functionName: {
								type:      RType.Symbol,
								lexeme:    '%xx%',
								content:   '%xx%',
								namespace: undefined,
								location:  rangeFrom(1, 3, 1, 6),
								info:      {}
							},
							location:  rangeFrom(1, 3, 1, 6),
							arguments: [
								{
									type:     RType.Number,
									content:  numVal(1),
									info:     {},
									lexeme:   '1',
									location: rangeFrom(1, 1, 1, 1)
								}, {
									type:     RType.Number,
									content:  numVal(2),
									info:     {},
									lexeme:   '2',
									location: rangeFrom(1, 8, 1, 8)
								}
							]
						})
					}
				]
			)
		})
	})
})
)

function normalizeGenerate(
	op: typeof RArithmeticBinaryOpPool[number] | typeof RLogicalBinaryOpPool[number],
	opOffset: number,
	offsetL: number,
	offsetC: number,
	offsetR: number
): RExpressionList {
	return exprList({
		type:     RType.BinaryOp,
		operator: op.str,
		lexeme:   op.str,
		flavor:   op.flavor,
		location: rangeFrom(1, 7 + opOffset + offsetC, 1, 7 + 2 * opOffset + offsetC),
		info:     {},
		lhs:      {
			type:     RType.BinaryOp,
			operator: op.str,
			lexeme:   op.str,
			flavor:   op.flavor,
			location: rangeFrom(1, 3 + offsetL, 1, 3 + opOffset + offsetL),
			info:     {},
			lhs:      {
				type:     RType.Number,
				location: rangeFrom(1, 1 + offsetL, 1, 1 + offsetL),
				lexeme:   '1',
				content:  numVal(1),
				info:     {}
			},
			rhs: {
				type:     RType.Number,
				location: rangeFrom(1, 5 + opOffset + offsetL, 1, 5 + opOffset + offsetL),
				lexeme:   '1',
				content:  numVal(1),
				info:     {}
			}
		},
		rhs: {
			type:     RType.Number,
			location: rangeFrom(1, 9 + 2 * opOffset + offsetR, 1, 10 + 2 * opOffset + offsetR),
			lexeme:   '42',
			content:  numVal(42),
			info:     {}
		}
	})
}

function describePrecedenceTestsForOp(op: typeof RArithmeticBinaryOpPool[number] | typeof RLogicalBinaryOpPool[number], shell: RShell): void {
	describe(`${op.str} (${op.flavor})`, () => {
		const simpleInput = `1 ${op.str} 1`
		const opOffset = op.str.length - 1
		const opData = OperatorDatabase[op.str]
		assertAst(label(simpleInput, ['binary-operator', 'infix-calls', 'function-calls', 'numbers', ...opData.capabilities]),
			shell, simpleInput, [
				{
					step:   NORMALIZE,
					wanted: exprList({
						type:     RType.BinaryOp,
						operator: op.str,
						lexeme:   op.str,
						flavor:   op.flavor,
						location: rangeFrom(1, 3, 1, 3 + opOffset),
						info:     {},
						lhs:      {
							type:     RType.Number,
							location: rangeFrom(1, 1, 1, 1),
							lexeme:   '1',
							content:  numVal(1),
							info:     {}
						},
						rhs: {
							type:     RType.Number,
							location: rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
							lexeme:   '1',
							content:  numVal(1),
							info:     {}
						}
					}
					)
				},
				{
					step:   DESUGAR_NORMALIZE,
					wanted: exprList({
						type:         RType.FunctionCall,
						lexeme:       simpleInput,
						flavor:       'named',
						location:     rangeFrom(1, 3, 1, 3 + opOffset),
						info:         {},
						functionName: {
							type:      RType.Symbol,
							lexeme:    op.str,
							content:   op.str,
							namespace: undefined,
							location:  rangeFrom(1, 3, 1, 3 + opOffset),
							info:      {}
						},
						arguments: [{
							type:     RType.Number,
							location: rangeFrom(1, 1, 1, 1),
							lexeme:   '1',
							content:  numVal(1),
							info:     {}
						}, {
							type:     RType.Number,
							location: rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
							lexeme:   '1',
							content:  numVal(1),
							info:     {}
						}]
					})
				}
			])


		assertAst(label('Single Parenthesis', ['binary-operator', 'infix-calls', 'function-calls', 'numbers', 'grouping', ...opData.capabilities]),
			shell, `(1 ${op.str} 1) ${op.str} 42`, [
				{
					step:   NORMALIZE,
					wanted: normalizeGenerate(op, opOffset, 1, 2, 2)
				},
				{
					step:   DESUGAR_NORMALIZE,
					wanted: exprList({
						type:         RType.FunctionCall,
						lexeme:       `(1 ${op.str} 1) ${op.str} 42`,
						flavor:       'named',
						location:     rangeFrom(1, 7 + opOffset + 2, 1, 7 + 2 * opOffset + 2),
						info:         {},
						functionName: {
							type:      RType.Symbol,
							lexeme:    op.str,
							content:   op.str,
							namespace: undefined,
							location:  rangeFrom(1, 7 + opOffset + 2, 1, 7 + 2 * opOffset + 2),
							info:      {}
						},
						arguments: [
							{
								type:         RType.FunctionCall,
								lexeme:       '(',
								flavor:       'named',
								location:     rangeFrom(1, 1, 1, 1),
								info:         {},
								functionName: {
									type:      RType.Symbol,
									lexeme:    '(',
									content:   '(',
									namespace: undefined,
									location:  rangeFrom(1, 1, 1, 1),
									info:      {}
								},
								arguments: [{
									type:         RType.FunctionCall,
									lexeme:       `1 ${op.str} 1`,
									flavor:       'named',
									location:     rangeFrom(1, 4, 1, 4 + opOffset),
									info:         {},
									functionName: {
										type:      RType.Symbol,
										lexeme:    op.str,
										content:   op.str,
										namespace: undefined,
										location:  rangeFrom(1, 4, 1, 4 + opOffset),
										info:      {}
									},
									arguments: [
										{
											type:     RType.Number,
											location: rangeFrom(1, 2, 1, 2),
											lexeme:   '1',
											content:  numVal(1),
											info:     {}
										},
										{
											type:     RType.Number,
											location: rangeFrom(1, 6 + opOffset, 1, 6 + opOffset),
											lexeme:   '1',
											content:  numVal(1),
											info:     {}
										}
									]
								}]
							},
							{
								type:     RType.Number,
								location: rangeFrom(1, 9 + 2 * opOffset + 2, 1, 10 + 2 * opOffset + 2),
								lexeme:   '42',
								content:  numVal(42),
								info:     {}
							}
						]
					})
				}
			], {
				ignoreAdditionalTokens: true
			})

		assertAst(label('Multiple Parenthesis', ['binary-operator', 'infix-calls', 'function-calls', 'numbers', 'grouping', ...opData.capabilities]),
			shell, `(1 ${op.str} 1) ${op.str} (42)`, [
				{
					step:   NORMALIZE,
					wanted: normalizeGenerate(op, opOffset, 1, 2, 3)
				},
				{
					step:   DESUGAR_NORMALIZE,
					wanted: exprList({
						type:         RType.FunctionCall,
						lexeme:       `(1 ${op.str} 1) ${op.str} (42)`,
						flavor:       'named',
						location:     rangeFrom(1, 7 + opOffset + 2, 1, 7 + 2 * opOffset + 2),
						info:         {},
						functionName: {
							type:      RType.Symbol,
							lexeme:    op.str,
							content:   op.str,
							namespace: undefined,
							location:  rangeFrom(1, 7 + opOffset + 2, 1, 7 + 2 * opOffset + 2),
							info:      {}
						},
						arguments: [
							{
								type:         RType.FunctionCall,
								lexeme:       '(',
								flavor:       'named',
								location:     rangeFrom(1, 1, 1, 1),
								info:         {},
								functionName: {
									type:      RType.Symbol,
									lexeme:    '(',
									content:   '(',
									namespace: undefined,
									location:  rangeFrom(1, 1, 1, 1),
									info:      {}
								},
								arguments: [{
									type:         RType.FunctionCall,
									lexeme:       `1 ${op.str} 1`,
									flavor:       'named',
									location:     rangeFrom(1, 4, 1, 4 + opOffset),
									info:         {},
									functionName: {
										type:      RType.Symbol,
										lexeme:    op.str,
										content:   op.str,
										namespace: undefined,
										location:  rangeFrom(1, 4, 1, 4 + opOffset),
										info:      {}
									},
									arguments: [
										{
											type:     RType.Number,
											location: rangeFrom(1, 2, 1, 2),
											lexeme:   '1',
											content:  numVal(1),
											info:     {}
										},
										{
											type:     RType.Number,
											location: rangeFrom(1, 6 + opOffset, 1, 6 + opOffset),
											lexeme:   '1',
											content:  numVal(1),
											info:     {}
										}
									]
								}]
							},
							{
								type:         RType.FunctionCall,
								lexeme:       '(',
								flavor:       'named',
								location:     rangeFrom(1, 11 + 2 * opOffset, 1, 11 + 2 * opOffset),
								info:         {},
								functionName: {
									type:      RType.Symbol,
									lexeme:    '(',
									content:   '(',
									namespace: undefined,
									location:  rangeFrom(1, 11 + 2 * opOffset, 1, 11 + 2 * opOffset),
									info:      {}
								},
								arguments: [{
									type:     RType.Number,
									location: rangeFrom(1, 12 + 2 * opOffset, 1, 13 + 2 * opOffset),
									lexeme:   '42',
									content:  numVal(42),
									info:     {}
								}]
							}
						]
					})
				}
			], {
				ignoreAdditionalTokens: true
			})

		// exponentiation has a different behavior when nested without parenthesis
		if(op.str !== '^' && op.str !== '**') {
			assertAst(label('No Parenthesis', ['binary-operator', 'infix-calls', 'function-calls', 'numbers', 'grouping', ...opData.capabilities]),
				shell, `1 ${op.str} 1 ${op.str} 42`, [
					{
						step:   NORMALIZE,
						wanted: normalizeGenerate(op, opOffset, 0, 0, 0)
					},
					{
						step:   DESUGAR_NORMALIZE,
						wanted: exprList({
							type:         RType.FunctionCall,
							lexeme:       `1 ${op.str} 1 ${op.str} 42`,
							flavor:       'named',
							location:     rangeFrom(1, 7 + opOffset, 1, 7 + 2 * opOffset),
							info:         {},
							functionName: {
								type:      RType.Symbol,
								lexeme:    op.str,
								content:   op.str,
								namespace: undefined,
								location:  rangeFrom(1, 7 + opOffset, 1, 7 + 2 * opOffset),
								info:      {}
							},
							arguments: [
								{
									type:         RType.FunctionCall,
									lexeme:       `1 ${op.str} 1`,
									flavor:       'named',
									location:     rangeFrom(1, 3, 1, 3 + opOffset),
									info:         {},
									functionName: {
										type:      RType.Symbol,
										lexeme:    op.str,
										content:   op.str,
										namespace: undefined,
										location:  rangeFrom(1, 3, 1, 3 + opOffset),
										info:      {}
									},
									arguments: [
										{
											type:     RType.Number,
											location: rangeFrom(1, 1, 1, 1),
											lexeme:   '1',
											content:  numVal(1),
											info:     {}
										},
										{
											type:     RType.Number,
											location: rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
											lexeme:   '1',
											content:  numVal(1),
											info:     {}
										}
									]
								},
								{
									type:     RType.Number,
									location: rangeFrom(1, 9 + 2 * opOffset, 1, 10 + 2 * opOffset),
									lexeme:   '42',
									content:  numVal(42),
									info:     {}
								}
							]
						})
					}
				], {
					ignoreAdditionalTokens: true
				})
		}

		assertAst(label('Invert precedence', ['binary-operator', 'infix-calls', 'function-calls', 'numbers', 'grouping', ...opData.capabilities]),
			shell, `1 ${op.str} (1 ${op.str} 42)`, [
				{
					step:   NORMALIZE,
					wanted: exprList({
						type:     RType.BinaryOp,
						operator: op.str,
						lexeme:   op.str,
						flavor:   op.flavor,
						location: rangeFrom(1, 3, 1, 3 + opOffset),
						info:     {},
						lhs:      {
							type:     RType.Number,
							location: rangeFrom(1, 1, 1, 1),
							content:  numVal(1),
							lexeme:   '1',
							info:     {}
						},
						rhs: {
							type:     RType.BinaryOp,
							operator: op.str,
							lexeme:   op.str,
							flavor:   op.flavor,
							location: rangeFrom(1, 8 + opOffset, 1, 8 + 2 * opOffset),
							info:     {},
							lhs:      {
								type:     RType.Number,
								location: rangeFrom(1, 6 + opOffset, 1, 6 + opOffset),
								content:  numVal(1),
								lexeme:   '1',
								info:     {}
							},
							rhs: {
								type:     RType.Number,
								location: rangeFrom(1, 10 + 2 * opOffset, 1, 11 + 2 * opOffset),
								content:  numVal(42),
								lexeme:   '42',
								info:     {}
							}
						}
					})
				},
				{
					step:   DESUGAR_NORMALIZE,
					wanted: exprList({
						type:         RType.FunctionCall,
						lexeme:       `1 ${op.str} (1 ${op.str} 42)`,
						flavor:       'named',
						location:     rangeFrom(1, 3, 1, 3 + opOffset),
						info:         {},
						functionName: {
							type:      RType.Symbol,
							lexeme:    op.str,
							content:   op.str,
							namespace: undefined,
							location:  rangeFrom(1, 3, 1, 3 + opOffset),
							info:      {}
						},
						arguments: [
							{
								type:     RType.Number,
								location: rangeFrom(1, 1, 1, 1),
								content:  numVal(1),
								lexeme:   '1',
								info:     {}
							},
							{
								type:         RType.FunctionCall,
								lexeme:       '(',
								flavor:       'named',
								location:     rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
								info:         {},
								functionName: {
									type:      RType.Symbol,
									lexeme:    '(',
									content:   '(',
									namespace: undefined,
									location:  rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
									info:      {}
								},
								arguments: [
									{
										type:         RType.FunctionCall,
										lexeme:       `1 ${op.str} 42`,
										flavor:       'named',
										location:     rangeFrom(1, 8 + opOffset, 1, 8 + 2 * opOffset),
										info:         {},
										functionName: {
											type:      RType.Symbol,
											lexeme:    op.str,
											content:   op.str,
											namespace: undefined,
											location:  rangeFrom(1, 8 + opOffset, 1, 8 + 2 * opOffset),
											info:      {}
										},
										arguments: [
											{
												type:     RType.Number,
												location: rangeFrom(1, 6 + opOffset, 1, 6 + opOffset),
												content:  numVal(1),
												lexeme:   '1',
												info:     {}
											},
											{
												type:     RType.Number,
												location: rangeFrom(1, 10 + 2 * opOffset, 1, 11 + 2 * opOffset),
												content:  numVal(42),
												lexeme:   '42',
												info:     {}
											}
										]
									}
								]
							}
						]
					})
				}
			], {
				ignoreAdditionalTokens: true
			})
	})
}
