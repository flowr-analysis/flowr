import { describe, test, assert } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { executeQueries } from '../../../src/queries/query';
import { TaintQueryDefinition } from '../../../src/queries/catalog/taint-query/taint-query-format';
import type { TaintQuery, TaintQueryResult } from '../../../src/queries/catalog/taint-query/taint-query-format';
import type { AnyPredefinedTaintAnalysisName } from '../../../src/taint-analysis/predefined/predefined';
import { voidFormatter } from '../../../src/util/text/ansi';
import { jsonReplacer } from '../../../src/util/json';

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
			const result = await runTaintQuery('x <- scale(x)', ['normalization-constant']);
			assert.deepStrictEqual([...result.results.keys()], ['normalization-constant']);
		});

		test('multiple predefined analyses', async() => {
			const result = await runTaintQuery('x <- scale(x)', ['normalization-constant', 'randomness']);
			assert.deepStrictEqual(new Set(result.results.keys()), new Set(['normalization-constant', 'randomness']));
		});

		test('empty defs array executes without error and yields no results', async() => {
			const result = await runTaintQuery('x <- 1', []);
			assert.strictEqual(result.results.size, 0);
		});

		test('findings are reflected in the result entry', async() => {
			const result = await runTaintQuery('x <- scale(x)\nx <- mean(x)', ['normalization-constant']);
			const findings = result.results.get('normalization-constant')?.findings;
			assert.strictEqual(result.results.get('normalization-constant')?.msg, undefined);
			assert.deepStrictEqual(findings, [
				{ nodeId: 10, loc: [2, 6, 2, 12], msg: 'mean calculated on normalized data [2.6-12]' },
				{ nodeId: 6, loc: [2, 1, 2, 1], msg: 'Known summary statistic calculated on normalized data [2.1]' }
			]);
		});
	});

	describe('Result Formatting', () => {
		test('jsonFormatter renders per-node domains alongside msg and findings', async() => {
			const result = await runTaintQuery('x <- scale(x)\nx <- mean(x)', ['normalization-constant']);
			const json = JSON.parse(JSON.stringify(TaintQueryDefinition.jsonFormatter(result), jsonReplacer)) as { results: [string, { domains: unknown, findings?: unknown, msg?: string }][] };
			assert.deepStrictEqual(json.results, [['normalization-constant', {
				domains:  { '0': 'z-Score', '4': 'z-Score', '6': 'bottom', '10': 'bottom' },
				findings: [
					{ nodeId: 10, loc: [2, 6, 2, 12], msg: 'mean calculated on normalized data [2.6-12]' },
					{ nodeId: 6, loc: [2, 1, 2, 1], msg: 'Known summary statistic calculated on normalized data [2.1]' }
				]
			}]]);
		});

		test('jsonFormatter renders normal domain', async() => {
			const result = await runTaintQuery('x <- scale(x)', ['normalization-constant']);
			const json = JSON.parse(JSON.stringify(TaintQueryDefinition.jsonFormatter(result), jsonReplacer)) as { results: [string, { domains: Record<string, string> }][] };
			const [name, { domains }] = json.results[0];
			assert.strictEqual(name, 'normalization-constant');
			assert.deepStrictEqual(new Set(Object.values(domains)), new Set(['z-Score']));
		});

		test('asciiSummarizer lists entries for normal result', async() => {
			const result = await runTaintQuery('x <- scale(x)', ['normalization-constant']);
			const lines: string[] = [];
			TaintQueryDefinition.asciiSummarizer(voidFormatter, undefined as never, result, lines);
			assert.ok(lines.some(line => line.includes('**normalization-constant**')));
			assert.ok(lines.some(line => line.includes('z-Score')));
		});

		test('asciiSummarizer reports msg and each finding location', async() => {
			const result = await runTaintQuery('x <- scale(x)\nx <- mean(x)', ['normalization-constant']);
			const lines: string[] = [];
			TaintQueryDefinition.asciiSummarizer(voidFormatter, undefined as never, result, lines);
			assert.ok(lines.some(line => line.includes('Known summary statistic calculated on normalized data')));
			assert.ok(lines.some(line => line.includes('mean calculated on normalized data')));
		});
	});

	describe('REPL Line Parsing & Completion', () => {
		const noopOutput = { stdout: () => {}, stderr: () => {} } as never;

		test('parses properly formatted query correctly', () => {
			const parsed = TaintQueryDefinition.fromLine(noopOutput, ['definitions:normalization-constant', 'x <- scale(x)'], undefined as never);
			assert.deepStrictEqual(parsed.query, [{ type: 'taint', defs: ['normalization-constant'] }]);
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
			const parsed = TaintQueryDefinition.fromLine(output, ['definitions:normalization-constant,bogus', 'x <- 1'], undefined as never);
			assert.deepStrictEqual(parsed.query, [{ type: 'taint', defs: ['normalization-constant'] }]);
			assert.ok(stderrMsg.includes('bogus'));
		});

		test('completer suggests not-yet-used definition names', () => {
			const completions = TaintQueryDefinition.completer(['definitions:normalization-constant,'], false, undefined as never);
			assert.deepStrictEqual(new Set(completions.completions), new Set(['normalization-reach', 'security', 'randomness', 'determinism']));
		});
	});
});
