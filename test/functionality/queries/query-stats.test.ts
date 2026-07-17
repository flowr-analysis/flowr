import { assert, describe, test } from 'vitest';
import { asciiSummaryOfQueryResult } from '../../../src/queries/query-print';
import { voidFormatter } from '../../../src/util/text/ansi';
import { FlowrConfig } from '../../../src/config';
import type { ReadonlyFlowrAnalysisProvider } from '../../../src/project/flowr-analyzer';
import type { QueryResults } from '../../../src/queries/query';

const statLine = 'All queries together required';

/** the summary of a (trivial) config query, analyzed by an analyzer holding the given config */
function summaryWith(queryStats: boolean | undefined): Promise<string> {
	const config = FlowrConfig.amend(FlowrConfig.default(), c => {
		c.repl.queryStats = queryStats;
	});
	const analyzer = { flowrConfig: config } as ReadonlyFlowrAnalysisProvider;
	const results = {
		config:  { config, '.meta': { timing: 0 } },
		'.meta': { timing: 0 }
	} as unknown as QueryResults<'config'>;
	return asciiSummaryOfQueryResult(voidFormatter, 0, results, analyzer, [{ type: 'config' }]);
}

describe('repl.queryStats', () => {
	test('the stat line closes a summary by default', async() => {
		assert.include(await summaryWith(undefined), statLine, 'an unset option may not drop it');
		assert.include(await summaryWith(true), statLine);
	});

	test('disabled it is gone, so the output can be forwarded as it is', async() => {
		const summary = await summaryWith(false);
		assert.notInclude(summary, statLine);
		assert.include(summary, 'Config:', 'only the stat line goes, the summary stays');
	});
});
