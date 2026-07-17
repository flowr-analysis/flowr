import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withTreeSitter } from '../../../_helper/shell';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import { type FlowrLaxSourcingOptions, FlowrConfig } from '../../../../../src/config';
import { ProjectKind } from '../../../../../src/project/context/project-kind';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import type { DeepWritable } from 'ts-essentials';
import type { DataflowGraph } from '../../../../../src/dataflow/graph/graph';
import type { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraphVertexInfo } from '../../../../../src/dataflow/graph/vertex';

/** the vertices `s.R` contributed, i.e. the ones its id names */
function sourced(graph: DataflowGraph): [NodeId, DataflowGraphVertexInfo][] {
	return graph.vertices(true).filter(([id]) => String(id).startsWith('s.R')).toArray();
}

/**
 * The graph of a project whose `main.R` defines `y`, sources an `s.R` redefining it, and reads it afterwards.
 * `assumeFilesExist` decides directly, no kind may interfere.
 */
async function sourcingProject(assumeFilesExist: boolean, parser: Parameters<typeof createDataflowPipeline>[0]) {
	const config = FlowrConfig.amend(FlowrConfig.default(), c => {
		(c.solver.resolveSource ??= {} as DeepWritable<FlowrLaxSourcingOptions>).assumeFilesExist = assumeFilesExist;
		c.specializeConfig = undefined;
	});
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-assume-'));
	try {
		fs.writeFileSync(path.join(dir, 's.R'), 'y <- 2\n');
		const main = path.join(dir, 'main.R');
		fs.writeFileSync(main, `y <- 1\nsource('${path.join(dir, 's.R').replaceAll('\\', '/')}')\nx <- y\n`);
		return await createDataflowPipeline(parser, { context: contextFromInput(`file://${main}`, config) }).allRemainingSteps();
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

describe('solver.resolveSource.assumeFilesExist', withTreeSitter(parser => {
	test('a sourced file is conditional on its source call while it may not be there', async() => {
		const { dataflow } = await sourcingProject(false, parser);
		const vertices = sourced(dataflow.graph);
		assert.isNotEmpty(vertices);
		assert.isTrue(vertices.some(([, v]) => (v.cds?.length ?? 0) > 0), 'the source call has to be a control dependency');
	});

	test('assuming the file is there makes everything it defines certain', async() => {
		const { dataflow } = await sourcingProject(true, parser);
		const vertices = sourced(dataflow.graph);
		assert.isNotEmpty(vertices);
		for(const [id, v] of vertices) {
			assert.isEmpty(v.cds ?? [], `${id} may not depend on the source call anymore`);
		}
	});

	test('a definition of the sourced file overwrites the one it shadows', async() => {
		const { dataflow, normalize } = await sourcingProject(true, parser);
		const use = dataflow.graph.vertices(true).find(([id]) => {
			const node = normalize.idMap.get(id);
			return node?.lexeme === 'y' && node?.location?.[0] === 3;
		});
		assert.isDefined(use, 'the `y` of `x <- y` has to be a vertex');
		const reads = [...dataflow.graph.outgoingEdges(use[0]) ?? []]
			.filter(([, e]) => e.types & EdgeType.Reads).map(([t]) => String(t));
		assert.isNotEmpty(reads);
		for(const read of reads) {
			assert.isTrue(read.startsWith('s.R'), `${read} is no definition of the sourced file, so it was not overwritten`);
		}
	});

}));

test('only the kinds that ship the files they source assume them', () => {
	const assumed = Object.values(ProjectKind)
		.filter(kind => FlowrConfig.forKind(FlowrConfig.default(), kind).solver.resolveSource?.assumeFilesExist);
	assert.deepStrictEqual(assumed, [ProjectKind.Package, ProjectKind.ShinyApp, ProjectKind.Project]);
});
