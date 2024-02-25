import { assertAst, withShell } from '../../../_helper/shell'
import { exprList, numVal } from '../../../_helper/ast-builder'
import type { SourceRange } from '../../../../../src/util/range'
import { addRanges, rangeFrom } from '../../../../../src/util/range'
import type { RNode } from '../../../../../src'
import { RType } from '../../../../../src'
import { ensureExpressionList } from '../../../../../src/r-bridge/lang-4.x/ast/parser/xml/v1/internal'
import type { FlowrCapabilityId } from '../../../../../src/r-bridge/data'
import { label } from '../../../_helper/label'
import { DESUGAR_NORMALIZE, NORMALIZE } from '../../../../../src/core/steps/all/core/10-normalize'

interface IfThenSpacing {
	str:          string
	locationTrue: ReturnType<typeof rangeFrom>
	then:         RNode
	num:          number,
	locationNum:  ReturnType<typeof rangeFrom>
	end:          ReturnType<typeof rangeFrom>
	/* yes, we could give them just once, but if we ever want to modify the list this is more flexible */
	capabilities: FlowrCapabilityId[]
}

const IfThenSpacingVariants: IfThenSpacing[] = [
	{
		str:          'if(TRUE)1',
		locationTrue: rangeFrom(1, 4, 1, 7),
		then:         { type: RType.Number, location: rangeFrom(1, 9, 1, 9), lexeme: '1', content: numVal(1), info: {} },
		num:          1,
		locationNum:  rangeFrom(1, 9, 1, 9),
		end:          rangeFrom(1, 9, 1, 9),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if(TRUE) 1',
		locationTrue: rangeFrom(1, 4, 1, 7),
		then:         { type: RType.Number, location: rangeFrom(1, 10, 1, 10), lexeme: '1', content: numVal(1), info: {} },
		num:          1,
		locationNum:  rangeFrom(1, 10, 1, 10),
		end:          rangeFrom(1, 10, 1, 10),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if (TRUE) 1',
		locationTrue: rangeFrom(1, 5, 1, 8),
		num:          1,
		locationNum:  rangeFrom(1, 11, 1, 11),
		then:         { type: RType.Number, location: rangeFrom(1, 11, 1, 11), lexeme: '1', content: numVal(1), info: {} },
		end:          rangeFrom(1, 11, 1, 11),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if     (TRUE)  42',
		locationTrue: rangeFrom(1, 9, 1, 12),
		num:          42,
		locationNum:  rangeFrom(1, 16, 1, 17),
		then:         { type: RType.Number, location: rangeFrom(1, 16, 1, 17), lexeme: '42', content: numVal(42), info: {} },
		end:          rangeFrom(1, 17, 1, 17),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if\n(TRUE)1',
		locationTrue: rangeFrom(2, 2, 2, 5),
		num:          1,
		locationNum:  rangeFrom(2,7,2,7),
		then:         { type: RType.Number, location: rangeFrom(2, 7, 2, 7), lexeme: '1', content: numVal(1), info: {} },
		end:          rangeFrom(2, 7, 2, 7),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if(TRUE)\n1',
		locationTrue: rangeFrom(1, 4, 1, 7),
		num:          1,
		locationNum:  rangeFrom(2,1,2,1),
		then:         { type: RType.Number, location: rangeFrom(2, 1, 2, 1), lexeme: '1', content: numVal(1), info: {} },
		end:          rangeFrom(2, 1, 2, 1),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if\n(\nTRUE\n)\n1',
		locationTrue: rangeFrom(3, 1, 3, 4),
		num:          1,
		locationNum:  rangeFrom(5,1,5,1),
		then:         { type: RType.Number, location: rangeFrom(5, 1, 5, 1), lexeme: '1', content: numVal(1), info: {} },
		end:          rangeFrom(5, 1, 5, 1),
		capabilities: ['if', 'logical', 'numbers']
	},
]

function inBrace(location: SourceRange, content: RNode): RNode {
	return {
		type:         RType.FunctionCall,
		location,
		lexeme:       '{',
		flavor:       'named',
		info:         {},
		functionName: {
			type:      RType.Symbol,
			location,
			lexeme:    '{',
			content:   '{',
			namespace: undefined,
			info:      {}
		},
		arguments: [content]
	}
}

