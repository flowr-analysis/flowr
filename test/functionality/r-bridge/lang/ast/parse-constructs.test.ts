import { assertAst, withShell } from '../../../_helper/shell';
import { exprList, numVal } from '../../../_helper/ast-builder';
import { SourceRange } from '../../../../../src/util/range';
import { label } from '../../../_helper/label';
import type { SupportedFlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
import type { RNode } from '../../../../../src/r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import type { RExpressionList } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { ensureExpressionList } from '../../../../../src/r-bridge/lang-4.x/ast/parser/main/normalize-meta';
import { describe } from 'vitest';

interface IfThenSpacing {
	str:          string
	locationTrue: ReturnType<typeof SourceRange.from>
	then:         RNode
	num:          number,
	locationNum:  ReturnType<typeof SourceRange.from>
	end:          ReturnType<typeof SourceRange.from>
	/* yes, we could give them just once, but if we ever want to modify the list this is more flexible */
	capabilities: SupportedFlowrCapabilityId[]
}

const IfThenSpacingVariants: IfThenSpacing[] = [
	{
		str:          'if(TRUE)1',
		locationTrue: SourceRange.from(1, 4, 1, 7),
		then:         { type: RType.Number, location: SourceRange.from(1, 9, 1, 9), lexeme: '1', content: numVal(1), info: {} },
		num:          1,
		locationNum:  SourceRange.from(1, 9, 1, 9),
		end:          SourceRange.from(1, 9, 1, 9),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if(TRUE) 1',
		locationTrue: SourceRange.from(1, 4, 1, 7),
		then:         { type: RType.Number, location: SourceRange.from(1, 10, 1, 10), lexeme: '1', content: numVal(1), info: {} },
		num:          1,
		locationNum:  SourceRange.from(1, 10, 1, 10),
		end:          SourceRange.from(1, 10, 1, 10),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if (TRUE) 1',
		locationTrue: SourceRange.from(1, 5, 1, 8),
		num:          1,
		locationNum:  SourceRange.from(1, 11, 1, 11),
		then:         { type: RType.Number, location: SourceRange.from(1, 11, 1, 11), lexeme: '1', content: numVal(1), info: {} },
		end:          SourceRange.from(1, 11, 1, 11),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if     (TRUE)  42',
		locationTrue: SourceRange.from(1, 9, 1, 12),
		num:          42,
		locationNum:  SourceRange.from(1, 16, 1, 17),
		then:         { type: RType.Number, location: SourceRange.from(1, 16, 1, 17), lexeme: '42', content: numVal(42), info: {} },
		end:          SourceRange.from(1, 17, 1, 17),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if\n(TRUE)1',
		locationTrue: SourceRange.from(2, 2, 2, 5),
		num:          1,
		locationNum:  SourceRange.from(2, 7, 2, 7),
		then:         { type: RType.Number, location: SourceRange.from(2, 7, 2, 7), lexeme: '1', content: numVal(1), info: {} },
		end:          SourceRange.from(2, 7, 2, 7),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if(TRUE)\n1',
		locationTrue: SourceRange.from(1, 4, 1, 7),
		num:          1,
		locationNum:  SourceRange.from(2, 1, 2, 1),
		then:         { type: RType.Number, location: SourceRange.from(2, 1, 2, 1), lexeme: '1', content: numVal(1), info: {} },
		end:          SourceRange.from(2, 1, 2, 1),
		capabilities: ['if', 'logical', 'numbers']
	},
	{
		str:          'if\n(\nTRUE\n)\n1',
		locationTrue: SourceRange.from(3, 1, 3, 4),
		num:          1,
		locationNum:  SourceRange.from(5, 1, 5, 1),
		then:         { type: RType.Number, location: SourceRange.from(5, 1, 5, 1), lexeme: '1', content: numVal(1), info: {} },
		end:          SourceRange.from(5, 1, 5, 1),
		capabilities: ['if', 'logical', 'numbers']
	},
];

function inBrace(start: SourceRange, end: SourceRange, content: RNode): RExpressionList {
	return {
		type:     RType.ExpressionList,
		location: undefined,
		lexeme:   undefined,
		info:     {},
		grouping: [{
			type:     RType.Symbol,
			lexeme:   '{',
			content:  '{',
			info:     {},
			location: start
		}, {
			type:     RType.Symbol,
			lexeme:   '}',
			content:  '}',
			info:     {},
			location: end
		}],
		children: [content]
	};
}

const IfThenBraceVariants: IfThenSpacing[] = [{
	str:          'if(TRUE){1}',
	locationTrue: SourceRange.from(1, 4, 1, 7),
	num:          1,
	locationNum:  SourceRange.from(1, 10, 1, 10),
	then:         inBrace(SourceRange.from(1, 9, 1, 9), SourceRange.from(1, 11, 1, 11), { type: RType.Number, location: SourceRange.from(1, 10, 1, 10), lexeme: '1', content: numVal(1), info: {} }),
	end:          SourceRange.from(1, 11, 1, 11),
	capabilities: ['if', 'logical', 'numbers', 'grouping']
}, {
	str:          'if(TRUE){42}',
	locationTrue: SourceRange.from(1, 4, 1, 7),
	locationNum:  SourceRange.from(1, 10, 1, 11),
	then:         inBrace(SourceRange.from(1, 9, 1, 9), SourceRange.from(1, 12, 1, 12), { type: RType.Number, location: SourceRange.from(1, 10, 1, 11), lexeme: '42', content: numVal(42), info: {} }),
	num:          42,
	end:          SourceRange.from(1, 12, 1, 12),
	capabilities: ['if', 'logical', 'numbers', 'grouping']
}, {
	str:          'if(TRUE){{{1}}}',
	locationTrue: SourceRange.from(1, 4, 1, 7),
	locationNum:  SourceRange.from(1, 12, 1, 12),
	then:         inBrace(SourceRange.from(1, 9, 1, 9), SourceRange.from(1, 15, 1, 15),
		inBrace(SourceRange.from(1, 10, 1, 10), SourceRange.from(1, 14, 1, 14),
			inBrace(SourceRange.from(1, 11, 1, 11), SourceRange.from(1, 13, 1, 13),
				{ type: RType.Number, location: SourceRange.from(1, 12, 1, 12), lexeme: '1', content: numVal(1), info: {} }
			)
		)
	),
	num:          1,
	end:          SourceRange.from(1, 15, 1, 15),
	capabilities: ['if', 'logical', 'numbers', 'grouping']
}];

interface ElseSpacing {
	str:          string
	locationElse: ReturnType<typeof SourceRange.from>
	otherwise:    (offset: SourceRange) => RNode,
	num:          number,
	capabilities: SupportedFlowrCapabilityId[]
}

// suffix of if-then counterparts
const ElseSpacingVariants: ElseSpacing[] = [{
	/* one space/newline around is the minimum for R */
	str:          ' else 2',
	locationElse: SourceRange.from(0, 7, 0, 7),
	num:          2,
	otherwise:    off => ({ type: RType.Number, location: SourceRange.add(off, SourceRange.from(0, 7, 0, 7)), lexeme: '2', content: numVal(2), info: {} }),
	capabilities: ['if', 'numbers']
}, {
	str:          ' else  9',
	locationElse: SourceRange.from(0, 8, 0, 8),
	num:          9,
	otherwise:    off => ({ type: RType.Number, location: SourceRange.add(off, SourceRange.from(0, 8, 0, 8)), lexeme: '9', content: numVal(9), info: {} }),
	capabilities: ['if', 'numbers']
}];

const ElseGroupingVariants: ElseSpacing[] = [{
	str:          ' else {2}',
	locationElse: SourceRange.from(0, 8, 0, 8),
	otherwise:    off => inBrace(
		SourceRange.add(off, SourceRange.from(0, 7, 0, 7)), SourceRange.add(off, SourceRange.from(0, 9, 0, 9)),
		{ type: RType.Number, location: SourceRange.add(off, SourceRange.from(0, 8, 0, 8)), lexeme: '2', content: numVal(2), info: {} }
	),
	num:          2,
	capabilities: ['if', 'numbers', 'grouping']
}, {
	str:          ' else {{{42}}}',
	locationElse: SourceRange.from(0, 10, 0, 11),
	otherwise:    off => inBrace(SourceRange.add(off, SourceRange.from(0, 7, 0, 7)), SourceRange.add(off, SourceRange.from(0, 14, 0, 14)),
		inBrace(SourceRange.add(off, SourceRange.from(0, 8, 0, 8)), SourceRange.add(off, SourceRange.from(0, 13, 0, 13)),
			inBrace(SourceRange.add(off, SourceRange.from(0, 9, 0, 9)), SourceRange.add(off, SourceRange.from(0, 12, 0, 12)),
				{ type: RType.Number, location: SourceRange.add(off, SourceRange.from(0, 10, 0, 11)), lexeme: '42', content: numVal(42), info: {} }
			)
		)
	),
	num:          42,
	capabilities: ['if', 'numbers', 'grouping']
}];

describe.sequential('Parse simple constructs', withShell(shell => {
	describe('if', () => {
		describe('if-then', () => {
			for(const pool of [{ name: 'grouping', variants: IfThenBraceVariants }, {
				name:     'spacing',
				variants: IfThenSpacingVariants
			}]) {
				describe(`${pool.name} variants`, () => {
					for(const variant of pool.variants) {
						assertAst(label(JSON.stringify(variant.str), variant.capabilities), shell, variant.str, exprList({
							type:      RType.IfThenElse,
							location:  SourceRange.from(1, 1, 1, 2),
							lexeme:    'if',
							info:      {},
							condition: {
								type:     RType.Logical,
								location: variant.locationTrue,
								lexeme:   'TRUE',
								content:  true,
								info:     {}
							},
							then: ensureExpressionList(variant.then)
						}), {
							ignoreAdToks: true
						});
					}
				});
			}
		});
		describe('If-Then-Comment', () => {
			assertAst(label('if-then with comment', ['if', 'logical', 'numbers', 'comments', 'newlines']), shell,
				`if (u) # comment
{
    x
}`,
				exprList({
					type:     RType.IfThenElse,
					location: SourceRange.from(1, 1, 1, 2),
					lexeme:   'if',
					info:     {
						adToks: [{
							type:     RType.Comment,
							lexeme:   '# comment',
							info:     {},
							location: SourceRange.from(1, 8, 1, 16)
						}]
					},
					condition: {
						type:     RType.Symbol,
						location: SourceRange.from(1, 5, 1, 5),
						lexeme:   'u',
						content:  'u',
						info:     {}
					},
					then: {
						type:     RType.ExpressionList,
						location: undefined,
						lexeme:   undefined,
						info:     {},
						grouping: [{
							type:     RType.Symbol,
							lexeme:   '{',
							content:  '{',
							info:     {},
							location: SourceRange.from(2, 1, 2, 1)
						}, {
							type:     RType.Symbol,
							lexeme:   '}',
							content:  '}',
							info:     {},
							location: SourceRange.from(4, 1, 4, 1)
						}],
						children: [{
							type:     RType.Symbol,
							location: SourceRange.from(3, 5, 3, 5),
							lexeme:   'x',
							content:  'x',
							info:     {}
						}]
					},
					otherwise: undefined
				}));
		});
		describe('if-then-else', () => {
			for(const elsePool of [{ name: 'grouping', variants: ElseGroupingVariants }, {
				name:     'spacing',
				variants: ElseSpacingVariants
			}]) {
				for(const ifThenPool of [{ name: 'grouping', variants: IfThenBraceVariants }, {
					name:     'spacing',
					variants: IfThenSpacingVariants
				}]) {
					describe(`if-then: ${ifThenPool.name}, else: ${elsePool.name}`, () => {
						for(const elseVariant of elsePool.variants) {
							for(const ifThenVariant of ifThenPool.variants) {
								const input = `${ifThenVariant.str}${elseVariant.str}`;
								assertAst(label(JSON.stringify(input), [...ifThenVariant.capabilities, ...elseVariant.capabilities]), shell, input, exprList({
									type:      RType.IfThenElse,
									location:  SourceRange.from(1, 1, 1, 2),
									lexeme:    'if',
									info:      {},
									condition: {
										type:     RType.Logical,
										location: ifThenVariant.locationTrue,
										lexeme:   'TRUE',
										content:  true,
										info:     {}
									},
									then:      ensureExpressionList(ifThenVariant.then),
									otherwise: ensureExpressionList(elseVariant.otherwise(ifThenVariant.end))
								}), {
									ignoreAdToks: true
								});
							}
						}
					});
				}
			}
		});
	});
	describe('loops', () => {
		describe('for', () => {
			assertAst(label('for(i in 1:10) 2', ['for-loop', 'name-normal', 'numbers']), shell, 'for(i in 1:42)2',
				exprList({
					type:     RType.ForLoop,
					location: SourceRange.from(1, 1, 1, 3),
					lexeme:   'for',
					info:     {},
					variable: {
						type:     RType.Symbol,
						location: SourceRange.from(1, 5, 1, 5),
						lexeme:   'i',
						content:  'i',
						info:     {}
					},
					vector: {
						type:     RType.BinaryOp,
						operator: ':',
						location: SourceRange.from(1, 11, 1, 11),
						lexeme:   ':',
						info:     {},
						lhs:      {
							type:     RType.Number,
							location: SourceRange.from(1, 10, 1, 10),
							lexeme:   '1',
							content:  numVal(1),
							info:     {}
						},
						rhs: {
							type:     RType.Number,
							location: SourceRange.from(1, 12, 1, 13),
							lexeme:   '42',
							content:  numVal(42),
							info:     {}
						}
					},
					body: ensureExpressionList({
						type:     RType.Number,
						location: SourceRange.from(1, 15, 1, 15),
						lexeme:   '2',
						content:  numVal(2),
						info:     {}
					})
				}), {
					ignoreAdToks: true
				}
			);
			assertAst(label('for-loop with comment', ['for-loop', 'name-normal', 'numbers', 'comments', 'newlines']), shell, `for(#a
				i#b
				in#c
				1:42#d
			) # lol
			2`, exprList({
				type:     RType.ForLoop,
				location: SourceRange.from(1, 1, 1, 3),
				lexeme:   'for',
				info:     {},
				variable: {
					type:     RType.Symbol,
					location: SourceRange.from(2, 33, 2, 33),
					lexeme:   'i',
					content:  'i',
					info:     {}
				},
				vector: {
					type:     RType.BinaryOp,
					operator: ':',
					location: SourceRange.from(4, 34, 4, 34),
					lexeme:   ':',
					info:     {},
					lhs:      {
						type:     RType.Number,
						location: SourceRange.from(4, 33, 4, 33),
						lexeme:   '1',
						content:  numVal(1),
						info:     {}
					},
					rhs: {
						type:     RType.Number,
						location: SourceRange.from(4, 35, 4, 36),
						lexeme:   '42',
						content:  numVal(42),
						info:     {}
					}
				},
				body: ensureExpressionList({
					type:     RType.Number,
					location: SourceRange.from(6, 25, 6, 25),
					lexeme:   '2',
					content:  numVal(2),
					info:     {}
				})
			}), {
				ignoreAdToks:  true,
				ignoreColumns: true
			}
			);
		});
		describe('repeat', () => {
			assertAst(label('Single instruction repeat', ['repeat-loop', 'numbers']),
				shell, 'repeat 2', exprList({
					type:     RType.RepeatLoop,
					location: SourceRange.from(1, 1, 1, 6),
					lexeme:   'repeat',
					info:     {},
					body:     ensureExpressionList({
						type:     RType.Number,
						location: SourceRange.from(1, 8, 1, 8),
						lexeme:   '2',
						content:  numVal(2),
						info:     {}
					})
				}), {
					ignoreAdToks: true
				});
			assertAst(label('Two Statement Repeat', ['repeat-loop', 'numbers', 'grouping', 'semicolons']),
				shell, 'repeat { x; y }', exprList({
					type:     RType.RepeatLoop,
					location: SourceRange.from(1, 1, 1, 6),
					lexeme:   'repeat',
					info:     {},
					body:     {
						type:     RType.ExpressionList,
						location: undefined,
						lexeme:   undefined,
						grouping: [{
							type:     RType.Symbol,
							lexeme:   '{',
							content:  '{',
							info:     {},
							location: SourceRange.from(1, 8, 1, 8)
						}, {
							type:     RType.Symbol,
							lexeme:   '}',
							content:  '}',
							info:     {},
							location: SourceRange.from(1, 15, 1, 15)
						}],
						info:     {},
						children: [{
							type:     RType.Symbol,
							location: SourceRange.from(1, 10, 1, 10),
							lexeme:   'x',
							content:  'x',
							info:     {},
						}, {
							type:     RType.Symbol,
							location: SourceRange.from(1, 13, 1, 13),
							lexeme:   'y',
							content:  'y',
							info:     {}
						}]
					}
				}), {
					ignoreAdToks: true
				});
		});
		describe('while', () => {
			assertAst(label('while (TRUE) 42', ['while-loop', 'logical', 'numbers']),
				shell, 'while (TRUE) 42', exprList({
					type:      RType.WhileLoop,
					location:  SourceRange.from(1, 1, 1, 5),
					lexeme:    'while',
					info:      {},
					condition: {
						type:     RType.Logical,
						location: SourceRange.from(1, 8, 1, 11),
						lexeme:   'TRUE',
						content:  true,
						info:     {}
					},
					body: ensureExpressionList({
						type:     RType.Number,
						location: SourceRange.from(1, 14, 1, 15),
						lexeme:   '42',
						content:  numVal(42),
						info:     {}
					})
				}), {
					ignoreAdToks: true
				});

			assertAst(label('Two statement while', ['while-loop', 'logical', 'grouping', 'semicolons']),
				shell, 'while (FALSE) { x; y }', exprList({
					type:      RType.WhileLoop,
					location:  SourceRange.from(1, 1, 1, 5),
					lexeme:    'while',
					info:      {},
					condition: {
						type:     RType.Logical,
						location: SourceRange.from(1, 8, 1, 12),
						lexeme:   'FALSE',
						content:  false,
						info:     {}
					},
					body: {
						type:     RType.ExpressionList,
						location: undefined,
						lexeme:   undefined,
						grouping: [{
							type:     RType.Symbol,
							lexeme:   '{',
							content:  '{',
							info:     {},
							location: SourceRange.from(1, 15, 1, 15)
						}, {
							type:     RType.Symbol,
							lexeme:   '}',
							content:  '}',
							info:     {},
							location: SourceRange.from(1, 22, 1, 22)
						}],
						info:     {},
						children: [{
							type:     RType.Symbol,
							location: SourceRange.from(1, 17, 1, 17),
							lexeme:   'x',
							content:  'x',
							info:     {}
						}, {
							type:     RType.Symbol,
							location: SourceRange.from(1, 20, 1, 20),
							lexeme:   'y',
							content:  'y',
							info:     {}
						}]
					}
				}), {
					ignoreAdToks: true
				});
		});
		describe('break', () => {
			assertAst(label('while (TRUE) break', ['while-loop', 'logical', 'break']),
				shell, 'while (TRUE) break', exprList({
					type:      RType.WhileLoop,
					location:  SourceRange.from(1, 1, 1, 5),
					lexeme:    'while',
					info:      {},
					condition: {
						type:     RType.Logical,
						location: SourceRange.from(1, 8, 1, 11),
						lexeme:   'TRUE',
						content:  true,
						info:     {}
					},
					body: ensureExpressionList({
						type:     RType.Break,
						location: SourceRange.from(1, 14, 1, 18),
						lexeme:   'break',
						info:     {}
					})
				})
			);
		});
		describe('next', () => {
			assertAst(label('Next in while', ['while-loop', 'next']),
				shell, 'while (TRUE) next', exprList({
					type:      RType.WhileLoop,
					location:  SourceRange.from(1, 1, 1, 5),
					lexeme:    'while',
					info:      {},
					condition: {
						type:     RType.Logical,
						location: SourceRange.from(1, 8, 1, 11),
						lexeme:   'TRUE',
						content:  true,
						info:     {}
					},
					body: ensureExpressionList({
						type:     RType.Next,
						location: SourceRange.from(1, 14, 1, 17),
						lexeme:   'next',
						info:     {}
					})
				})
			);
		});
	});
}));
