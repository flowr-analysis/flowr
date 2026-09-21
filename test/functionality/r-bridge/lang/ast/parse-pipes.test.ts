import { assertAst, withShell } from '../../../_helper/shell';
import { exprList } from '../../../_helper/ast-builder';
import { MIN_VERSION_PIPE, MIN_VERSION_PIPE_BIND } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions';
import { label } from '../../../_helper/label';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import { afterAll, describe } from 'vitest';
import { SourceRange } from '../../../../../src/util/range';
import { RShell } from '../../../../../src/r-bridge/shell';

describe('Parse Pipes', { concurrent: false }, withShell(shell => {
	const pipeBindShell = new RShell({ type: 'r-shell', pipeBind: true });
	afterAll(() => pipeBindShell.close());
	assertAst(label('x |> f()', ['name-normal', 'pipe-and-pipe-bind', 'call-normal']),
		shell, 'x |> f()', exprList({
			type:     RType.Pipe,
			location: SourceRange.from(1, 3, 1, 4),
			lexeme:   '|>',
			info:     {},
			lhs:      {
				type:     RType.Argument,
				name:     undefined,
				location: SourceRange.from(1, 1, 1, 1),
				lexeme:   'x',
				info:     {},
				value:    {
					type:     RType.Symbol,
					location: SourceRange.from(1, 1, 1, 1),
					lexeme:   'x',
					content:  'x',
					info:     {}
				}
			},
			rhs: {
				type:         RType.FunctionCall,
				named:        true,
				location:     SourceRange.from(1, 6, 1, 6),
				lexeme:       'f',
				info:         {},
				arguments:    [],
				functionName: {
					type:     RType.Symbol,
					location: SourceRange.from(1, 6, 1, 6),
					lexeme:   'f',
					content:  'f',
					info:     {},
				}
			}
		}),
		{ minRVersion: MIN_VERSION_PIPE }
	);
	assertAst(label('x |> f() |> g()', ['name-normal', 'pipe-and-pipe-bind', 'call-normal']),
		shell, 'x |> f() |> g()', exprList({
			type:     RType.Pipe,
			location: SourceRange.from(1, 10, 1, 11),
			lexeme:   '|>',
			info:     {},
			lhs:      {
				type:     RType.Argument,
				location: SourceRange.from(1, 3, 1, 4),
				lexeme:   '|>',
				name:     undefined,
				info:     {},
				value:    {
					type:     RType.Pipe,
					location: SourceRange.from(1, 3, 1, 4),
					lexeme:   '|>',
					info:     {},
					lhs:      {
						type:     RType.Argument,
						location: SourceRange.from(1, 1, 1, 1),
						lexeme:   'x',
						name:     undefined,
						value:    {
							type:     RType.Symbol,
							location: SourceRange.from(1, 1, 1, 1),
							lexeme:   'x',
							content:  'x',
							info:     {},
						},
						info: {},
					},
					rhs: {
						type:         RType.FunctionCall,
						named:        true,
						location:     SourceRange.from(1, 6, 1, 6),
						lexeme:       'f',
						arguments:    [],
						functionName: {
							type:     RType.Symbol,
							location: SourceRange.from(1, 6, 1, 6),
							lexeme:   'f',
							content:  'f',
							info:     {},
						},
						info: {},
					}
				}
			},
			rhs: {
				type:         RType.FunctionCall,
				named:        true,
				location:     SourceRange.from(1, 13, 1, 13),
				lexeme:       'g',
				arguments:    [],
				info:         {},
				functionName: {
					type:     RType.Symbol,
					location: SourceRange.from(1, 13, 1, 13),
					lexeme:   'g',
					content:  'g',
					info:     {}
				}
			}
		}),
		{ minRVersion: MIN_VERSION_PIPE }
	);
	assertAst(label('x |> y => f(y)', ['name-normal', 'pipe-and-pipe-bind', 'pipe-bind', 'call-normal']),
		pipeBindShell, 'x |> y => f(y)', exprList({
			type:     RType.Pipe,
			location: SourceRange.from(1, 3, 1, 4),
			lexeme:   '|>',
			info:     {},
			lhs:      {
				type:     RType.Argument,
				name:     undefined,
				location: SourceRange.from(1, 1, 1, 1),
				lexeme:   'x',
				info:     {},
				value:    {
					type:     RType.Symbol,
					location: SourceRange.from(1, 1, 1, 1),
					lexeme:   'x',
					content:  'x',
					info:     {}
				}
			},
			rhs: {
				type:           RType.FunctionCall,
				named:          undefined,
				location:       SourceRange.from(1, 8, 1, 9),
				lexeme:         '=>',
				info:           {},
				arguments:      [],
				calledFunction: {
					type:       RType.FunctionDefinition,
					location:   SourceRange.from(1, 8, 1, 9),
					lexeme:     '=>',
					info:       {},
					parameters: [{
						type:         RType.Parameter,
						location:     SourceRange.from(1, 6, 1, 6),
						special:      false,
						lexeme:       'y',
						defaultValue: undefined,
						name:         {
							type:     RType.Symbol,
							location: SourceRange.from(1, 6, 1, 6),
							lexeme:   'y',
							content:  'y',
							info:     {}
						},
						info: {}
					}],
					body: {
						type:     RType.ExpressionList,
						location: SourceRange.from(1, 11, 1, 11),
						lexeme:   undefined,
						grouping: undefined,
						info:     {},
						children: [{
							type:         RType.FunctionCall,
							named:        true,
							location:     SourceRange.from(1, 11, 1, 11),
							lexeme:       'f',
							info:         {},
							functionName: {
								type:     RType.Symbol,
								location: SourceRange.from(1, 11, 1, 11),
								lexeme:   'f',
								content:  'f',
								info:     {}
							},
							arguments: [{
								type:     RType.Argument,
								location: SourceRange.from(1, 13, 1, 13),
								lexeme:   'y',
								name:     undefined,
								info:     {},
								value:    {
									type:     RType.Symbol,
									location: SourceRange.from(1, 13, 1, 13),
									lexeme:   'y',
									content:  'y',
									info:     {}
								}
							}]
						}]
					}
				}
			}
		}),
		{ minRVersion: MIN_VERSION_PIPE_BIND, skipTreeSitter: true }
	);
}));

