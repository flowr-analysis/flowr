import type { LintingResult, LintingRule } from '../../../src/linter/linter-format';
import type { MergeableRecord } from '../../../src/util/objects';
import type { TestLabel } from './label';
import { decorateLabelContext } from './label';
import type { RShell } from '../../../src/r-bridge/shell';
import { assert, test } from 'vitest';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { runSearch } from '../../../src/search/flowr-search-executor';
import { FlowrSearchElements } from '../../../src/search/flowr-search';

export function assertLinter<Result extends LintingResult, Config extends MergeableRecord>(
	name: string | TestLabel,
	shell: RShell,
	code: string,
	rule: LintingRule<Result, Config>,
	expected: Result[],
	config = rule.defaultConfig
) {
	test(decorateLabelContext(name, ['linter']), async() => {
		const results = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			parser:  shell,
			request: requestFromInput(code),
			getId:   deterministicCountingIdGenerator(0)
		}).allRemainingSteps();

		const ruleSearch = rule.createSearch(config);
		const searchResult = runSearch(ruleSearch, results);
		const ruleResults = rule.processSearchResult(new FlowrSearchElements(searchResult), config);

		for(const [type, printer] of Object.entries(rule.printers)){
			console.log(`${type}:\n${ruleResults.map(r => `  ${printer(r, config)}`).join('\n')}`);
		}

		assert.deepEqual(ruleResults, expected,
			`Expected ${rule.name} to return ${JSON.stringify(expected)}, but got ${JSON.stringify(ruleResults)}`);
	});
}
