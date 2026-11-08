import { assertAst, withShell } from '../../../_helper/shell';
import type { Pos } from '../../../_helper/ast-builder';
import { bin, comment, exprList, group, lgl, num, sym } from '../../../_helper/ast-builder';
import { SourceRange } from '../../../../../src/util/range';
import { label } from '../../../_helper/label';
import type { FlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
import type { RNode } from '../../../../../src/r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import { ensureExpressionList } from '../../../../../src/r-bridge/lang-4.x/ast/parser/main/normalize-meta';
import { describe } from 'vitest';

interface IfThen {
	readonly str:          string
	readonly locationTrue: Pos
	readonly then:         RNode
	/** where the then-branch ends, the else-branch is placed relative to it */
	readonly end:          readonly [line: number, col: number]
	readonly capabilities: FlowrCapabilityId[]
}

const spacing = (str: string, locationTrue: Pos, then: RNode): IfThen => ({ str, locationTrue, then, end: [(then as { location: SourceRange }).location[2], (then as { location: SourceRange }).location[3]], capabilities: ['if', 'logical', 'numbers'] });
const braced = (str: string, then: RNode, end: Pos): IfThen => ({ str, locationTrue: [1, 4], then, end: [end[0], end[1]], capabilities: ['if', 'logical', 'numbers', 'grouping'] });

// whitespace and newlines around the condition and the branch move the locations
const IfThenSpacingVariants: IfThen[] = [
	spacing('if(TRUE)1', [1, 4], num('1', [1, 9])),
	spacing('if     (TRUE)  42', [1, 9], num('42', [1, 16])),
	spacing('if(TRUE)\n1', [1, 4], num('1', [2, 1])),
	spacing('if\n(\nTRUE\n)\n1', [3, 1], num('1', [5, 1])),
];

const IfThenBraceVariants: IfThen[] = [
	braced('if(TRUE){1}', group('{', [1, 9], [1, 11], num('1', [1, 10])), [1, 11]),
	braced('if(TRUE){{{1}}}', group('{', [1, 9], [1, 15], group('{', [1, 10], [1, 14], group('{', [1, 11], [1, 13], num('1', [1, 12])))), [1, 15]),
];

interface Else {
	readonly str:          string
	readonly otherwise:    (line: number, col: number) => RNode
	readonly capabilities: FlowrCapabilityId[]
}

// one space/newline around is the minimum for R
const ElseSpacingVariants: Else[] = [{
	str:          ' else 2',
	otherwise:    (l, c) => num('2', [l, c + 7]),
	capabilities: ['if', 'numbers']
}];

const ElseGroupingVariants: Else[] = [{
	str:          ' else {{{42}}}',
	otherwise:    (l, c) => group('{', [l, c + 7], [l, c + 14], group('{', [l, c + 8], [l, c + 13], group('{', [l, c + 9], [l, c + 12], num('42', [l, c + 10])))),
	capabilities: ['if', 'numbers', 'grouping']
}];

const ifNode = (fields: Partial<Record<string, unknown>>) => ({ type: RType.IfThenElse, location: SourceRange.from(1, 1, 1, 2), lexeme: 'if', info: {}, ...fields }) as RNode;

describe('Parse simple constructs', { concurrent: false }, withShell(shell => {
	describe('if', () => {
		describe('if-then', () => {
			for(const pool of [{ name: 'grouping', variants: IfThenBraceVariants }, { name: 'spacing', variants: IfThenSpacingVariants }]) {
				describe(`${pool.name} variants`, () => {
					for(const v of pool.variants) {
						assertAst(label(JSON.stringify(v.str), v.capabilities), shell, v.str, exprList(ifNode({
							condition: lgl('TRUE', v.locationTrue),
							then:      ensureExpressionList(v.then)
						})), { ignoreAdToks: true });
					}
				});
			}
		});
		describe('If-Then-Comment', () => {
			assertAst(label('if-then with comment', ['if', 'logical', 'numbers', 'comments', 'newlines']), shell,
				'if (u) # comment\n{\n    x\n}',
				exprList(ifNode({
					info:      { adToks: [comment('# comment', [1, 8])] },
					condition: sym('u', [1, 5]),
					then:      group('{', [2, 1], [4, 1], sym('x', [3, 5])),
					otherwise: undefined
				})));
		});
		describe('if-then-else', () => {
			for(const [thens, elses] of [[IfThenSpacingVariants, ElseSpacingVariants], [IfThenBraceVariants, ElseGroupingVariants]]) {
				for(const e of elses as Else[]) {
					for(const t of thens as IfThen[]) {
						const input = `${t.str}${e.str}`;
						assertAst(label(JSON.stringify(input), [...t.capabilities, ...e.capabilities]), shell, input, exprList(ifNode({
							condition: lgl('TRUE', t.locationTrue),
							then:      ensureExpressionList(t.then),
							otherwise: ensureExpressionList(e.otherwise(...t.end))
						})), { ignoreAdToks: true });
					}
				}
			}
			// the else-branch may be braced while the then-branch is not and vice versa
			assertAst(label('if(TRUE)1 else {{{42}}}', ['if', 'numbers', 'grouping']), shell, `${IfThenSpacingVariants[0].str}${ElseGroupingVariants[0].str}`, exprList(ifNode({
				condition: lgl('TRUE', [1, 4]),
				then:      ensureExpressionList(IfThenSpacingVariants[0].then),
				otherwise: ensureExpressionList(ElseGroupingVariants[0].otherwise(1, 9))
			})), { ignoreAdToks: true });
			assertAst(label('if(TRUE){1} else 2', ['if', 'numbers', 'grouping']), shell, `${IfThenBraceVariants[0].str}${ElseSpacingVariants[0].str}`, exprList(ifNode({
				condition: lgl('TRUE', [1, 4]),
				then:      ensureExpressionList(IfThenBraceVariants[0].then),
				otherwise: ensureExpressionList(ElseSpacingVariants[0].otherwise(1, 11))
			})), { ignoreAdToks: true });
		});
	});
	describe('loops', () => {
		describe('for', () => {
			const forNode = (variable: RNode, vector: RNode, body: RNode) => ({ type: RType.ForLoop, location: SourceRange.from(1, 1, 1, 3), lexeme: 'for', info: {}, variable, vector, body: ensureExpressionList(body) }) as RNode;
			assertAst(label('for(i in 1:10) 2', ['for-loop', 'name-normal', 'numbers']), shell, 'for(i in 1:42)2',
				exprList(forNode(sym('i', [1, 5]), bin(':', [1, 11], num('1', [1, 10]), num('42', [1, 12])), num('2', [1, 15]))),
				{ ignoreAdToks: true }
			);
			assertAst(label('for-loop with comment', ['for-loop', 'name-normal', 'numbers', 'comments', 'newlines']), shell,
				'for(#a\n\t\t\t\ti#b\n\t\t\t\tin#c\n\t\t\t\t1:42#d\n\t\t\t) # lol\n\t\t\t2',
				exprList(forNode(sym('i', [2, 33]), bin(':', [4, 34], num('1', [4, 33]), num('42', [4, 35])), num('2', [6, 25]))),
				{ ignoreAdToks: true, ignoreColumns: true }
			);
		});
		describe('repeat', () => {
			const repeat = (body: RNode) => ({ type: RType.RepeatLoop, location: SourceRange.from(1, 1, 1, 6), lexeme: 'repeat', info: {}, body: ensureExpressionList(body) }) as RNode;
			assertAst(label('Single instruction repeat', ['repeat-loop', 'numbers']),
				shell, 'repeat 2', exprList(repeat(num('2', [1, 8]))), { ignoreAdToks: true });
			assertAst(label('Two Statement Repeat', ['repeat-loop', 'numbers', 'grouping', 'semicolons']),
				shell, 'repeat { x; y }', exprList(repeat(group('{', [1, 8], [1, 15], sym('x', [1, 10]), sym('y', [1, 13])))), { ignoreAdToks: true });
		});
		describe('while', () => {
			const whileLoop = (condition: RNode, body: RNode) => ({ type: RType.WhileLoop, location: SourceRange.from(1, 1, 1, 5), lexeme: 'while', info: {}, condition, body: ensureExpressionList(body) }) as RNode;
			assertAst(label('while (TRUE) 42', ['while-loop', 'logical', 'numbers']),
				shell, 'while (TRUE) 42', exprList(whileLoop(lgl('TRUE', [1, 8]), num('42', [1, 14]))), { ignoreAdToks: true });
			assertAst(label('Two statement while', ['while-loop', 'logical', 'grouping', 'semicolons']),
				shell, 'while (FALSE) { x; y }', exprList(whileLoop(lgl('FALSE', [1, 8]), group('{', [1, 15], [1, 22], sym('x', [1, 17]), sym('y', [1, 20])))), { ignoreAdToks: true });
			assertAst(label('while (TRUE) break', ['while-loop', 'logical', 'break']),
				shell, 'while (TRUE) break', exprList(whileLoop(lgl('TRUE', [1, 8]), { type: RType.Break, location: SourceRange.from(1, 14, 1, 18), lexeme: 'break', info: {} })));
			assertAst(label('Next in while', ['while-loop', 'next']),
				shell, 'while (TRUE) next', exprList(whileLoop(lgl('TRUE', [1, 8]), { type: RType.Next, location: SourceRange.from(1, 14, 1, 17), lexeme: 'next', info: {} })));
		});
	});
}));
