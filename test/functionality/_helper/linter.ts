import type { LintingRuleConfig, LintingRuleMetadata, LintingRuleNames, LintingRuleResult } from '../../../src/linter/linter-rules';
import { LintingRules } from '../../../src/linter/linter-rules';
import type { TestLabel } from './label';
import { decorateLabelContext } from './label';
import { assert, test } from 'vitest';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import type {
	NormalizedAst
} from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	deterministicCountingIdGenerator
} from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeLintingRule } from '../../../src/linter/linter-executor';
import type { LintingRule } from '../../../src/linter/linter-format';
import { LintingPrettyPrintContext } from '../../../src/linter/linter-format';
import { log } from '../../../src/util/log';
import type { DeepPartial } from 'ts-essentials';
import type { KnownParser } from '../../../src/r-bridge/parser';
import type { DataflowInformation } from '../../../src/dataflow/info';
import { graphToMermaidUrl } from '../../../src/util/mermaid/dfg';

export function assertLinter<Name extends LintingRuleNames>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	ruleName: Name,
	expected: LintingRuleResult<Name>[] | ((df: DataflowInformation, ast: NormalizedAst) => LintingRuleResult<Name>[]),
	expectedMetadata?: LintingRuleMetadata<Name>,
	config?: DeepPartial<LintingRuleConfig<Name>> & { useAsFilePath?: string }
) {
	test(decorateLabelContext(name, ['linter']), async() => {
		const pipelineResults = await createDataflowPipeline(parser, {
			request:           requestFromInput(code),
			getId:             deterministicCountingIdGenerator(0),
			overwriteFilePath: config?.useAsFilePath
		}).allRemainingSteps();

		const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
		const results = executeLintingRule(ruleName, pipelineResults, config);

		for(const [type, printer] of Object.entries({
			text: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => `${rule.prettyPrint[LintingPrettyPrintContext.Query](result, metadata)} (${result.certainty})${result.quickFix ? ` (${result.quickFix.length} quick fix(es) available)` : ''}`,
			json: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => JSON.stringify({ result, metadata })
		})) {
			log.info(`${type}:\n${results.results.map(r => `  ${printer(r, results['.meta'])}`).join('\n')}`);
		}

		if(typeof expected === 'function') {
			expected = expected(pipelineResults.dataflow, pipelineResults.normalize);
		}

		try {
			assert.deepEqual(results.results, expected, `Expected ${ruleName} to return ${JSON.stringify(expected)}, but got ${JSON.stringify(results)}`);
		} catch(e) {
			console.error('dfg:', graphToMermaidUrl(pipelineResults.dataflow.graph));
			throw e;
		}
		if(expectedMetadata !== undefined) {
			// eslint-disable-next-line unused-imports/no-unused-vars
			const { searchTimeMs, processTimeMs, ...strippedMeta } = results['.meta'];
			assert.deepEqual(strippedMeta as unknown as LintingRuleMetadata<Name>, expectedMetadata,
				`Expected ${ruleName} to have metadata ${JSON.stringify(expectedMetadata)}, but got ${JSON.stringify(results['.meta'])}`);
		}
	});
}
