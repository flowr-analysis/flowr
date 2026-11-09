import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { asciiSummaryOfQueryResult } from '../../../src/queries/query-print';
import { ansiFormatter } from '../../../src/util/text/ansi';
import { AmbientProjectKey } from '../../../src/queries/catalog/ambient-access-query/ambient-access-query-format';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';

describe('Ambient Access Query', withTreeSitter(parser => {
	async function analyzerFor(code: string) {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(requestFromInput(code));
		return analyzer;
	}

	test(label('a snippet answers as one file and as the project', ['name-normal'], ['other']), async() => {
		const analyzer = await analyzerFor('options(digits = 3)');
		const { results } = await analyzer.query({ type: 'ambient-access' });
		assert.deepStrictEqual(Object.keys(results).sort(), [AmbientProjectKey, '<file 1>'].sort());
		assert.deepStrictEqual(results['<file 1>'].writes, ['#option:digits', '#options']);
		assert.deepStrictEqual(results[AmbientProjectKey], results['<file 1>']);
	});

	test(label('files on disk answer each, a call reaching into another file', ['name-normal', 'sourcing-external-files'], ['other']), async() => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ambient-'));
		const a = path.join(dir, 'a.R'), b = path.join(dir, 'b.R');
		fs.writeFileSync(a, 'f <- function() { options(digits = 3); g <<- 1 }\n');
		fs.writeFileSync(b, 'f()\nsink("o.txt")\n');
		try {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(requestFromInput([`file://${a}`, `file://${b}`]));
			const { results, functions } = await analyzer.query({ type: 'ambient-access', functions: true });
			assert.deepStrictEqual(results[a].writes, [], 'defining f changes nothing');
			assert.includeMembers([...results[b].writes], ['#option:digits', '#sink']);
			assert.deepStrictEqual(results[b].variables, ['g']);
			assert.deepStrictEqual(results[AmbientProjectKey].writes, results[b].writes);
			assert.deepStrictEqual(Object.values(functions ?? {}).map(f => f.writes), [['#option:digits', '#options']]);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test(label('files given to the analyzer as text answer each', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addFile(new FlowrInlineTextFile('a.R', 'f <- function() options(digits = 3)'), new FlowrInlineTextFile('b.R', 'f()'));
		analyzer.addRequest({ request: 'file', content: 'a.R' }, { request: 'file', content: 'b.R' });
		const { results } = await analyzer.query({ type: 'ambient-access' });
		assert.deepStrictEqual(results['a.R'].writes, []);
		assert.deepStrictEqual(results['b.R'].writes, ['#option:digits', '#options']);
	});

	test(label('criteria answer for the code their node spans', ['name-normal'], ['other']), async() => {
		const analyzer = await analyzerFor('x <- 1\n{\n options(digits = 3)\n Sys.setenv(A = "1")\n}\nsink("o.txt")');
		const { results } = await analyzer.query({ type: 'ambient-access', criteria: ['1^', '2^', '$0'] });
		assert.deepStrictEqual(results['1^'].writes, []);
		assert.deepStrictEqual(results['2^'].writes, ['#env', '#env:A', '#option:digits', '#options']);
		assert.notInclude(results['2^'].writes, '#sink');
	});

	test(label('includeCallees false only counts the calls of the scope', ['name-normal'], ['other']), async() => {
		const analyzer = await analyzerFor('f <- function() options(digits = 3)\nf()');
		const { results } = await analyzer.query({ type: 'ambient-access', criteria: ['2^'], includeCallees: false });
		assert.deepStrictEqual(results['2^'].writes, ['#sink:output']);
	});

	test(label('the summary names each scope', ['name-normal'], ['other']), async() => {
		const analyzer = await analyzerFor('options(digits = 3)');
		const query = [{ type: 'ambient-access' }] as const;
		const results = await analyzer.query(query);
		const summary = await asciiSummaryOfQueryResult(ansiFormatter, 0, results, analyzer, query);
		assert.include(summary, AmbientProjectKey);
		assert.include(summary, '#option:digits');
	});
}));
