import { exprList, numVal } from '../../../_helper/ast-builder'
import { assertAst, withShell } from '../../../_helper/shell'
import { rangeFrom } from '../../../../../src/util/range'
import { RType } from '../../../../../src'
import { ensureExpressionList } from '../../../../../src/r-bridge/lang-4.x/ast/parser/xml/v1/internal'
import { label } from '../../../_helper/label'
import { DESUGAR_NORMALIZE, NORMALIZE } from '../../../../../src/core/steps/all/core/10-normalize'

describe('Parse larger snippets', withShell((shell) => {
	describe('if-then, assignments, symbols, and comparisons', () => {
		assertAst(label('Manual max function', [
			'name-normal', 'local-left-assignment', 'local-equal-assignment', 'local-right-assignment', 'super-left-assignment',
			'super-right-assignment', 'numbers', 'if', 'binary-operator', 'grouping', 'newlines'
		]), shell,
		`
a <- 3
b = 4
if (a >b) {
  max <<- a
  i ->2
} else {
  b ->> max
}
max
    `, [
			{
				step:   NORMALIZE,
				wanted: exprList(
					{
						type:     RType.BinaryOp,
						flavor:   'assignment',
						lexeme:   '<-',
						operator: '<-',
						location: rangeFrom(2, 3, 2, 4),
						info:     {},
						lhs:      {
							type:      RType.Symbol,
							lexeme:    'a',
							namespace: undefined,
							content:   'a',
							location:  rangeFrom(2, 1, 2, 1),
							info:      {}
						},
						rhs: {
							type:     RType.Number,
							lexeme:   '3',
							content:  numVal(3),
							location: rangeFrom(2, 6, 2, 6),
							info:     {}
						},
					},
					{
						type:     RType.BinaryOp,
						flavor:   'assignment',
						lexeme:   '=',
						operator: '=',
						location: rangeFrom(3, 3, 3, 3),
						info:     {},
						lhs:      {
							type:      RType.Symbol,
							lexeme:    'b',
							namespace: undefined,
							content:   'b',
							location:  rangeFrom(3, 1, 3, 1),
							info:      {}
						},
						rhs: {
							type:     RType.Number,
							lexeme:   '4',
							content:  numVal(4),
							location: rangeFrom(3, 5, 3, 5),
							info:     {}
						},
					},
					{
						type:      RType.IfThenElse,
						lexeme:    'if',
						location:  rangeFrom(4, 1, 4, 2),
						info:      {},
						condition: {
							type:     RType.BinaryOp,
							flavor:   'comparison',
							lexeme:   '>',
							operator: '>',
							location: rangeFrom(4, 7, 4, 7),
							info:     {},
							lhs:      {
								type:      RType.Symbol,
								lexeme:    'a',
								namespace: undefined,
								content:   'a',
								location:  rangeFrom(4, 5, 4, 5),
								info:      {}
							},
							rhs: {
								type:      RType.Symbol,
								lexeme:    'b',
								namespace: undefined,
								content:   'b',
								location:  rangeFrom(4, 8, 4, 8),
								info:      {}
							},
						},
						then: {
							type:     RType.ExpressionList,
							lexeme:   '{\n  max <<- a\n  i ->2\n}',
							location: rangeFrom(4, 11, 7, 1),
							info:     {},
							children: [
								{
									type:     RType.BinaryOp,
									flavor:   'assignment',
									lexeme:   '<<-',
									operator: '<<-',
									location: rangeFrom(5, 7, 5, 9),
									info:     {},
									lhs:      {
										type:      RType.Symbol,
										lexeme:    'max',
										namespace: undefined,
										content:   'max',
										location:  rangeFrom(5, 3, 5, 5),
										info:      {}
									},
									rhs: {
										type:      RType.Symbol,
										lexeme:    'a',
										namespace: undefined,
										content:   'a',
										location:  rangeFrom(5, 11, 5, 11),
										info:      {}
									},
								},
								{
									type:     RType.BinaryOp,
									flavor:   'assignment',
									lexeme:   '->',
									operator: '->',
									location: rangeFrom(6, 5, 6, 6),
									info:     {},
									lhs:      {
										type:      RType.Symbol,
										lexeme:    'i',
										namespace: undefined,
										content:   'i',
										location:  rangeFrom(6, 3, 6, 3),
										info:      {}
									},
									rhs: {
										type:     RType.Number,
										lexeme:   '2',
										content:  numVal(2),
										location: rangeFrom(6, 7, 6, 7),
										info:     {}
									},
								},
							],
						},
						otherwise: ensureExpressionList({
							type:     RType.BinaryOp,
							flavor:   'assignment',
							lexeme:   '->>',
							operator: '->>',
							location: rangeFrom(8, 5, 8, 7),
							info:     {},
							lhs:      {
								type:      RType.Symbol,
								lexeme:    'b',
								namespace: undefined,
								content:   'b',
								location:  rangeFrom(8, 3, 8, 3),
								info:      {}
							},
							rhs: {
								type:      RType.Symbol,
								lexeme:    'max',
								namespace: undefined,
								content:   'max',
								location:  rangeFrom(8, 9, 8, 11),
								info:      {}
							},
						}),
					},
					{
						type:      RType.Symbol,
						lexeme:    'max',
						content:   'max',
						namespace: undefined,
						location:  rangeFrom(10, 1, 10, 3),
						info:      {}
					}
				)
			},
			{
				step:   DESUGAR_NORMALIZE,
				wanted: exprList(
					{
						type:         RType.FunctionCall,
						lexeme:       'a <- 3',
						location:     rangeFrom(2, 3, 2, 4),
						flavor:       'named',
						functionName: {
							type:      RType.Symbol,
							lexeme:    '<-',
							content:   '<-',
							namespace: undefined,
							location:  rangeFrom(2, 3, 2, 4),
							info:      {}
						},
						arguments: [
							{
								type:      RType.Symbol,
								lexeme:    'a',
								content:   'a',
								namespace: undefined,
								location:  rangeFrom(2, 1, 2, 1),
								info:      {}
							},
							{
								type:     RType.Number,
								lexeme:   '3',
								content:  numVal(3),
								location: rangeFrom(2, 6, 2, 6),
								info:     {}
							}
						],
						info: {}
					},
					{
						type: 			     RType.FunctionCall,
						lexeme: 		    'b = 4',
						location: 	   rangeFrom(3, 3, 3, 3),
						flavor: 		    'named',
						info: 			     {},
						functionName: {
							type:      RType.Symbol,
							lexeme:    '=',
							content:   '=',
							namespace: undefined,
							location:  rangeFrom(3, 3, 3, 3),
							info:      {}
						},
						arguments: [
							{
								type:      RType.Symbol,
								lexeme:    'b',
								content:   'b',
								namespace: undefined,
								location:  rangeFrom(3, 1, 3, 1),
								info:      {}
							},
							{
								type:     RType.Number,
								lexeme:   '4',
								content:  numVal(4),
								location: rangeFrom(3, 5, 3, 5),
								info:     {}
							}
						]
					},
					{
						type:         RType.FunctionCall,
						lexeme:       'if',
						location:     rangeFrom(4, 1, 4, 2),
						flavor:       'named',
						info:         {},
						functionName: {
							type:      RType.Symbol,
							lexeme:    'if',
							content:   'if',
							namespace: undefined,
							location:  rangeFrom(4, 1, 4, 2),
							info:      {}
						},
						arguments: [
							{
								type:         RType.FunctionCall,
								lexeme:       'a >b',
								info:         {},
								flavor:       'named',
								functionName: {
									type:      RType.Symbol,
									lexeme:    '>',
									content:   '>',
									namespace: undefined,
									location:  rangeFrom(4, 7, 4, 7),
									info:      {}
								},
								location:  rangeFrom(4, 7, 4, 7),
								arguments: [
									{
										type:      RType.Symbol,
										lexeme:    'a',
										content:   'a',
										namespace: undefined,
										location:  rangeFrom(4, 5, 4, 5),
										info:      {}
									},
									{
										type:      RType.Symbol,
										lexeme:    'b',
										content:   'b',
										namespace: undefined,
										location:  rangeFrom(4, 8, 4, 8),
										info:      {}
									}
								]
							},
							{
								type:         RType.FunctionCall,
								lexeme:       '{',
								location:     rangeFrom(4, 11, 4, 11),
								flavor:       'named',
								info:         {},
								functionName: {
									type:      RType.Symbol,
									lexeme:    '{',
									content:   '{',
									namespace: undefined,
									location:  rangeFrom(4, 11, 4, 11),
									info:      {}
								},
								arguments: [
									{
										type: 			     RType.FunctionCall,
										lexeme: 		    'max <<- a',
										location: 	   rangeFrom(5, 7, 5, 9),
										flavor: 		    'named',
										info: 			     {},
										functionName: {
											type:      RType.Symbol,
											lexeme:    '<<-',
											content:   '<<-',
											namespace: undefined,
											location:  rangeFrom(5, 7, 5, 9),
											info:      {}
										},
										arguments: [
											{
												type:      RType.Symbol,
												lexeme:    'max',
												content:   'max',
												namespace: undefined,
												location:  rangeFrom(5, 3, 5, 5),
												info:      {}
											},
											{
												type:      RType.Symbol,
												lexeme:    'a',
												content:   'a',
												namespace: undefined,
												location:  rangeFrom(5, 11, 5, 11),
												info:      {}
											}
										]
									},
									{
										type:         RType.FunctionCall,
										lexeme:       'i ->2',
										location:     rangeFrom(6, 5, 6, 6),
										flavor:       'named',
										info:         {},
										functionName: {
											type:      RType.Symbol,
											lexeme:    '->',
											content:   '->',
											namespace: undefined,
											location:  rangeFrom(6, 5, 6, 6),
											info:      {}
										},
										arguments: [
											{
												type:      RType.Symbol,
												lexeme:    'i',
												content:   'i',
												namespace: undefined,
												location:  rangeFrom(6, 3, 6, 3),
												info:      {}
											},
											{
												type:     RType.Number,
												lexeme:   '2',
												content:  numVal(2),
												location: rangeFrom(6, 7, 6, 7),
												info:     {}
											}
										]
									}
								]
							},
							{
								type:         RType.FunctionCall,
								lexeme:       '{',
								location:     rangeFrom(7, 8, 7, 8),
								flavor:       'named',
								info:         {},
								functionName: {
									type:      RType.Symbol,
									lexeme:    '{',
									content:   '{',
									namespace: undefined,
									location:  rangeFrom(7, 8, 7, 8),
									info:      {}
								},
								arguments: [
									{
										type:         RType.FunctionCall,
										lexeme:       'b ->> max',
										location:     rangeFrom(8, 5, 8, 7),
										flavor:       'named',
										info:         {},
										functionName: {
											type:      RType.Symbol,
											lexeme:    '->>',
											content:   '->>',
											namespace: undefined,
											location:  rangeFrom(8, 5, 8, 7),
											info:      {}
										},
										arguments: [
											{
												type:      RType.Symbol,
												lexeme:    'b',
												content:   'b',
												namespace: undefined,
												location:  rangeFrom(8, 3, 8, 3),
												info:      {}
											},
											{
												type:      RType.Symbol,
												lexeme:    'max',
												content:   'max',
												namespace: undefined,
												location:  rangeFrom(8, 9, 8, 11),
												info:      {}
											}
										]
									}
								]
							}
						]
					},
					{
						type:      RType.Symbol,
						lexeme:    'max',
						content:   'max',
						namespace: undefined,
						location:  rangeFrom(10, 1, 10, 3),
						info:      {}
					}
				)
			}
		], {
			ignoreAdditionalTokens: true
		}
		)
	})
})
)
