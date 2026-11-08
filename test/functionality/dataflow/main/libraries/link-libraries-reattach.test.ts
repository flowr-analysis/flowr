import { describe, assert, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { DfgVertex } from '../../../../../src/dataflow/graph/vertex';
import type { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { Environment } from '../../../../../src/dataflow/environments/environment';
import { fileProtocol } from '../../../../../src/r-bridge/retriever';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * `library(pack)` on an already-attached package is a no-op in R: three `library(stats)` calls leave exactly
 * one `package:stats` on `search()`. flowR has to agree, or a project calling it once per file stacks a layer
 * per call and every later name resolution walks through all of them.
 */
describe.sequential('re-attaching a library', withTreeSitter(ts => {
	/** How often `pack` appears in the deepest environment chain any vertex carries, and how deep that chain is. */
	async function attachedLayers(ts: TreeSitterExecutor, files: readonly string[], pack: string): Promise<{ layers: number, depth: number }> {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-reattach-'));
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		for(const [i, content] of files.entries()) {
			const file = path.join(dir, `f${i}.R`);
			fs.writeFileSync(file, content);
			analyzer.addRequest(`${fileProtocol}${file}`);
		}
		const { graph } = await analyzer.dataflow();
		let layers = 0;
		let depth = 0;
		for(const [, vertex] of graph.vertices(true)) {
			if(!DfgVertex.isFunctionDefinition(vertex) || vertex.environment === undefined) {
				continue;
			}
			let seen = 0;
			let here = 0;
			for(let e: Environment | undefined = vertex.environment.current; e && seen < 500; e = e.parent === e ? undefined : e.parent) {
				seen++;
				if(e.n === pack) {
					here++;
				}
			}
			layers = Math.max(layers, here);
			depth = Math.max(depth, seen);
		}
		/* the parser is shared with the other cases, so the analyzer must not close it */
		fs.rmSync(dir, { recursive: true, force: true });
		return { layers, depth };
	}

	test('twice in one file attaches once', async() => {
		const { layers } = await attachedLayers(ts, ['library(dplyr)\nf <- function() filter(1)\nlibrary(dplyr)\ng <- function() filter(2)'], 'dplyr');
		assert.strictEqual(layers, 1, 'the second `library` is a no-op, as it is in R');
	});

	test('once per file attaches once for the project', async() => {
		const file = (i: number) => `library(dplyr)\nf${i} <- function() filter(${i})`;
		const one = await attachedLayers(ts, [file(1)], 'dplyr');
		const five = await attachedLayers(ts, [1, 2, 3, 4, 5].map(file), 'dplyr');
		assert.strictEqual(five.layers, 1, 'a project is one R session, so the search path holds one entry');
		assert.strictEqual(five.depth, one.depth, 'and the chain does not grow with the number of files');
	});
}));
