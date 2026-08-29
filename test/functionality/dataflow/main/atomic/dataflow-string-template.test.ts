import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { type TREE_SITTER_DATAFLOW_PIPELINE, createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../../../../../src/core/steps/pipeline/pipeline';
import { guard } from '../../../../../src/util/assert';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import { DfEdge, EdgeType } from '../../../../../src/dataflow/graph/edge';
import { interpolationsOf } from '../../../../../src/dataflow/internal/process/functions/call/built-in/built-in-string-template';
import { VertexType } from '../../../../../src/dataflow/graph/vertex';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../src/dataflow/environments/built-in-proc-name';

/** Whether the definition at the criterion is linked to anything, which a template only does for real code. */
describe('Dataflow', withTreeSitter(ts => {
	describe('string templates', () => {
		function assertLinked(name: string, code: string, criterion: SlicingCriterion, linked: boolean): void {
			test(label(name, ['function-calls', 'built-in-evaluation'], ['dataflow']), async() => {
				const analysis: PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE> =
					await createDataflowPipeline(ts, { context: contextFromInput(code) }).allRemainingSteps();
				const graph = analysis.dataflow.graph;
				const id = SlicingCriterion.parse(criterion, analysis.normalize.idMap);
				guard(id !== undefined);
				const edges = [...graph.edgesTo(id), ...graph.edgesFrom(id)];
				assert.strictEqual(edges.some(([, e]) => DfEdge.includesType(e, EdgeType.Reads)), linked);
			});
		}

		describe('the interpolations of a template', () => {
			test.each([
				['v={x}', ['x']], ['{x}-{y}', ['x', 'y']], ['{{x}}', []], ['no braces', []],
				['{ if (x > 1) \'}\' else \'{\' }', [' if (x > 1) \'}\' else \'{\' ']], ['{f({y})}', ['f({y})']]
			])('%s', (template, expected) => {
				assert.deepStrictEqual(interpolationsOf(template, '{', '}'), expected);
			});
			test('cli markup contributes its content, not the class', () => {
				assert.deepStrictEqual(interpolationsOf('{.val {x}}', '{', '}', true), ['x']);
				assert.deepStrictEqual(interpolationsOf('{.strong thing}', '{', '}', true), []);
			});
		});

		assertLinked('glue interpolates R code', 'library(glue)\nx <- 5\nglue("v={x}")', '2@x', true);
		assertLinked('a call in a template is a call', 'library(glue)\nf <- function(a) a\nx <- 5\nglue("{f(x)}")', '3@x', true);
		assertLinked('a doubled brace is a literal one', 'library(glue)\nx <- 5\nglue("{{x}}")', '2@x', false);
		assertLinked('a template pointed elsewhere resolves nothing', 'library(glue)\nx <- 5\ne <- new.env()\nglue("{x}", .envir = e)', '2@x', false);
		assertLinked('str_glue templates the same way', 'library(stringr)\nx <- 5\nstr_glue("{x}")', '2@x', true);
		assertLinked('str_interp uses its own delimiter', 'library(stringr)\nx <- 5\nstr_interp("${x}")', '2@x', true);
		assertLinked('cli interpolates plain braces', 'library(cli)\nx <- 5\ncli_alert_info("v={x}")', '2@x', true);
		assertLinked('cli markup wraps an interpolation', 'library(cli)\nx <- 5\ncli_alert_info("{.val {x}}")', '2@x', true);
		assertLinked('cli markup text is no code', 'library(cli)\nthing <- 5\ncli_text("{.strong thing}")', '2@thing', false);
		test(label('cli_abort stays an error exit rather than a template', ['function-calls', 'built-in-evaluation'], ['dataflow']), async() => {
			const analysis = await createDataflowPipeline(ts, { context: contextFromInput('library(cli)\ncli_abort("boom")') }).allRemainingSteps();
			const call = [...analysis.dataflow.graph.verticesOfType(VertexType.FunctionCall)].find(([id]) => NodeId.recoverName(id, analysis.dataflow.graph.idMap) === 'cli_abort');
			assert.isTrue((call?.[1].origin as readonly string[] | undefined)?.includes(BuiltInProcName.Stop));
		});

		test(label('every interpolation of one template gets a vertex of its own', ['function-calls', 'built-in-evaluation'], ['dataflow']), async() => {
			const code = 'library(glue)\nuser <- 1\nn <- 2\nglue("hi {user}, {n} items")';
			const analysis = await createDataflowPipeline(ts, { context: contextFromInput(code) }).allRemainingSteps();
			const graph = analysis.dataflow.graph;
			/* the two interpolations are separate reads, so neither may end up merged into the other's vertex */
			const reads = new Map<string, NodeId[]>();
			for(const [id] of graph.verticesOfType(VertexType.Use)) {
				const to = [...graph.edgesFrom(id)]
					.filter(([, e]) => DfEdge.includesType(e, EdgeType.Reads))
					.map(([target]) => target);
				if(to.length > 0) {
					reads.set(String(id), to);
				}
			}
			const named = (id: NodeId) => NodeId.recoverName(id, analysis.normalize.idMap);
			const targets = [...reads.values()].map(list => list.map(named).sort().join(','));
			assert.deepStrictEqual(targets.sort(), ['n', 'user'], `each interpolation reads one name, got ${JSON.stringify([...reads])}`);
		});

		assertLinked('a plain string stays a string', 'x <- 5\nprint("{x}")', '1@x', false);
		assertLinked('a write in a template lands here', 'library(glue)\nglue("{ zz <- 3 }")\nprint(zz)', '3@zz', true);
	});
}));
