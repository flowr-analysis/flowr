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
			fixes?:    {
				description:     { text: string }
				artifactChanges: { artifactLocation: { uri: string }, replacements: { deletedRegion: object, insertedContent: { text: string } }[] }[]
			}[]
		}[]
	}]
}

function sarifOf(results: LinterQueryResult['results'], version = '1.2.3'): Sarif {
	return JSON.parse(formatLints(results, LinterOutputFormat.Sarif, version) as string) as Sarif;
}

function githubOf(results: LinterQueryResult['results']): string {
	return formatLints(results, LinterOutputFormat.Github, '1.2.3') as string;
}

/** a result of the `unused-import` rule, which is one of the rules offering a quick fix */
function unusedImport(file?: string, withFix = true): LinterQueryResult['results'] {
	const loc = [2, 1, 2, 10, ...(file ? [file] : [])];
	return {
		'unused-import': {
			results: [{
				certainty:  LintingResultCertainty.Uncertain,
				involvedId: 0,
				loc,
				package:    'ggplot2',
				version:    '3.5.1',
				quickFix:   withFix ? [{ type: 'remove', description: 'Remove the unused import of ggplot2', loc }] : undefined
			}],
			'.meta': { searchTimeMs: 0, processTimeMs: 0, totalConsidered: 1, totalUnresolved: 0, totalMultiPackage: 0, totalUnused: 1 }
		}
	} as unknown as LinterQueryResult['results'];
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
			const sarif = sarifOf({ 'undefined-symbol': { error: new Error('boom') } });
			const [result] = sarif.runs[0].results;
			assert.strictEqual(result.level, 'error');
			assert.include(result.message.text, 'boom');
		});

		test('a quick fix becomes a sarif fix naming the region it changes', () => {
			const [result] = sarifOf(unusedImport('/p/a.R')).runs[0].results;
			assert.lengthOf(result.fixes ?? [], 1);
			const [fix] = result.fixes as NonNullable<typeof result.fixes>;
			assert.strictEqual(fix.description.text, 'Remove the unused import of ggplot2');
			const [change] = fix.artifactChanges;
			assert.strictEqual(change.artifactLocation.uri, '/p/a.R');
			assert.deepStrictEqual(change.replacements[0].deletedRegion,
				{ startLine: 2, startColumn: 1, endLine: 2, endColumn: 10 });
			assert.strictEqual(change.replacements[0].insertedContent.text, '');
		});

		test('a finding without a quick fix carries no fixes at all', () => {
			assert.isUndefined(sarifOf(unusedImport('/p/a.R', false)).runs[0].results[0].fixes);
		});

		test('a fix flowR cannot locate is left out', () => {
			assert.isUndefined(sarifOf(unusedImport()).runs[0].results[0].fixes);
		});

		test('a fix naming no place is left out, rather than reported as an invalid region', () => {
			const results = {
				'unused-import': {
					results: [{
						certainty:  LintingResultCertainty.Uncertain, involvedId: 0, loc:        [2, 1, 2, 10, '/p/a.R'],
						package:    'ggplot2', version:    '3.5.1',
						quickFix:   [{ type: 'remove', description: 'drop it', loc: [-1, -1, -1, -1, '/p/a.R'] }]
					}],
					'.meta': {}
				}
			} as unknown as LinterQueryResult['results'];
			assert.isUndefined(sarifOf(results).runs[0].results[0].fixes);
		});
	});

	describe('github', () => {
		test('a finding becomes an annotation carrying its file and position', () => {
			const out = githubOf(undefinedSymbol(LintingResultCertainty.Certain, '/p/a.R'));
			assert.include(out, '::warning ');
			assert.include(out, 'file=/p/a.R,line=3,col=7,endLine=3,endColumn=9');
			assert.include(out, 'title=undefined-symbol::');
		});

		test('a quick fix is offered in the message, as an annotation carries none of its own', () => {
			assert.include(githubOf(unusedImport('/p/a.R')), '[quick fix: Remove the unused import of ggplot2]');
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
			});
			assert.include(out, 'a%0Ab%0Dc%25d');
			assert.strictEqual(out.split('\n').length, 1, 'the annotation stays on one line');
		});
	});

	test('a format nobody taught it about is refused, not rendered as no output', () => {
		assert.throws(
			() => formatLints(undefinedSymbol(LintingResultCertainty.Certain), 'yaml' as LinterOutputFormat, '1.2.3'),
			/Unexpected object/
		);
	});

	test('the default format is flowR\'s own summary, which it renders itself', () => {
		assert.deepStrictEqual(Object.values(LinterOutputFormat), ['text', 'sarif', 'github']);
		assert.isUndefined(formatLints(undefinedSymbol(LintingResultCertainty.Certain), LinterOutputFormat.Text, '1.2.3'));
		assert.isDefined(formatLints(undefinedSymbol(LintingResultCertainty.Certain), LinterOutputFormat.Sarif, '1.2.3'));
	});
});
