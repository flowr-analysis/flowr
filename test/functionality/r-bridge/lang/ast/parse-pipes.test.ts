import { assertAst, withShell } from '../../../_helper/shell';
import { arg, call, callExpr, exprList, parameter, sym } from '../../../_helper/ast-builder';
import type { Pos } from '../../../_helper/ast-builder';
import { MIN_VERSION_PIPE, MIN_VERSION_PIPE_BIND } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions';
import { label } from '../../../_helper/label';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import type { RNode } from '../../../../../src/r-bridge/lang-4.x/ast/model/model';
import { afterAll, describe } from 'vitest';
import { SourceRange } from '../../../../../src/util/range';
import { RShell } from '../../../../../src/r-bridge/shell';

/** the left-hand side of a pipe is wrapped into an argument, the lexeme of an argument holding a nested pipe is the pipe operator */
const pipe = (pos: Pos, lhs: RNode, rhs: RNode) => ({
	type:     RType.Pipe,
	location: SourceRange.from(pos[0], pos[1], pos[0], pos[1] + 1),
	lexeme:   '|>',
	info:     {},
	lhs:      arg(lhs),
	rhs
}) as RNode;

describe('Parse Pipes', { concurrent: false }, withShell(shell => {
	const pipeBindShell = new RShell({ type: 'r-shell', pipeBind: true });
	afterAll(() => pipeBindShell.close());
	const x = sym('x', [1, 1]);
	assertAst(label('x |> f()', ['name-normal', 'pipe-and-pipe-bind', 'call-normal']),
		shell, 'x |> f()', exprList(pipe([1, 3], x, call(sym('f', [1, 6])))),
		{ minRVersion: MIN_VERSION_PIPE }
	);
	assertAst(label('x |> f() |> g()', ['name-normal', 'pipe-and-pipe-bind', 'call-normal']),
		shell, 'x |> f() |> g()', exprList({
			...pipe([1, 10], x, call(sym('g', [1, 13]))),
			lhs: arg(pipe([1, 3], x, call(sym('f', [1, 6]))), undefined)
		}),
		{ minRVersion: MIN_VERSION_PIPE }
	);
	assertAst(label('x |> y => f(y)', ['name-normal', 'pipe-and-pipe-bind', 'pipe-bind', 'call-normal']),
		pipeBindShell, 'x |> y => f(y)', exprList(pipe([1, 3], x, callExpr({
			type:       RType.FunctionDefinition,
			location:   SourceRange.from(1, 8, 1, 9),
			lexeme:     '=>',
			info:       {},
			parameters: [parameter('y', SourceRange.from(1, 6, 1, 6))],
			body:       {
				...exprList(call(sym('f', [1, 11]), [arg(sym('y', [1, 13]))])),
				location: SourceRange.from(1, 11, 1, 11)
			}
		}, [], SourceRange.from(1, 8, 1, 9), '=>'))),
		{ minRVersion: MIN_VERSION_PIPE_BIND, skipTreeSitter: true }
	);
}));
