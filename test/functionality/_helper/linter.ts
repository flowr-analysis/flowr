import {
	type LintingRuleConfig,
	type LintingRuleMetadata,
	type LintingRuleNames,
	type LintingRuleResult,
	LintingRules
} from '../../../src/linter/linter-rules';
import { decorateLabelContext, type TestLabel } from './label';
import { assert, test } from 'vitest';
import { fileProtocol, requestFromInput } from '../../../src/r-bridge/retriever';
import {
	deterministicCountingIdGenerator,
	type NormalizedAst
} from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeLintingRule } from '../../../src/linter/linter-executor';
import { LintingPrettyPrintContext, LintingResults, type LintingRule } from '../../../src/linter/linter-format';
import { log } from '../../../src/util/log';
import type { DeepPartial } from 'ts-essentials';
import type { KnownParser } from '../../../src/r-bridge/parser';
import type { DataflowInformation } from '../../../src/dataflow/info';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrFileProvider } from '../../../src/project/context/flowr-file';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import type { SlicingCriteria } from '../../../src/slicing/criterion/parse';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import { DropPathsOption } from '../../../src/config';
import { Dataflow } from '../../../src/dataflow/graph/df-helper';
import type { PkgDbSource } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-pkgdb-plugin';
import { FlowrAnalyzerPackageVersionsPkgDbPlugin, PkgDbPluginName } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-pkgdb-plugin';
import type { PkgDb } from '../../../src/project/plugins/package-version-plugins/pkgdb';

/** options steering the analyzer setup of a linter test (kept separate from the linting rule config) */
export type LinterTestSetup = { useAsFilePath?: string, addFiles?: FlowrFileProvider[], pkgDb?: PkgDbSource, noPkgDb?: boolean };

/** a minimal in-memory `latest`-scope package database exporting `exports` from `pkg` (so tests do not rely on the bundled one) */
export function controlledPkgDb(pkg: string, exports: readonly string[]): PkgDb {
	return {
		format:  'flowr-pkgdb', schema:  4, scope:   'latest',
		content: { version: 1, date: '2026-01-01', hash: 'x', generated: 0, packages: 1, versions: 1 },
		strings: [], pkgs:    { [pkg]: ['1.0.0', [...exports]] }
	};
}


type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/**
 * Asserts correct linting results while ignoring each linting result's {@link LintingRuleResult.involvedId}.
 */
export function assertLinter<Name extends LintingRuleNames>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	ruleName: Name,
	expected: DistributiveOmit<LintingRuleResult<Name>, 'involvedId'>[] | ((df: DataflowInformation, ast: NormalizedAst) => Omit<LintingRuleResult<Name>, 'involvedId'>[]),
	expectedMetadata?: LintingRuleMetadata<Name>,
	lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>> & LinterTestSetup
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
	lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>> & LinterTestSetup
) {
	assertLinterWithCleanup(name, parser, code, ruleName, expected, expectedMetadata, lintingRuleConfig, (result, ast) => ({
		...result,
		involvedId: (Array.isArray(result.involvedId) ? result.involvedId : result.involvedId !== undefined ? [result.involvedId] : []).map(s => {
			try {
				return SlicingCriterion.parse(s as SlicingCriterion, ast.idMap);
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
	lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>> & LinterTestSetup,
	cleanup: (result: LintingRuleResult<Name> | Result, ast: NormalizedAst) => LintingRuleResult<Name> | Result = (r => r),
) {
	test(decorateLabelContext(name, ['linter']), async() => {
		let builder = new FlowrAnalyzerBuilder()
			.setInput({
				getId: deterministicCountingIdGenerator(0)
			})
			.setParser(parser)
			.configure('solver.resolveSource.dropPaths', DropPathsOption.All);
		// swap in a controlled package database (or none) so tests do not depend on the bundled collection
		if(lintingRuleConfig?.pkgDb !== undefined) {
			builder = builder.unregisterPlugins(PkgDbPluginName).registerPlugins(new FlowrAnalyzerPackageVersionsPkgDbPlugin(lintingRuleConfig.pkgDb));
		} else if(lintingRuleConfig?.noPkgDb) {
			builder = builder.unregisterPlugins(PkgDbPluginName);
		}
		const analyzer = await builder.build();
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
		const results = LintingResults.unpackSuccess(await executeLintingRule(ruleName, analyzer, lintingRuleConfig));

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
			console.error('dfg:', Dataflow.visualize.mermaid.url((await analyzer.dataflow()).graph));
			console.error('cfg:', cfgToMermaidUrl(await analyzer.controlflow(), await analyzer.normalize()));
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