const IfThenBraceVariants: IfThenSpacing[] = [{
	str:          'if(TRUE){1}',
	locationTrue: rangeFrom(1, 4, 1, 7),
	num:          1,
	locationNum:  rangeFrom(1,10,1,10),
	then:         inBrace(rangeFrom(1, 9, 1, 9), { type: RType.Number, location: rangeFrom(1, 10, 1, 10), lexeme: '1', content: numVal(1), info: {} }),
	end:          rangeFrom(1, 11, 1, 11),
	capabilities: ['if', 'logical', 'numbers', 'grouping']
}, {
	str:          'if(TRUE){42}',
	locationTrue: rangeFrom(1, 4, 1, 7),
	locationNum:  rangeFrom(1, 10, 1, 11),
	then:         inBrace(rangeFrom(1, 9, 1, 9), { type: RType.Number, location: rangeFrom(1, 10, 1, 11), lexeme: '42', content: numVal(42), info: {} }),
	num:          42,
	end:          rangeFrom(1, 12, 1, 12),
	capabilities: ['if', 'logical', 'numbers', 'grouping']
}, {
	str:          'if(TRUE){{{1}}}',
	locationTrue: rangeFrom(1, 4, 1, 7),
	locationNum:  rangeFrom(1, 12, 1, 12),
	then:         inBrace(rangeFrom(1, 9, 1, 9),
		inBrace(rangeFrom(1, 10, 1, 10),
			inBrace(rangeFrom(1, 11, 1, 11), { type: RType.Number, location: rangeFrom(1, 12, 1, 12), lexeme: '1', content: numVal(1), info: {} })
		)
	),
	num:          1,
	end:          rangeFrom(1, 15, 1, 15),
	capabilities: ['if', 'logical', 'numbers', 'grouping']
}]

interface ElseSpacing {
	str:          string
	locationElse: ReturnType<typeof rangeFrom>
	otherwise:    (offset: SourceRange) => RNode,
	num:          number,
	capabilities: FlowrCapabilityId[]
}

// suffix of if-then counterparts
const ElseSpacingVariants: ElseSpacing[] = [{
	/* one space/newline around is the minimum for R */
	str:          ' else 2',
	locationElse: rangeFrom(0, 7, 0, 7),
	num:          2,
	otherwise:    off => ({ type: RType.Number, location: addRanges(off, rangeFrom(0, 7, 0, 7)), lexeme: '2', content: numVal(2), info: {} }),
	capabilities: ['if', 'numbers']
}, {
	str:          ' else  9',
	locationElse: rangeFrom(0, 8, 0, 8),
	num:          9,
	otherwise:    off => ({ type: RType.Number, location: addRanges(off, rangeFrom(0, 8, 0, 8)), lexeme: '9', content: numVal(9), info: {} }),
	capabilities: ['if', 'numbers']
}]

const ElseBracesVariants: ElseSpacing[] = [{
	str:          ' else {2}',
	locationElse: rangeFrom(0, 8, 0, 8),
	otherwise: 	  off => inBrace(addRanges(off, rangeFrom(0, 7, 0, 7)), { type: RType.Number, location: addRanges(off, rangeFrom(0, 8, 0, 8)), lexeme: '2', content: numVal(2), info: {} }),
	num:          2,
	capabilities: ['if', 'numbers', 'grouping']
}, {
	str:          ' else {{{42}}}',
	locationElse: rangeFrom(0, 10, 0, 11),
	otherwise:    off => inBrace(addRanges(off, rangeFrom(0, 7, 0, 7)),
		inBrace(addRanges(off, rangeFrom(0, 8, 0, 8)),
			inBrace(addRanges(off, rangeFrom(0, 9, 0, 9)), { type: RType.Number, location: addRanges(off, rangeFrom(0, 10, 0, 11)), lexeme: '42', content: numVal(42), info: {} })
		)
	),
	num:          42,
	capabilities: ['if', 'numbers', 'grouping']
}]

