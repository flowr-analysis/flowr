import { afterAll, assert, beforeAll, describe, expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { createSlicePipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { deterministicCountingIdGenerator } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../../../../src/r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import { reconstructToCode } from '../../../../../src/reconstruct/reconstruct';
import { SourceInlineMap } from '../../../../../src/reconstruct/inline/source-inline-map';
import type { SlicingCriteria } from '../../../../../src/slicing/criterion/parse';
import type { ParentInformation } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { executeStaticSliceQuery } from '../../../../../src/queries/catalog/static-slice-query/static-slice-query-executor';

/** force-select every named `source()` call so the inlining recursion is exercised regardless of what the slice pulls in */
function selectSourceCalls(node: RNode<ParentInformation>): boolean {
	return node.type === RType.FunctionCall && node.named === true && node.functionName.lexeme === 'source';
}

async function run(input: string, files: FlowrInlineTextFile[], criteria: SlicingCriteria) {
	const parser = new TreeSitterExecutor();
	const context = contextFromInput(input);
	context.addFiles(files);
	const res = await createSlicePipeline(parser, {
		getId:     deterministicCountingIdGenerator(0),
		context,
		criterion: criteria
	}).allRemainingSteps();
	const map = SourceInlineMap.build(res.normalize, res.dataflow.graph);
	const inlined = reconstructToCode(res.normalize, {
		nodes:         res.slice.result,
		inlineSources: true,
		sourceMap:     map
	}, selectSourceCalls);
	return { res, map, inlined };
}

describe.sequential('inline source()', () => {
	beforeAll(async() => {
		await TreeSitterExecutor.initTreeSitter();
	});
	afterAll(() => { /* nothing to clean up */ });

	test('SourceInlineMap.build links the source() call to the sourced file', async() => {
		const { res, map } = await run('source("a")\ncat(N)', [ new FlowrInlineTextFile('a', 'N <- 9') ], ['2@N']);
		expect(res.normalize.ast.files.length).toBe(2);
		expect(map.size).toBe(1);
		// the single mapping must point at file index 1 (the sourced file)
		expect([...map.values()]).toEqual([1]);
		// and the file that entry refers to must be the one with path "a"
		const [[, idx]] = [...map.entries()];
		expect(res.normalize.ast.files[idx].filePath).toBe('a');
	});

	test('single inline splices the sourced definition and drops the source() call', async() => {
		const { inlined } = await run('source("a")\ncat(N)', [ new FlowrInlineTextFile('a', 'N <- 9') ], ['2@N']);
		const code = inlined.code as string;
		expect(code).toContain('N <- 9');
		expect(code).not.toContain('source(');
		expect(inlined.inlineWarnings).toEqual([]);
	});

	test('nested inline (a sources b) splices both files', async() => {
		const { inlined } = await run('source("a")\ncat(M)', [
			new FlowrInlineTextFile('a', 'source("b")\nM <- K + 1'),
			new FlowrInlineTextFile('b', 'K <- 5')
		], ['2@M']);
		const code = inlined.code as string;
		expect(code).toContain('K <- 5');
		expect(code).toContain('M <- K + 1');
		expect(code).not.toContain('source(');
		expect(inlined.inlineWarnings).toEqual([]);
	});

	test('multiple source() on one line are both inlined', async() => {
		const { inlined } = await run('source("a"); source("b")\ncat(N + M)', [
			new FlowrInlineTextFile('a', 'N <- 1'),
			new FlowrInlineTextFile('b', 'M <- 2')
		], ['2@N', '2@M']);
		const code = inlined.code as string;
		expect(code).toContain('N <- 1');
		expect(code).toContain('M <- 2');
		expect(code).not.toContain('source(');
		expect(inlined.inlineWarnings).toEqual([]);
	});

	test('the same file sourced from two call sites is inlined at BOTH (not left literal at the second)', async() => {
		const { inlined, map } = await run('source("a")\nx <- N\nsource("a")\ny <- N\ncat(x + y)', [
			new FlowrInlineTextFile('a', 'N <- 9')
		], ['5@cat']);
		const code = inlined.code as string;
		// both source() calls resolve to the single stored file (index 1)
		expect([...map.values()]).toEqual([1, 1]);
		expect(code).toContain('N <- 9');
		expect(code).not.toContain('source(');            // fully self-contained
		expect(inlined.inlineWarnings).toEqual([]);        // no bogus "unresolved"
	});

	test('diamond (a sources b and c, both source d) inlines the shared leaf on every path', async() => {
		const { inlined } = await run('source("a")\ncat(D)', [
			new FlowrInlineTextFile('a', 'source("b")\nsource("c")'),
			new FlowrInlineTextFile('b', 'source("d")\nB <- 1'),
			new FlowrInlineTextFile('c', 'source("d")\nC <- 2'),
			new FlowrInlineTextFile('d', 'D <- 42')
		], ['2@D']);
		const code = inlined.code as string;
		expect(code).toContain('D <- 42');
		expect(code).not.toContain('source(');            // no orphaned literal on the shared-leaf path
		expect(inlined.inlineWarnings).toEqual([]);        // no false "unresolved" for c's source("d")
	});

	test('cyclic source() (a sources b, b sources a) does not loop and is reported', async() => {
		const { inlined, map } = await run('source("a")\ncat(Z)', [
			new FlowrInlineTextFile('a', 'source("b")\nZ <- 1'),
			new FlowrInlineTextFile('b', 'source("a")\nW <- 2')
		], ['2@Z']);
		const code = inlined.code as string;
		// re-sourcing calls must still resolve to the (single) stored files, enabling cycle detection
		expect(map.size).toBeGreaterThanOrEqual(2);
		const warnings = inlined.inlineWarnings ?? [];
		expect(warnings.some(w => w.kind === 'cycle')).toBe(true);
		// the literal call and the marker comment are kept at the cycle edge
		expect(code).toContain('# [flowR] cyclic source() not inlined');
		expect(code).toContain('source(');
	});

	test('unresolvable source() is kept verbatim and reported', async() => {
		const { inlined } = await run('source("missing")\ncat(1)', [], ['2@cat']);
		const code = inlined.code as string;
		const warnings = inlined.inlineWarnings ?? [];
		expect(warnings.some(w => w.kind === 'unresolved')).toBe(true);
		expect(code).toContain('source("missing")');
	});

	test('respects the exact reconstruction for a plain single inline', async() => {
		const { inlined } = await run('source("a")\ncat(N)', [ new FlowrInlineTextFile('a', 'N <- 9') ], ['2@N']);
		assert.strictEqual(inlined.code, 'N <- 9\nN');
	});

	test('inlines a whole nested multi-file script to an exact self-contained output', async() => {
		// main sources a, a sources b; the slice pulls b's `K`, a's `M`, and the main-file use — all spliced into one file
		const { inlined } = await run('source("a")\ny <- M * 2\ncat(y)', [
			new FlowrInlineTextFile('a', 'source("b")\nM <- K + 1'),
			new FlowrInlineTextFile('b', 'K <- 5')
		], ['3@cat']);
		assert.strictEqual(inlined.code, 'K <- 5\nM <- K + 1\ny <- M * 2\ncat(y)');
		expect(inlined.inlineWarnings).toEqual([]);
	});

	test('the static-slice query surfaces inlineSources through its public flag', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
		analyzer.addRequest('source("a")\ncat(N)');
		analyzer.addFile(new FlowrInlineTextFile('a', 'N <- 9'));
		const out = await executeStaticSliceQuery({ analyzer }, [
			{ type: 'static-slice', criteria: ['2@N'], inlineSources: true }
		]);
		const [entry] = Object.values(out.results);
		assert.ok(entry && 'reconstruct' in entry, 'expected a reconstruction in the query result');
		const code = entry.reconstruct.code as string;
		expect(code).toContain('N <- 9');
		expect(code).not.toContain('source(');
		expect(entry.reconstruct.inlineWarnings).toEqual([]);
	});
});
