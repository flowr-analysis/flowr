import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { CodeClonesQueryDefinition, type CodeClonesQueryResult } from '../../../src/queries/catalog/code-clones-query/code-clones-query-format';
import { CloneAlgorithm } from '../../../src/clones/clone-detector';
import { ClonePerspective } from '../../../src/clones/clone-ast';
import type { ReplOutput } from '../../../src/cli/repl/commands/repl-main';
import { FlowrConfig } from '../../../src/config';
import type { SerializedCloneIndex } from '../../../src/clones/clone-index';

describe('Code Clones Query', withTreeSitter(parser => {
	const a = 'normalize <- function(v) {\n  m <- mean(v)\n  s <- sd(v)\n  out <- (v - m) / s\n  out[is.na(out)] <- 0\n  out\n}';
	const b = 'scale_it <- function(values) {\n  mu <- mean(values)\n  sigma <- sd(values)\n  res <- (values - mu) / sigma\n  res[is.na(res)] <- 0\n  res\n}';
	async function run(code: string, query: Record<string, unknown>): Promise<CodeClonesQueryResult> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(requestFromInput(code));
		const result = await analyzer.query([{ type: 'code-clones', ...query } as never]);
		return result['code-clones'];
	}
	test('finds the clone pair', async() => {
		const r = await run(`${a}\n${b}`, { algorithms: [CloneAlgorithm.Gst, CloneAlgorithm.Winnowing] });
		assert.deepStrictEqual(r.pairs.map(p => p.algorithm).sort(), [CloneAlgorithm.Gst, CloneAlgorithm.Winnowing]);
	});
	test('an exported index can be searched against', async() => {
		const index = (await run(a, { exportIndex: true })).index as SerializedCloneIndex;
		const r = await run(b, { against: [JSON.parse(JSON.stringify(index))] });
		assert.lengthOf(r.pairs, 1);
		assert.isTrue(r.pairs[0].a.external ?? r.pairs[0].b.external);
	});
	test('an index of another perspective is rejected', async() => {
		const index = (await run(a, { exportIndex: true, perspective: ClonePerspective.Syntax })).index as SerializedCloneIndex;
		const r = await run(b, { against: [index], perspective: ClonePerspective.Canonical }) as unknown as { error?: string, pairs?: unknown };
		assert.isUndefined(r.pairs);
	});
	test('the perspective follows the index searched against', async() => {
		const index = (await run(a, { exportIndex: true, perspective: ClonePerspective.Syntax })).index as SerializedCloneIndex;
		assert.lengthOf((await run(b, { against: [index] })).pairs, 1);
	});
	test('the line parser only takes leading algorithm names', () => {
		const parsed = CodeClonesQueryDefinition.fromLine({} as ReplOutput, ['gst', 'baxter', 'x', '<-', 'gst'], FlowrConfig.default());
		assert.deepStrictEqual(parsed.query, [{ type: 'code-clones', algorithms: [CloneAlgorithm.Gst, CloneAlgorithm.Baxter] }]);
		assert.strictEqual(parsed.rCode, 'x <- gst');
	});
	test('the schema rejects malformed indices', () => {
		assert.isDefined(CodeClonesQueryDefinition.schema.validate({ type: 'code-clones', against: [{ format: 'flowr-clone-index', version: 2 }] }).error);
	});
}));
