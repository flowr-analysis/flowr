import {
	type LintingRuleConfig,
	type LintingRuleMetadata,
	type LintingRuleNames,
	type LintingRuleResult
	, LintingRules } from '../../../src/linter/linter-rules';
import { type TestLabel, decorateLabelContext } from './label';
import { assert, test } from 'vitest';
import { fileProtocol, requestFromInput } from '../../../src/r-bridge/retriever';
import { type NormalizedAst, deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeLintingRule } from '../../../src/linter/linter-executor';
import { type LintingRule, LintingPrettyPrintContext, LintingResults } from '../../../src/linter/linter-format';
import { log } from '../../../src/util/log';
import type { DeepPartial } from 'ts-essentials';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { type FlowrLaxSourcingOptions, DropPathsOption } from '../../../src/config';
import type { DataflowInformation } from '../../../src/dataflow/info';
import { graphToMermaidUrl } from '../../../src/util/mermaid/dfg';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrFileProvider } from '../../../src/project/context/flowr-file';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import type { SingleSlicingCriterion, SlicingCriteria } from '../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../src/slicing/criterion/parse';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';


/**
 * Asserts correct linting results while ignoring each linting result's {@link LintingRuleResult.involvedId}.
 */
export function assertLinter<Name extends LintingRuleNames>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	ruleName: Name,
	expected: Omit<LintingRuleResult<Name>, 'involvedId'>[] | ((df: DataflowInformation, ast: NormalizedAst) => Omit<LintingRuleResult<Name>, 'involvedId'>[]),
	expectedMetadata?: LintingRuleMetadata<Name>,
	lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>> & { useAsFilePath?: string, addFiles?: FlowrFileProvider[] }
) {
	assertLinterWithCleanup(name, parser, code, ruleName, expected, expectedMetadata, lintingRuleConfig, result => {
		if('involvedId' in result) {
			const { involvedId: _drop, ...rest } = result;
			return rest;
		}
		return result;
	});
}

/**
 * Asserts correct linting results, allowing for each {@link LintingRuleResult.involvedId} to be specified as a slicing criterion.
 */
export function assertLinterWithIds<Name extends LintingRuleNames>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	ruleName: Name,
	expected: (Omit<LintingRuleResult<Name>, 'involvedId'> & { involvedId: SlicingCriteria })[] | ((df: DataflowInformation, ast: NormalizedAst) => (Omit<LintingRuleResult<Name>, 'involvedId'> & { involvedId: SlicingCriteria })[]),
	expectedMetadata?: LintingRuleMetadata<Name>,
	lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>> & { useAsFilePath?: string, addFiles?: FlowrFileProvider[] }
) {
	assertLinterWithCleanup(name, parser, code, ruleName, expected, expectedMetadata, lintingRuleConfig, (result, ast) => ({
		...result,
		involvedId: (Array.isArray(result.involvedId) ? result.involvedId : result.involvedId !== undefined ? [result.involvedId] : []).map(s => {
			try {
				return slicingCriterionToId(s as SingleSlicingCriterion, ast.idMap);
			} catch{
				return s as NodeId;
			}
		}).sort()
	}) as LintingRuleResult<Name>);
}
/**
 * Asserts correct linting results, allowing for a custom cleanup function that determines what information from the linting result will be kept for comparison.
 */
function assertLinterWithCleanup<Name extends LintingRuleNames, Result>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	ruleName: Name,
	expected: Result[] | ((df: DataflowInformation, ast: NormalizedAst) => Result[]),
	expectedMetadata?: LintingRuleMetadata<Name>,
	lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>> & { useAsFilePath?: string, addFiles?: FlowrFileProvider[] },
	cleanup: (result: LintingRuleResult<Name> | Result, ast: NormalizedAst) => LintingRuleResult<Name> | Result = (r => r),
) {
	test(decorateLabelContext(name, ['linter']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setInput({
				getId: deterministicCountingIdGenerator(0)
			})
			.setParser(parser)
			.amendConfig(c => {
				(c.solver.resolveSource as FlowrLaxSourcingOptions) = {
					...c.solver.resolveSource as FlowrLaxSourcingOptions,
					dropPaths: DropPathsOption.All
				};
			})
			.build();
		if(lintingRuleConfig?.useAsFilePath) {
			analyzer.addFile(new FlowrInlineTextFile(lintingRuleConfig.useAsFilePath, code));
		}
		if(lintingRuleConfig?.addFiles) {
			analyzer.addFile(...lintingRuleConfig.addFiles);
		}
		analyzer.addRequest(lintingRuleConfig?.useAsFilePath ?
			requestFromInput(fileProtocol + lintingRuleConfig.useAsFilePath) :
			requestFromInput(code)
		);

		const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
		const results = await executeLintingRule(ruleName, analyzer, lintingRuleConfig);

		if(LintingResults.isError(results)) {
			throw new Error(results.error);
		}

		for(const [type, printer] of Object.entries({
			text: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => `${rule.prettyPrint[LintingPrettyPrintContext.Query](result, metadata)} (${result.certainty})${result.quickFix ? ` (${result.quickFix.length} quick fix(es) available)` : ''}`,
			json: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => JSON.stringify({ result, metadata })
		})) {
			log.info(`${type}:\n${results.results.map(r => `  ${printer(r, results['.meta'])}`).join('\n')}`);
		}

		const ast = await analyzer.normalize();
		if(typeof expected === 'function') {
			expected = expected(await analyzer.dataflow(), ast);
		}

		try {
			assert.deepEqual(results.results.map(r => cleanup(r, ast )), expected.map(r => cleanup(r, ast)), `Expected ${ruleName} to return ${JSON.stringify(expected)}, but got ${JSON.stringify(results)}`);
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
