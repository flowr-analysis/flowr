import { assertAst, withShell } from '../../../_helper/shell';
import type { Pos } from '../../../_helper/ast-builder';
import { bin, comment, exprList, group, num, parameter, str, sym } from '../../../_helper/ast-builder';
import { label } from '../../../_helper/label';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import type { RNode } from '../../../../../src/r-bridge/lang-4.x/ast/model/model';
import type { RComment } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-comment';
import type { RParameter } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { describe } from 'vitest';
import { SourceRange } from '../../../../../src/util/range';

/** `function(...) { children }` starting at the beginning of the first line, with the braces at `open` and `close` */
function fn(parameters: RParameter[], open: Pos, close: Pos, children: RNode[] = [], adToks?: RComment[]): RNode {
	return {
		type:     RType.FunctionDefinition,
		location: SourceRange.from(1, 1, 1, 8),
		lexeme:   'function',
		parameters,
		body:     group('{', open, close, ...children),
		info:     adToks ? { adToks } : {}
	};
}

const p = (name: string, col: number, defaultValue?: RNode) => parameter(name, SourceRange.from(1, col, 1, col + name.length - 1), defaultValue);
const dots = (col: number) => parameter('...', SourceRange.from(1, col, 1, col + 2), undefined, true);

describe('Parse function definitions', { concurrent: false }, withShell(shell => {
	const opts = { ignoreAdToks: true };
	describe('without parameters', () => {
		assertAst(label('Noop', ['normal-definition', 'grouping']),
			shell, 'function() { }', exprList(fn([], [1, 12], [1, 14])), opts);
		assertAst(label('No Args', ['normal-definition', 'name-normal', 'numbers', 'grouping', ...OperatorDatabase['+'].capabilities, ...OperatorDatabase['*'].capabilities]),
			shell, 'function() { x + 2 * 3 }', exprList(fn([], [1, 12], [1, 24], [
				bin('+', [1, 16], sym('x', [1, 14]), bin('*', [1, 20], num('2', [1, 18]), num('3', [1, 22])))
			])), opts);
	});
	describe('with unnamed parameters', () => {
		assertAst(label('Multiple parameters', ['normal-definition', 'name-normal', 'formals-named', 'grouping']),
			shell, 'function(a,the,b) { b }', exprList(fn([p('a', 10), p('the', 12), p('b', 16)], [1, 19], [1, 23], [sym('b', [1, 21])])), opts);
	});
	assertAst(label('With comments in parameter', ['normal-definition', 'comments', 'grouping']),
		shell, 'function(x=3, # hehehe\n  foo) { }',
		exprList(fn([p('x', 10, num('3', [1, 12])), parameter('foo', SourceRange.from(2, 3, 2, 5))], [2, 8], [2, 10], [], [comment('# hehehe', [1, 15])])),
		{ ignoreAdToks: false }
	);
	describe('With Special Parameters (...)', () => {
		assertAst(label('As first arg', ['normal-definition', 'formals-dot-dot-dot', 'grouping', 'formals-named']),
			shell, 'function(..., a) { }', exprList(fn([dots(10), p('a', 15)], [1, 18], [1, 20])), opts);
		assertAst(label('As last arg', ['normal-definition', 'formals-dot-dot-dot', 'grouping', 'formals-named', 'name-normal']),
			shell, 'function(a, the, ...) { ... }', exprList(fn([p('a', 10), p('the', 13), dots(18)], [1, 23], [1, 29], [sym('...', [1, 25])])), opts);
	});
	describe('With Named Parameters', () => {
		assertAst(label('Multiple Parameter', ['normal-definition', 'formals-named', 'formals-default', 'grouping', 'name-normal', 'numbers', 'strings']),
			shell, 'function(a, x=3, huhu="hehe") { x }', exprList(fn([
				p('a', 10), p('x', 13, num('3', [1, 15])), p('huhu', 18, str('"hehe"', [1, 23], 'hehe'))
			], [1, 31], [1, 35], [sym('x', [1, 33])])), opts);
	});
}));