describe('Parse simple constructs', withShell(shell => {
	describe('if', () => {
		describe('if-then', () => {
			for(const pool of [{ name: 'braces', variants: IfThenBraceVariants }, {
				name:     'spacing',
				variants: IfThenSpacingVariants
			}]) {
				describe(`${pool.name} variants`, () => {
					for(const variant of pool.variants) {
						const strNum = `${variant.num}`
						assertAst(label(JSON.stringify(variant.str), variant.capabilities), shell, variant.str, [
							{
								step:   NORMALIZE,
								wanted: exprList({
									type:      RType.IfThenElse,
									location:  rangeFrom(1, 1, 1, 2),
									lexeme:    'if',
									info:      {},
									condition: {
										type:     RType.Logical,
										location: variant.locationTrue,
										lexeme:   'TRUE',
										content:  true,
										info:     {}
									},
									then: ensureExpressionList({
										type:     RType.Number,
										location: variant.locationNum,
										lexeme:   strNum,
										content:  numVal(variant.num),
										info:     {}
									})
								})
							}, {
								step:   DESUGAR_NORMALIZE,
								wanted: exprList({
									type:         RType.FunctionCall,
									location:     rangeFrom(1, 1, 1, 2),
									lexeme:       'if',
									info:         {},
									flavor:       'named',
									functionName: {
										type:      RType.Symbol,
										location:  rangeFrom(1, 1, 1, 2),
										lexeme:    'if',
										content:   'if',
										namespace: undefined,
										info:      {}
									},
									arguments: [{
										type:     RType.Logical,
										location: variant.locationTrue,
										lexeme:   'TRUE',
										content:  true,
										info:     {}
									}, variant.then ]
								})
							}
						], {
							ignoreAdditionalTokens: true
						})
					}
				})
			}
		})
		describe('if-then-else', () => {
			for(const elsePool of [{ name: 'braces', variants: ElseBracesVariants }, {
				name:     'spacing',
				variants: ElseSpacingVariants
			}]) {
				for(const ifThenPool of [{ name: 'braces', variants: IfThenBraceVariants }, {
					name:     'spacing',
					variants: IfThenSpacingVariants
				}]) {
					describe(`if-then: ${ifThenPool.name}, else: ${elsePool.name}`, () => {
						for(const elseVariant of elsePool.variants) {
							for(const ifThenVariant of ifThenPool.variants) {
								const thenNum = `${ifThenVariant.num}`
								const elseNum = `${elseVariant.num}`
								const input = `${ifThenVariant.str}${elseVariant.str}`
								assertAst(label(JSON.stringify(input), [...ifThenVariant.capabilities, ...elseVariant.capabilities]), shell, input, [
									{
										step: NORMALIZE,
										wanted:
									exprList({
										type:      RType.IfThenElse,
										location:  rangeFrom(1, 1, 1, 2),
										lexeme:    'if',
										info:      {},
										condition: {
											type:     RType.Logical,
											location: ifThenVariant.locationTrue,
											lexeme:   'TRUE',
											content:  true,
											info:     {}
										},
										then: ensureExpressionList({
											type:     RType.Number,
											location: ifThenVariant.locationNum,
											lexeme:   thenNum,
											content:  numVal(ifThenVariant.num),
											info:     {}
										}),
										otherwise: ensureExpressionList({
											type:     RType.Number,
											location: addRanges(elseVariant.locationElse, ifThenVariant.end),
											lexeme:   elseNum,
											content:  numVal(elseVariant.num),
											info:     {}
										})
									})
									},
									{
										step:   DESUGAR_NORMALIZE,
										wanted: exprList({
											type:         RType.FunctionCall,
											location:     rangeFrom(1, 1, 1, 2),
											lexeme:       'if',
											info:         {},
											flavor:       'named',
											functionName: {
												type:      RType.Symbol,
												location:  rangeFrom(1, 1, 1, 2),
												lexeme:    'if',
												content:   'if',
												namespace: undefined,
												info:      {}
											},
											arguments: [{
												type:     RType.Logical,
												location: ifThenVariant.locationTrue,
												lexeme:   'TRUE',
												content:  true,
												info:     {}
											}, ifThenVariant.then, elseVariant.otherwise(ifThenVariant.end) ]
										})
									}], {
									ignoreAdditionalTokens: true
								})
							}
						}
					})
				}
			}
		})
	})
	describe('loops', () => {
		describe('for', () => {
			assertAst(label('for(i in 1:10) 2', ['for-loop', 'name-normal', 'numbers', 'built-in-sequencing']), shell, 'for(i in 1:42)2', [
				{
					step:   NORMALIZE,
					wanted: exprList({
						type:     RType.ForLoop,
						location: rangeFrom(1, 1, 1, 3),
						lexeme:   'for',
						info:     {},
						variable: {
							type:      RType.Symbol,
							location:  rangeFrom(1, 5, 1, 5),
							namespace: undefined,
							lexeme:    'i',
							content:   'i',
							info:      {}
						},
						vector: {
							type:     RType.BinaryOp,
							flavor:   'arithmetic',
							operator: ':',
							location: rangeFrom(1, 11, 1, 11),
							lexeme:   ':',
							info:     {},
							lhs:      {
								type:     RType.Number,
								location: rangeFrom(1, 10, 1, 10),
								lexeme:   '1',
								content:  numVal(1),
								info:     {}
							},
							rhs: {
								type:     RType.Number,
								location: rangeFrom(1, 12, 1, 13),
								lexeme:   '42',
								content:  numVal(42),
								info:     {}
							}
						},
						body: ensureExpressionList({
							type:     RType.Number,
							location: rangeFrom(1, 15, 1, 15),
							lexeme:   '2',
							content:  numVal(2),
							info:     {}
						})
					})
				},
				{
					step:   DESUGAR_NORMALIZE,
					wanted: exprList({
						type:         RType.FunctionCall,
						location:     rangeFrom(1, 1, 1, 3),
						lexeme:       'for',
						info:         {},
						flavor:       'named',
						functionName: {
							type:      RType.Symbol,
							location:  rangeFrom(1, 1, 1, 3),
							lexeme:    'for',
							content:   'for',
							namespace: undefined,
							info:      {}
						},
						arguments: [
							{
								type:      RType.Symbol,
								location:  rangeFrom(1, 5, 1, 5),
								lexeme:    'i',
								content:   'i',
								info:      {},
								namespace: undefined
							},
							{
								type:         RType.FunctionCall,
								location:     rangeFrom(1, 11, 1, 11),
								lexeme:       '1:42',
								info:         {},
								flavor:       'named',
								functionName: {
									type: 		   RType.Symbol,
									location: 	rangeFrom(1, 11, 1, 11),
									lexeme: 	  ':',
									content: 	 ':',
									namespace: undefined,
									info: 		   {}
								},
								arguments: [
									{
										type:     RType.Number,
										location: rangeFrom(1, 10, 1, 10),
										lexeme:   '1',
										content:  numVal(1),
										info:     {}
									},
									{
										type:     RType.Number,
										location: rangeFrom(1, 12, 1, 13),
										lexeme:   '42',
										content:  numVal(42),
										info:     {}
									}
								]
							},
							{
								type:     RType.Number,
								location: rangeFrom(1, 15, 1, 15),
								lexeme:   '2',
								content:  numVal(2),
								info:     {}
							}
						]
					})
				}
			], {
				ignoreAdditionalTokens: true
			}
			)
			assertAst(label('for-loop with comment', ['for-loop', 'name-normal', 'numbers', 'built-in-sequencing', 'comments']), shell, `for(#a
				i#b
				in#c
				1:42#d
			)
			2`,[{
				step:   NORMALIZE, wanted: exprList({
					type:     RType.ForLoop,
					location: rangeFrom(1, 1, 1, 3),
					lexeme:   'for',
					info:     {},
					variable: {
						type:      RType.Symbol,
						location:  rangeFrom(2, 33, 2, 33),
						namespace: undefined,
						lexeme:    'i',
						content:   'i',
						info:      {}
					},
					vector: {
						type:     RType.BinaryOp,
						flavor:   'arithmetic',
						operator: ':',
						location: rangeFrom(4, 34, 4, 34),
						lexeme:   ':',
						info:     {},
						lhs:      {
							type:     RType.Number,
							location: rangeFrom(4, 33, 4, 33),
							lexeme:   '1',
							content:  numVal(1),
							info:     {}
						},
						rhs: {
							type:     RType.Number,
							location: rangeFrom(4, 35, 4, 36),
							lexeme:   '42',
							content:  numVal(42),
							info:     {}
						}
					},
					body: ensureExpressionList({
						type:     RType.Number,
						location: rangeFrom(6, 25, 6, 25),
						lexeme:   '2',
						content:  numVal(2),
						info:     {}
					})
				})
			},
			{
				step:   DESUGAR_NORMALIZE,
				wanted: exprList({
					type:         RType.FunctionCall,
					location:     rangeFrom(1, 1, 1, 3),
					lexeme:       'for',
					info:         {},
					flavor:       'named',
					functionName: {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 3),
						lexeme:    'for',
						content:   'for',
						namespace: undefined,
						info:      {}
					},
					arguments: [
						{
							type:      RType.Symbol,
							location:  rangeFrom(2, 33, 2, 33),
							lexeme:    'i',
							content:   'i',
							info:      {},
							namespace: undefined
						},
						{
							type:         RType.FunctionCall,
							location:     rangeFrom(4, 34, 4, 34),
							lexeme:       '1:42',
							info:         {},
							flavor:       'named',
							functionName: {
								type: 		   RType.Symbol,
								location: 	rangeFrom(4, 34, 4, 34),
								lexeme: 	  ':',
								content: 	 ':',
								namespace: undefined,
								info: 		   {}
							},
							arguments: [
								{
									type:     RType.Number,
									location: rangeFrom(4, 33, 4, 33),
									lexeme:   '1',
									content:  numVal(1),
									info:     {}
								},
								{
									type:     RType.Number,
									location: rangeFrom(4, 35, 4, 36),
									lexeme:   '42',
									content:  numVal(42),
									info:     {}
								}
							]
						},
						{
							type:     RType.Number,
							location: rangeFrom(6, 25, 6, 25),
							lexeme:   '2',
							content:  numVal(2),
							info:     {}
						}
					]
				})
			}
			], {
				ignoreAdditionalTokens: true
			}
			)
		})
		describe('repeat', () => {
			assertAst('Single instruction repeat', shell, 'repeat 2', exprList({
				type:     RType.RepeatLoop,
				location: rangeFrom(1, 1, 1, 6),
				lexeme:   'repeat',
				info:     {},
				body:     ensureExpressionList({
					type:     RType.Number,
					location: rangeFrom(1, 8, 1, 8),
					lexeme:   '2',
					content:  numVal(2),
					info:     {}
				})
			}), {
				ignoreAdditionalTokens: true
			})
			assertAst('Two statement repeat', shell, 'repeat { x; y }', exprList({
				type:     RType.RepeatLoop,
				location: rangeFrom(1, 1, 1, 6),
				lexeme:   'repeat',
				info:     {},
				body:     {
					type:     RType.ExpressionList,
					location: rangeFrom(1, 8, 1, 15),
					lexeme:   '{ x; y }',
					info:     {},
					children: [{
						type:      RType.Symbol,
						location:  rangeFrom(1, 10, 1, 10),
						namespace: undefined,
						lexeme:    'x',
						content:   'x',
						info:      {},
					}, {
						type:      RType.Symbol,
						location:  rangeFrom(1, 13, 1, 13),
						namespace: undefined,
						lexeme:    'y',
						content:   'y',
						info:      {}
					}]
				}
			}), {
				ignoreAdditionalTokens: true
			})
		})
		describe('while', () => {
			assertAst('while (TRUE) 42', shell, 'while (TRUE) 42', exprList({
				type:      RType.WhileLoop,
				location:  rangeFrom(1, 1, 1, 5),
				lexeme:    'while',
				info:      {},
				condition: {
					type:     RType.Logical,
					location: rangeFrom(1, 8, 1, 11),
					lexeme:   'TRUE',
					content:  true,
					info:     {}
				},
				body: ensureExpressionList({
					type:     RType.Number,
					location: rangeFrom(1, 14, 1, 15),
					lexeme:   '42',
					content:  numVal(42),
					info:     {}
				})
			}), {
				ignoreAdditionalTokens: true
			})

			assertAst('Two statement while', shell, 'while (FALSE) { x; y }', exprList({
				type:      RType.WhileLoop,
				location:  rangeFrom(1, 1, 1, 5),
				lexeme:    'while',
				info:      {},
				condition: {
					type:     RType.Logical,
					location: rangeFrom(1, 8, 1, 12),
					lexeme:   'FALSE',
					content:  false,
					info:     {}
				},
				body: ensureExpressionList({
					type:     RType.ExpressionList,
					location: rangeFrom(1, 15, 1, 22),
					lexeme:   '{ x; y }',
					info:     {},
					children: [{
						type:      RType.Symbol,
						location:  rangeFrom(1, 17, 1, 17),
						namespace: undefined,
						lexeme:    'x',
						content:   'x',
						info:      {}
					}, {
						type:      RType.Symbol,
						location:  rangeFrom(1, 20, 1, 20),
						namespace: undefined,
						lexeme:    'y',
						content:   'y',
						info:      {}
					}]
				})
			}), {
				ignoreAdditionalTokens: true
			})
		})
		describe('break', () => {
			assertAst('while (TRUE) break', shell, 'while (TRUE) break', exprList({
				type:      RType.WhileLoop,
				location:  rangeFrom(1, 1, 1, 5),
				lexeme:    'while',
				info:      {},
				condition: {
					type:     RType.Logical,
					location: rangeFrom(1, 8, 1, 11),
					lexeme:   'TRUE',
					content:  true,
					info:     {}
				},
				body: ensureExpressionList({
					type:     RType.Break,
					location: rangeFrom(1, 14, 1, 18),
					lexeme:   'break',
					info:     {}
				})
			}))
		})
		describe('next', () => {
			assertAst('Next in while', shell, 'while (TRUE) next', exprList({
				type:      RType.WhileLoop,
				location:  rangeFrom(1, 1, 1, 5),
				lexeme:    'while',
				info:      {},
				condition: {
					type:     RType.Logical,
					location: rangeFrom(1, 8, 1, 11),
					lexeme:   'TRUE',
					content:  true,
					info:     {}
				},
				body: ensureExpressionList({
					type:     RType.Next,
					location: rangeFrom(1, 14, 1, 17),
					lexeme:   'next',
					info:     {}
				})
			}))
		})
	})
}))
