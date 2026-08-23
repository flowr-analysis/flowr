import { assert, beforeAll, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { type Origin, OriginType } from '../../../../src/dataflow/origin/dfg-get-origin';
import { type TREE_SITTER_DATAFLOW_PIPELINE, createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import { guard } from '../../../../src/util/assert';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { BuiltInProcName } from '../../../../src/dataflow/environments/built-in-proc-name';
import { label } from '../../_helper/label';

describe('Dataflow', withTreeSitter(ts => {
	describe('Dataflow.origin', () => {
		function chk(code: string, expected: Record<SlicingCriterion, readonly Origin[] | undefined>, name = code): void  {
			describe(name, () => {
				let analysis: PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;
				beforeAll(async() => {
					analysis = await createDataflowPipeline(ts, {
						context: contextFromInput(code)
					}).allRemainingSteps();
				});
				test.each(Object.keys(expected) as SlicingCriterion[])('%s', (interest: SlicingCriterion) => {
					guard(analysis !== undefined);
					const want = expected[interest];
					const interestedId = SlicingCriterion.parse(interest, analysis.normalize.idMap);
					const origins = Dataflow.origin(analysis.dataflow.graph, interestedId);
					try {
						if(want === undefined) {
							assert.isUndefined(origins);
						} else {
							// sort both by ids
							origins?.sort((a, b) => String(a.id).localeCompare(String(b.id)));
							const wantMapped = want.map(e => ({
								...e,
								/* a built-in id names no source location, so it is no criterion to resolve */
								id: NodeId.isBuiltIn(e.id) ? e.id : SlicingCriterion.parse(e.id as SlicingCriterion, (analysis as PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE>).normalize.idMap)
							})).sort((a, b) => String(a.id).localeCompare(String(b.id)));
							assert.deepStrictEqual(origins, wantMapped);
						}
					} catch(e) {
						const dfg = analysis.dataflow.graph;
						console.error('dfg:', Dataflow.visualize.mermaid.url(dfg));
						throw e;
					}
				});
			});
		}
		const wo = (id: NodeId): Origin => ({ type: OriginType.WriteVariableOrigin, id });
		const ro = (id: NodeId): Origin => ({ type: OriginType.ReadVariableOrigin, id });
		const co = (id: NodeId): Origin => ({ type: OriginType.ConstantOrigin, id });
		const fo = (id: NodeId): Origin => ({ type: OriginType.FunctionCallOrigin, id });
		const bo = (proc: string, name: string, id: NodeId): Origin => ({ type: OriginType.BuiltInFunctionOrigin, proc, id, fn: { name } });

		describe.each([
			{ name: 'default', suffix: '' },
			{ name: 'taint-x', suffix: '\nx <- 42\n' },
		])('$name', ({ suffix }) => {
			chk(`x <- 2\nprint(x)${suffix}`, {
				'1@x': [wo('1@x')],
				'2@x': [ro('1@x')],
				'1@2': [co('1@2')],
			});
			chk(`x <- 2\ny <- x\nprint(y)${suffix}`, {
				'1@x': [wo('1@x')],
				'2@y': [wo('2@y')],
				'3@y': [ro('2@y')],
			});
			chk(`x <- 2\nif(u) {\nx <- 3\n}\nprint(x)${suffix}`, {
				'3@x': [wo('3@x')],
				'5@x': [ro('1@x'), ro('3@x')]
			});
			chk(`x <- 2\nif(u) {\n  x <- 3\n}\nprint(x)\nx <- 1${suffix}`, {
				'3@x': [wo('3@x')],
				'5@x': [ro('1@x'), ro('3@x')]
			});
			chk(`h <- function(x=2) {\nprint(x)\n}\nh(3)${suffix}`, {
				'1@function': [co('1@function')],
				'1@x':        [wo('1@x')],
				'2@x':        [ro('1@x')],
				'4@h':        [fo('1@function'), ro('1@h')],
			});
			chk(`if(u) { x <- \nfunction(x)\nx \n }else {x <- \nfunction(x)\nx}\nx(3)${suffix}`, {
				'1@u': undefined,
				'1@x': [wo('1@x')],
				'3@x': [ro('2@x')],
				'4@x': [wo('4@x')],
				'6@x': [ro('5@x')],
				'7@x': [fo('2@function'), ro('1@x'), fo('5@function'), ro('4@x')],
			});
		});
		chk('x <- 1\nx\nx <- 2\nx\nx <- 3\nx', {
			'2@x': [ro('1@x')],
			'4@x': [ro('3@x')],
			'6@x': [ro('5@x')]
		});
		chk('c <- function(...) ...\nc(1,2,3)', {
			'2@c': [ro('1@c'), fo('1@function')]
		});
		chk('if(u) { print <- function(x) x }\nprint("hey")', {
			'2@print': [ro('1@print'), fo('1@function'), bo(BuiltInProcName.Default, 'print', '2@print'), bo(NodeId.toBuiltIn('print'), 'print', '2@print')]
		});
		chk('c <- 1\nc(1,2,3)', {
			'2@c': [bo(BuiltInProcName.Vector, 'c', '2@c')]
		});
		chk('x <- print\nx("hey")', {
			'2@x': [ro('1@x'), bo(NodeId.toBuiltIn('print'), 'x', '2@x')]
		});
		chk('x <- 1\nfor(i in 1:10) {\n x <- i + x\n}\nprint(x)', {
			'1@x':     [wo('1@x')],
			'3@i':     [ro('2@i')],
			'3@x':     [wo('3@x')],
			'3@[2]x':  [ro('1@x'), ro('3@x')],
			'5@x':     [ro('1@x'), ro('3@x')],
			'5@print': [bo(BuiltInProcName.Default, 'print', '5@print')]
		});

		chk('x <- 1\nfor(i in 1:10) {\n x <- i + x\n x <- x + 1\n}\nprint(x)', {
			'3@x':    [wo('3@x')],
			'3@[2]x': [ro('1@x'), ro('4@x')],
			'4@x':    [wo('4@x')],
			'6@x':    [ro('1@x'), ro('4@x')]
		});

		chk('f <- function(x) {\nfunction() x + 2\n}\ng <- f(1)\ng()', {
			'1@f': [wo('1@f')],
			'4@g': [wo('4@g')],
			'5@g': [ro('4@g'), fo('2@function')]
		});
		chk('f <- 3\nquote(f <- 2)\nf', {
			'3@f': [ro('1@f')]
		});
		chk('f <- 3\neval(u)\nf', {
			/* under the assumption of eval impact */
			'3@f': [ro('1@f')]
		});
		// call with an end!
		chk('g <- x\ng()', {
			'2@g': [ro('1@g')]
		});

		describe('reads of built-ins', () => {
			/* a built-in constant carries a value vertex, so the read of it is a constant origin */
			chk('print(pi)', {
				'1@pi': [co(NodeId.toBuiltIn('pi'))]
			}, label('built-in constant', ['numbers'], ['dataflow']));
			chk('x <- LETTERS', {
				'1@LETTERS': [co(NodeId.toBuiltIn('LETTERS'))]
			}, label('built-in vector constant', ['strings'], ['dataflow']));
			chk('pi <- 3\nprint(pi)\nrm(pi)\nprint(pi)', {
				'2@pi': [ro('1@pi')],
				'4@pi': [co(NodeId.toBuiltIn('pi'))]
			}, label('shadowed and restored by rm', ['numbers', 'lexicographic-scope'], ['dataflow']));
			/* a built-in function named as a value has no vertex, so it stays a built-in origin */
			chk('x <- print\nx("hey")', {
				'1@print': [bo(NodeId.toBuiltIn('print'), 'print', '1@print')],
				'2@x':     [ro('1@x'), bo(NodeId.toBuiltIn('print'), 'x', '2@x')]
			}, label('built-in function as a value', ['function-calls'], ['dataflow']));
		});

		describe('unevaluated arguments have no origin', () => {
			/* whether the marking comes from the quote processor or from a signature must not matter */
			for(const [code, cap] of [
				['quote(x)', 'built-in-quoting'],
				['bquote(x)', 'built-in-quoting'],
				['alist(x)', 'built-in-quoting'],
				['evalq(x, e)', 'built-in-evaluation']
			] as const) {
				chk(`x <- 1\n${code}`, { '2@x': undefined }, label(code, [cap], ['dataflow']));
			}
			chk('x <- 1\nwhile(TRUE) print(x)', {
				'2@x': [ro('1@x')]
			}, label('a loop body is evaluated', ['while-loop'], ['dataflow']));
			/* the call within the quotation is no more evaluated than a symbol within it */
			chk('f <- function() 1\nquote(f())', {
				'2@f': undefined
			}, label('quoted call', ['built-in-quoting', 'function-calls'], ['dataflow']));
			chk('quote(print(1))', {
				'1@print': undefined
			}, label('quoted built-in call', ['built-in-quoting', 'function-calls'], ['dataflow']));
			chk('f <- function() substitute(g())\ng <- function() 1\nf()', {
				'1@g': undefined
			}, label('substituted call', ['built-in-quoting', 'function-calls'], ['dataflow']));
			/* `quote` defines nothing, so its assignment target is written nowhere */
			chk('f <- 3\nquote(f <- 2)\nf', {
				'2@f': undefined,
				'3@f': [ro('1@f')]
			}, label('quoted definition', ['built-in-quoting', 'local-left-assignment'], ['dataflow']));
			chk('f <- function() 1\nfor(i in 1:2) f()', {
				'2@f': [fo('1@function'), ro('1@f')]
			}, label('a loop body still calls', ['for-loop', 'function-calls'], ['dataflow']));
		});
	});
}));