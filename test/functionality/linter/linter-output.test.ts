import { assert, describe, test, vi } from 'vitest';
import { formatLints, LinterOutputFormat } from '../../../src/linter/linter-output';
import type { LinterQueryResult } from '../../../src/queries/catalog/linter-query/linter-query-format';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

/** the parts of a sarif log this suite asserts on */
interface Sarif {
	version: string
	runs:    [{
		tool:    { driver: { name: string, version: string, rules: { id: string }[] } }
		results: {
			ruleId:    string
			level:     string
			message:   { text: string }
			locations: { physicalLocation: { artifactLocation: { uri: string }, region: object } }[]
		}[]
	}]
}

function sarifOf(results: LinterQueryResult['results'], version = '1.2.3'): Sarif {
	return JSON.parse(formatLints(results, LinterOutputFormat.Sarif, version) as string) as Sarif;
}

function githubOf(results: LinterQueryResult['results']): string {
	return formatLints(results, LinterOutputFormat.Github, '1.2.3') as string;
}

/** a result of the `undefined-symbol` rule, whose pretty print only needs the location and the name */
function undefinedSymbol(certainty: LintingResultCertainty, file?: string): LinterQueryResult['results'] {
	return {
		'undefined-symbol': {
			results: [{
				certainty,
				involvedId: 0,
				loc:        [3, 7, 3, 9, ...(file ? [file] : [])],
				name:       'zzz'
			}],
			'.meta': { searchTimeMs: 0, processTimeMs: 0, totalRelevant: 1 }
		}
	} as unknown as LinterQueryResult['results'];
}

describe('Linter output', () => {
	describe('sarif', () => {
		test('it is valid sarif naming flowR, the rule, and the region', () => {
			const sarif = sarifOf(undefinedSymbol(LintingResultCertainty.Certain, '/p/a.R'));
			assert.strictEqual(sarif.version, '2.1.0');
			const driver = sarif.runs[0].tool.driver;
			assert.strictEqual(driver.name, 'flowR');
			assert.strictEqual(driver.version, '1.2.3');
			assert.deepStrictEqual(driver.rules.map(r => r.id), ['undefined-symbol'],
				'only a rule that reported has to be declared');
			const [result] = sarif.runs[0].results;
			assert.strictEqual(result.ruleId, 'undefined-symbol');
			assert.strictEqual(result.level, 'warning', 'a certain finding is a warning');
			const location = result.locations[0].physicalLocation;
			assert.strictEqual(location.artifactLocation.uri, '/p/a.R');
			assert.deepStrictEqual(location.region, { startLine: 3, startColumn: 7, endLine: 3, endColumn: 9 });
		});

		test('an uncertain finding is only a note', () => {
			const sarif = sarifOf(undefinedSymbol(LintingResultCertainty.Uncertain, '/p/a.R'));
			assert.strictEqual(sarif.runs[0].results[0].level, 'note');
		});

		test('a finding without a file is reported without a location, not with a broken one', () => {
			const sarif = sarifOf(undefinedSymbol(LintingResultCertainty.Certain));
			assert.deepStrictEqual(sarif.runs[0].results[0].locations, []);
		});

		test('a rule that threw is reported as an error, not swallowed', () => {
			const sarif = sarifOf({ 'undefined-symbol': { error: new Error('boom') } } as unknown as LinterQueryResult['results']);
			const [result] = sarif.runs[0].results;
			assert.strictEqual(result.level, 'error');
			assert.include(result.message.text, 'boom');
		});
	});

	describe('github', () => {
		test('a finding becomes an annotation carrying its file and position', () => {
			const out = githubOf(undefinedSymbol(LintingResultCertainty.Certain, '/p/a.R'));
			assert.include(out, '::warning ');
			assert.include(out, 'file=/p/a.R,line=3,col=7,endLine=3,endColumn=9');
			assert.include(out, 'title=undefined-symbol::');
		});

		test('a file of the workspace is named relative to it, as github annotates nothing else', () => {
			vi.stubEnv('GITHUB_WORKSPACE', '/p');
			try {
				assert.include(githubOf(undefinedSymbol(LintingResultCertainty.Certain, '/p/R/a.R')), 'file=R/a.R,line=3');
				assert.strictEqual(sarifOf(undefinedSymbol(LintingResultCertainty.Certain, '/p/R/a.R'))
					.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'R/a.R');
			} finally {
				vi.unstubAllEnvs();
			}
		});

		test('a file outside the workspace keeps its path, it has nothing to attach to', () => {
			vi.stubEnv('GITHUB_WORKSPACE', '/p');
			try {
				assert.include(githubOf(undefinedSymbol(LintingResultCertainty.Certain, '/other/a.R')), 'file=/other/a.R,line=3');
			} finally {
				vi.unstubAllEnvs();
			}
		});

		test('an uncertain finding is only a notice, and one without a file carries no position', () => {
			assert.include(githubOf(undefinedSymbol(LintingResultCertainty.Uncertain, '/p/a.R')), '::notice ');
			const noFile = githubOf(undefinedSymbol(LintingResultCertainty.Certain));
			assert.notInclude(noFile, 'file=');
			assert.include(noFile, '::warning title=');
		});

		test('a newline in a message is escaped, as it would end the command', () => {
			const out = githubOf({
				'undefined-symbol': { error: new Error('a\nb\rc%d') }
			} as unknown as LinterQueryResult['results']);
			assert.include(out, 'a%0Ab%0Dc%25d');
			assert.strictEqual(out.split('\n').length, 1, 'the annotation stays on one line');
		});
	});

	test('the default format is flowR\'s own summary, which it renders itself', () => {
		assert.deepStrictEqual(Object.values(LinterOutputFormat), ['text', 'sarif', 'github']);
		assert.isUndefined(formatLints(undefinedSymbol(LintingResultCertainty.Certain), LinterOutputFormat.Text, '1.2.3'));
		assert.isDefined(formatLints(undefinedSymbol(LintingResultCertainty.Certain), LinterOutputFormat.Sarif, '1.2.3'));
	});
});
