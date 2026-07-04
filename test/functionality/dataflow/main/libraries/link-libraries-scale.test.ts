import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../../../../src/dataflow/graph/vertex';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import type { DataflowInformation } from '../../../../../src/dataflow/info';
import type { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

/** Analyzes `code` with `pkg0..pkg{n-1}` (each exporting `f{i}`) registered. */
async function analyzeWithPackages(ts: TreeSitterExecutor, code: string, n: number): Promise<DataflowInformation> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
	for(let i = 0; i < n; i++) {
		analyzer.context().deps.addDependency(Package.fromConstants(`pkg${i}`, `export(f${i})`, [`f${i}`]));
	}
	analyzer.addRequest(code);
	return analyzer.dataflow();
}

/** For each `f{i}()` call, the built-in package targets it resolves to (must be exactly `pkg{i}:f{i}`). */
function exportResolution(df: DataflowInformation): Map<string, string[]> {
	const byName = new Map<string, string[]>();
	for(const [id, vertex] of df.graph.vertices(true)) {
		const name = String(vertex.name);
		if(vertex.tag === VertexType.FunctionCall && /^f\d+$/.test(name)) {
			const targets: string[] = [];
			for(const [target, edge] of df.graph.outgoingEdges(id) ?? []) {
				if((edge.types & (EdgeType.Reads | EdgeType.Calls)) !== 0 && NodeId.isBuiltIn(target)) {
					targets.push(String(target));
				}
			}
			byName.set(name, targets);
		}
	}
	return byName;
}

// Scale/regression: many transitively attached packages must all resolve to their own package, and terminate.
// (Measured ~80ms for N=100 vs ~75ms library-free, i.e. near-zero overhead and linear scaling.)
describe('Link libraries at scale', withTreeSitter(ts => {
	const N = 100;

	test('deep transitive chain of many libraries resolves every export to its own package', async() => {
		// h0 loads pkg0; each h{i} calls h{i-1} then loads pkg{i}; calling h{N-1} transitively attaches all N packages
		let code = 'h0 <- function() library(pkg0)\n';
		for(let i = 1; i < N; i++) {
			code += `h${i} <- function() { h${i - 1}(); library(pkg${i}) }\n`;
		}
		code += `h${N - 1}()\n`;
		for(let i = 0; i < N; i++) {
			code += `f${i}()\n`;
		}
		const resolution = exportResolution(await analyzeWithPackages(ts, code, N));
		for(let i = 0; i < N; i++) {
			expect(resolution.get(`f${i}`)).toEqual([NodeId.toBuiltIn(Package.funcIdentif(`pkg${i}`, `f${i}`))]);
		}
	});

	test('diamond/fan-out of many libraries keeps every package', async() => {
		let code = '';
		for(let i = 0; i < N; i++) {
			code += `h${i} <- function() library(pkg${i})\n`;
		}
		code += 'root <- function() {\n';
		for(let i = 0; i < N; i++) {
			code += `  h${i}()\n`;
		}
		code += '  if(u) h0() else h1()\n}\nroot()\n';
		for(let i = 0; i < N; i++) {
			code += `f${i}()\n`;
		}
		const resolution = exportResolution(await analyzeWithPackages(ts, code, N));
		for(let i = 0; i < N; i++) {
			expect(resolution.get(`f${i}`)).toEqual([NodeId.toBuiltIn(Package.funcIdentif(`pkg${i}`, `f${i}`))]);
		}
	});
}));
