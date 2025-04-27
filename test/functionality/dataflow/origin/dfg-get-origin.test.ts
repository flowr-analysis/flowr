import { assert, beforeAll, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { Origin } from '../../../../src/dataflow/origin/dfg-get-origin';
import { getOriginInDfg, OriginType } from '../../../../src/dataflow/origin/dfg-get-origin';
import type {
	TREE_SITTER_DATAFLOW_PIPELINE
} from '../../../../src/core/steps/pipeline/default-pipelines';
import {
	createDataflowPipeline
} from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import { guard } from '../../../../src/util/assert';
import { graphToMermaidUrl } from '../../../../src/util/mermaid/dfg';
import { builtInId } from '../../../../src/dataflow/environments/built-in';

describe('Dataflow', withTreeSitter(ts => {
	describe('getOriginInDfg', () => {
		function chk(code: string, expected: Record<SingleSlicingCriterion, readonly Origin[] | undefined>): void  {
			describe(code, () => {
				let analysis: PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;
				beforeAll(async() => {
					analysis = await createDataflowPipeline(ts, {
						request: requestFromInput(code)
					}).allRemainingSteps();
				});
				test.each(Object.keys(expected) as SingleSlicingCriterion[])('%s', (interest: SingleSlicingCriterion) => {
					guard(analysis !== undefined);
					const want = expected[interest];
					const interestedId = slicingCriterionToId(interest, analysis.normalize.idMap);
					const origins = getOriginInDfg(analysis.dataflow.graph, interestedId);
					try {
						if(want === undefined) {
							assert.isUndefined(origins);
						} else {
							// sort both by ids
							origins?.sort((a, b) => String(a.id).localeCompare(String(b.id)));
							const wantMapped = want.map(e => ({
								...e,
								id: slicingCriterionToId(e.id as SingleSlicingCriterion, (analysis as PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE>).normalize.idMap)
							})).sort((a, b) => String(a.id).localeCompare(String(b.id)));
							assert.deepStrictEqual(origins, wantMapped);
						}
					} catch(e) {
						const dfg = analysis.dataflow.graph;
						console.error('dfg:', graphToMermaidUrl(dfg));
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
				'2@x': 	      [ro('1@x')],
				'4@h': 	      [fo('1@function'), ro('1@h')],
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
			'2@print': [ro('1@print'), fo('1@function'), bo('builtin:default', 'print', '2@print'), bo(builtInId('print'), 'print', '2@print')]
		});
		chk('c <- 1\nc(1,2,3)', {
			'2@c': [bo('builtin:vector', 'c', '2@c')]
		});
		chk('x <- print\nx("hey")', {
			'2@x': [ro('1@x'), bo(builtInId('print'), 'x', '2@x')]
		});
		chk('x <- 1\nfor(i in 1:10) {\n x <- i + x\n}\nprint(x)', {
			'1@x':     [wo('1@x')],
			'3@i':     [ro('2@i')],
			'3@x':     [wo('3@x')],
			'3:11':    [ro('1@x'), ro('3@x')],
			'5@x':     [ro('1@x'), ro('3@x')],
			'5@print': [bo('builtin:default', 'print', '5@print')]
		});

		chk('x <- 1\nfor(i in 1:10) {\n x <- i + x\n x <- x + 1\n}\nprint(x)', {
			'3@x':  [wo('3@x')],
			'3:11': [ro('1@x'), ro('4@x')],
			'4@x':  [wo('4@x')],
			'6@x':  [ro('1@x'), ro('3@x'), ro('4@x')]
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

		// TODO: with array acess
		// TODO: cfg pipeline step
		// TODO: provide functions to map arguments of assignments etc.
	});
}));