import { describe, expect } from 'vitest';
import { testWithShell } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { DfEdge, EdgeType } from '../../../../../src/dataflow/graph/edge';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { DfgVertex } from '../../../../../src/dataflow/graph/vertex';
import type { RShell } from '../../../../../src/r-bridge/shell';

/** The nodes the `filter()` call resolves to in the dataflow graph (built-in package targets keep their `pkg:fn` id). */
async function filterCallTargets(shell: RShell, code: string, register: [string, string[]][]): Promise<Set<string>> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(shell).build();
	for(const [name, exports] of register) {
		analyzer.context().deps.addDependency(Package.fromConstants(name, exports.map(e => `export(${e})`).join('\n'), exports));
	}
	analyzer.addRequest(code);
	const df = await analyzer.dataflow();
	const targets = new Set<string>();
	for(const [id, vertex] of df.graph.vertices(true)) {
		if(DfgVertex.isFunctionCall(vertex) && String(vertex.name) === 'filter') {
			for(const [target, edge] of df.graph.edgesFrom(id)) {
				if(DfEdge.includesType(edge, EdgeType.Reads) || DfEdge.includesType(edge, EdgeType.Calls)) {
					targets.add(String(target));
				}
			}
		}
	}
	return targets;
}

// ordering/re-attach are covered by the tree-sitter tests, so this focuses on the one case R answers definitively: a global binding shadowing a package export
describe('Link libraries against real R', { concurrent: false }, () => {
	testWithShell('global definition shadows a package export (matches R)', async(shell) => {
		const rOut = await shell.sendCommandWithOutput('local({ filter <- function(x) 42; suppressMessages(library(stats)); filter(1) })');
		expect(rOut.join(' ')).toContain('42');

		const targets = await filterCallTargets(shell, 'filter <- function(x) 42\nlibrary(stats)\nfilter(1)', [['stats', ['filter']]]);
		expect(targets.has(NodeId.fromPkgFn('stats', 'filter'))).toBe(false);
		expect(targets.values().some(t => !NodeId.isBuiltIn(t))).toBe(true);
	});
});
