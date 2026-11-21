import { assertAst, withShell } from '../../../_helper/shell';
import { arg, call, callExpr, comment, exprList, group, num, parameter, sym } from '../../../_helper/ast-builder';
import { label } from '../../../_helper/label';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import { EmptyArgument } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { describe } from 'vitest';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';
import { SourceRange } from '../../../../../src/util/range';

describe('Parse function calls', { concurrent: false }, withShell(shell => {
	const f = sym('f', [1, 1]);
	describe('functions without arguments', () => {
		assertAst(label('f()', ['call-normal', 'name-normal']), shell, 'f()', exprList(call(f)));
	});
	describe('functions with arguments', () => {
		assertAst(label('f(1, 2)', ['name-normal', 'call-normal', 'unnamed-arguments', 'numbers']),
			shell, 'f(1, 2)', exprList(call(f, [arg(num('1', [1, 3])), arg(num('2', [1, 6]))]))
		);
		assertAst(label('f(1,)', ['name-normal', 'call-normal', 'unnamed-arguments', 'numbers', 'empty-arguments']),
			shell, 'f(1,)', exprList(call(f, [arg(num('1', [1, 3])), EmptyArgument]))
		);
	});
	describe('functions with named arguments', () => {
		assertAst(label('f(x=)', ['name-normal', 'call-normal', 'named-arguments']),
			shell, 'f(x=)', exprList(call(f, [arg(undefined, sym('x', [1, 3]))]))
		);
		assertAst(label('f(x=1) with comment', ['name-normal', 'call-normal', 'named-arguments']),
			shell, 'f(x= # comment\n1)',
			exprList(call(f, [arg(num('1', [2, 1]), sym('x', [1, 3]))], { adToks: [comment('# comment', [1, 6])] })),
			{ skipTreeSitter: true }
		);
		assertAst(label('f(1, x=2, 4, y=3)', ['name-normal', 'call-normal', 'unnamed-arguments', 'named-arguments', 'numbers']),
			shell, 'f(1, x=2, 4, y=3)', exprList(call(f, [
				arg(num('1', [1, 3])),
				arg(num('2', [1, 8]), sym('x', [1, 6])),
				arg(num('4', [1, 11])),
				arg(num('3', [1, 16]), sym('y', [1, 14]))
			]))
		);
		for(const quote of ['"', "'", '`']) {
			describe(`Escaped Arguments Using Quote ${quote}`, () => {
				// plain and with characters that would be syntax outside of the quotes
				for(const name of ['a', 'a b(1)']) {
					const lexeme = `${quote}${name}${quote}`;
					assertAst(label(name, ['name-normal', 'call-normal', 'string-arguments', 'strings']),
						shell, `f(${lexeme}=3)`,
						exprList(call(f, [arg(num('3', [1, 4 + lexeme.length]), sym(lexeme, [1, 3], name))]))
					);
				}
			});
		}
	});
	describe('directly called functions', () => {
		assertAst(label('Directly call with 2', ['call-anonymous', 'formals-named', 'numbers', 'name-normal', 'normal-definition', 'grouping']),
			shell, '(function(x) { x })(2)', exprList(callExpr(
				group('(', [1, 1], [1, 19], {
					type:       RType.FunctionDefinition,
					location:   SourceRange.from(1, 2, 1, 9),
					lexeme:     'function',
					parameters: [parameter('x', SourceRange.from(1, 11, 1, 11))],
					body:       group('{', [1, 14], [1, 18], sym('x', [1, 16])),
					info:       {}
				}),
				[arg(num('2', [1, 21]))], SourceRange.from(1, 1, 1, 19), '(function(x) { x })'
			)), { ignoreAdToks: true }
		);
		assertAst(label('Double call with only the second one being direct', ['call-anonymous', 'numbers', 'name-normal', 'normal-definition']),
			shell, 'a(1)(2)', exprList(callExpr(
				call(sym('a', [1, 1]), [arg(num('1', [1, 3]))]),
				[arg(num('2', [1, 6]))], SourceRange.from(1, 1, 1, 4), 'a(1)'
			))
		);
	});
	describe('functions with explicit namespacing', () => {
		assertAst(label('x::f()', ['name-normal', 'call-normal', 'accessing-exported-names']),
			shell, 'x::f()', exprList(call(sym('f', [1, 4], Identifier.make('f', 'x')), [], { lexeme: 'x::f', location: SourceRange.from(1, 1, 1, 4) }))
		);
	});
	describe('functions which are called as string', () => {
		assertAst(label("'f'()", ['name-quoted', 'call-normal']),
			shell, "'f'()", exprList(call(sym("'f'", [1, 1], 'f')))
		);
	});
	describe('Intermixing Comments', () => {
		assertAst(label('comment interspersed in arglist', ['name-normal', 'call-normal', 'numbers', 'comments']),
			shell, 'data.frame(A = 1, # this is a comment\n                B = 2)',
			exprList(call(sym('data.frame', [1, 1]), [
				arg(num('1', [1, 16]), sym('A', [1, 12])),
				arg(num('2', [2, 21]), sym('B', [2, 17]))
			], { adToks: [comment('# this is a comment', [1, 19])] }))
		);
	});
	describe('Next and break as functions', () => {
		assertAst(label('next()', ['name-normal', 'call-normal', 'next']),
			shell, 'next()', exprList({ type: RType.Next, location: SourceRange.from(1, 1, 1, 4), lexeme: 'next', info: {} })
		);
		assertAst(label('break()', ['name-normal', 'call-normal', 'break']),
			shell, 'break()', exprList({ type: RType.Break, location: SourceRange.from(1, 1, 1, 5), lexeme: 'break', info: {} })
		);
	});
}));
