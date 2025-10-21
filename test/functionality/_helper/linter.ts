import type {
	LintingRuleConfig,
	LintingRuleMetadata,
	LintingRuleNames,
	LintingRuleResult
} from '../../../src/linter/linter-rules';
import { LintingRules } from '../../../src/linter/linter-rules';
import type { TestLabel } from './label';
import { decorateLabelContext } from './label';
import { assert, test } from 'vitest';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import type { NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeLintingRule } from '../../../src/linter/linter-executor';
import type { LintingRule } from '../../../src/linter/linter-format';
import { isLintingResultsError, LintingPrettyPrintContext } from '../../../src/linter/linter-format';
import { log } from '../../../src/util/log';
import type { DeepPartial } from 'ts-essentials';
import type { KnownParser } from '../../../src/r-bridge/parser';
import type { FlowrLaxSourcingOptions } from '../../../src/config';
import { DropPathsOption } from '../../../src/config';
import type { DataflowInformation } from '../../../src/dataflow/info';
import { graphToMermaidUrl } from '../../../src/util/mermaid/dfg';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';

export function assertLinter<Name extends LintingRuleNames>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	ruleName: Name,
	expected: LintingRuleResult<Name>[] | ((df: DataflowInformation, ast: NormalizedAst) => LintingRuleResult<Name>[]),
	expectedMetadata?: LintingRuleMetadata<Name>,
	lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>> & { useAsFilePath?: string }
) {
	test(decorateLabelContext(name, ['linter']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder(requestFromInput(code))
			.setInput({
				getId:             deterministicCountingIdGenerator(0),
				overwriteFilePath: lintingRuleConfig?.useAsFilePath
			})
			.setParser(parser)
			.amendConfig(c => {
				(c.solver.resolveSource as FlowrLaxSourcingOptions) = {
					...c.solver.resolveSource as FlowrLaxSourcingOptions,
					dropPaths: DropPathsOption.All
				};
			})
			.build();

		const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
		const results = await executeLintingRule(ruleName, analyzer, lintingRuleConfig);

		if(isLintingResultsError(results)) {
			throw new Error(results.error);
		}

		for(const [type, printer] of Object.entries({
			text: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => `${rule.prettyPrint[LintingPrettyPrintContext.Query](result, metadata)} (${result.certainty})${result.quickFix ? ` (${result.quickFix.length} quick fix(es) available)` : ''}`,
			json: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => JSON.stringify({ result, metadata })
		})) {
			log.info(`${type}:\n${results.results.map(r => `  ${printer(r, results['.meta'])}`).join('\n')}`);
		}

		if(typeof expected === 'function') {
			expected = expected(await analyzer.dataflow(), await analyzer.normalize());
		}

		try {
			assert.deepEqual(results.results, expected, `Expected ${ruleName} to return ${JSON.stringify(expected)}, but got ${JSON.stringify(results)}`);
		} catch(e) {
			console.error('dfg:', graphToMermaidUrl((await analyzer.dataflow()).graph));
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
