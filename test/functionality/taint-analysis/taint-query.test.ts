import { describe, test, assert } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { executeQueries } from '../../../src/queries/query';
import { TaintQueryDefinition } from '../../../src/queries/catalog/taint-query/taint-query-format';
import type { TaintQuery, TaintQueryResult } from '../../../src/queries/catalog/taint-query/taint-query-format';
import type { AnyPredefinedTaintAnalysisName } from '../../../src/taint-analysis/predefined/predefined';
import { jsonReplacer } from '../../../src/util/json';
import { voidFormatter } from '../../../src/util/text/ansi';

async function runTaintQuery(code: string, defs: AnyPredefinedTaintAnalysisName[]): Promise<TaintQueryResult<string[]>> {
	const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
	analyzer.addRequest(code.trim());
	const query: TaintQuery = { type: 'taint', defs };
	const result = await executeQueries({ analyzer }, [query]);
	return result.taint;
}

describe('Taint Query', () => {
	describe('Execution', () => {
		test('single predefined analysis', async() => {
			const result = await runTaintQuery('x <- scale(x)', ['scale']);
			assert.deepStrictEqual([...result.results.keys()], ['scale']);
		});

		test('multiple predefined analyses', async() => {
			const result = await runTaintQuery('x <- scale(x)', ['scale', 'randomness']);
			assert.deepStrictEqual(new Set(result.results.keys()), new Set(['scale', 'randomness']));
		});

		test('empty defs array executes without error and yields no results', async() => {
			const result = await runTaintQuery('x <- 1', []);
			assert.strictEqual(result.results.size, 0);
		});

		test('finding is reflected in the result entry', async() => {
			const result = await runTaintQuery('x <- scale(x)\nx <- mean(x)', ['scale']);
			assert.strictEqual(result.results.get('scale')?.finding, 'Aggregation of scaled data yields a known constant');
			assert.strictEqual(result.results.get('scale')?.domains.isBottom(), true);
		});
	});

	describe('Result Formatting', () => {
		test('jsonFormatter renders Bottom domain alongside finding', async() => {
			const result = await runTaintQuery('x <- scale(x)\nx <- mean(x)', ['scale']);
			const json = JSON.parse(JSON.stringify(TaintQueryDefinition.jsonFormatter(result), jsonReplacer)) as { results: [string, { domains: unknown, finding?: string }][] };
			assert.deepStrictEqual(json.results, [['scale', { domains: 'bottom', finding: 'Aggregation of scaled data yields a known constant' }]]);
		});

		test('jsonFormatter renders normal domain', async() => {
			const result = await runTaintQuery('x <- scale(x)', ['scale']);
			const json = JSON.parse(JSON.stringify(TaintQueryDefinition.jsonFormatter(result), jsonReplacer)) as { results: [string, { domains: Record<string, string> }][] };
			const [name, { domains }] = json.results[0];
			assert.strictEqual(name, 'scale');
			assert.deepStrictEqual(new Set(Object.values(domains)), new Set(['z-Score']));
		});

		test('asciiSummarizer lists entries for normal result', async() => {
			const result = await runTaintQuery('x <- scale(x)', ['scale']);
			const lines: string[] = [];
			TaintQueryDefinition.asciiSummarizer(voidFormatter, undefined as never, result, lines);
			assert.ok(lines.some(line => line.includes('**scale**')));
			assert.ok(lines.some(line => line.includes('z-Score')));
		});

		test('asciiSummarizer reports finding and Bottom state', async() => {
			const result = await runTaintQuery('x <- scale(x)\nx <- mean(x)', ['scale']);
			const lines: string[] = [];
			TaintQueryDefinition.asciiSummarizer(voidFormatter, undefined as never, result, lines);
			assert.ok(lines.some(line => line.includes('finding: Aggregation of scaled data yields a known constant')));
			assert.ok(lines.some(line => line.includes('state:')));
		});
	});

	describe('REPL Line Parsing & Completion', () => {
		const noopOutput = { stdout: () => {}, stderr: () => {} } as never;

		test('parses properly formatted query correctly', () => {
			const parsed = TaintQueryDefinition.fromLine(noopOutput, ['definitions:scale', 'x <- scale(x)'], undefined as never);
			assert.deepStrictEqual(parsed.query, [{ type: 'taint', defs: ['scale'] }]);
			assert.strictEqual(parsed.rCode, 'x <- scale(x)');
		});

		test('parses line with only R code', () => {
			const parsed = TaintQueryDefinition.fromLine(noopOutput, ['x <- scale(x)'], undefined as never);
			assert.deepStrictEqual(parsed.query, [{ type: 'taint', defs: [] }]);
			assert.strictEqual(parsed.rCode, 'x <- scale(x)');
		});

		test('unknown definition name is dropped and reported via stderr', () => {
			let stderrMsg = '';
			const output = { stdout: () => {}, stderr: (s: string) => {
				stderrMsg = s;
			} } as never;
			const parsed = TaintQueryDefinition.fromLine(output, ['definitions:scale,bogus', 'x <- 1'], undefined as never);
			assert.deepStrictEqual(parsed.query, [{ type: 'taint', defs: ['scale'] }]);
			assert.ok(stderrMsg.includes('bogus'));
		});

		test('completer suggests not-yet-used definition names', () => {
			const completions = TaintQueryDefinition.completer(['definitions:scale,'], false, undefined as never);
			assert.deepStrictEqual(new Set(completions.completions), new Set(['security', 'randomness', 'determinism']));
		});
	});
});
