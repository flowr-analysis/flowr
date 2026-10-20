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
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import { DropPathsOption } from '../../../src/config';
import { Dataflow } from '../../../src/dataflow/graph/df-helper';
import type { SigDbSource } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import type { PackageSignatureSource } from '../../../src/project/sigdb/reader';
import type { LibraryExports } from '../../../src/project/sigdb/schema';
import { applyAssumedPackages, assumedPackagesOf } from './shell';

/** options steering the analyzer setup of a linter test (kept separate from the linting rule config) */
export type LinterTestSetup = { useAsFilePath?: string, addFiles?: FlowrFileProvider[], sigDb?: SigDbSource, noSigDb?: boolean, assumeLoaded?: readonly string[] };

/** `builder` with `sigDb` in place of the bundled signature database. */
export function withSigDb(builder: FlowrAnalyzerBuilder, sigDb: SigDbSource): FlowrAnalyzerBuilder {
	return builder.unregisterPlugins(SigDbPluginName).registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(sigDb));
}

/** a minimal in-memory signature source exporting the given `pkg -> exports` (so tests do not rely on the bundled one) */
export function controlledSigDb(pkgs: Record<string, readonly string[]>): PackageSignatureSource;
export function controlledSigDb(pkg: string, exports: readonly string[]): PackageSignatureSource;
export function controlledSigDb(pkgOrPkgs: string | Record<string, readonly string[]>, exports?: readonly string[]): PackageSignatureSource {
	const pkgs = typeof pkgOrPkgs === 'string' ? { [pkgOrPkgs]: exports ?? [] } : pkgOrPkgs;
	const view = (pkg: string): LibraryExports | undefined => pkg in pkgs
		? { version: '1.0.0', exported: [...pkgs[pkg]], internal: [], deprecated: [], s3Classes: [], s4Classes: [], cran: true }
		: undefined;
	return {
		has:               pkg => pkg in pkgs,
		hasVersion:        (pkg, version) => pkg in pkgs && version === '1.0.0',
		isCranVersion:     () => true,
		sourceOf:          () => undefined,
		lookup:            pkg => view(pkg),
		classOwner:        () => undefined,
		packagesExporting: name => Object.keys(pkgs).filter(pkg => pkgs[pkg].includes(name)),
		functions:         () => undefined,
		functionByName:    () => undefined,
		transitiveCallees: () => undefined,
		classes:           () => undefined,
		dependencies:      () => undefined,
		packageNames:      () => Object.keys(pkgs),
		isBaseR:           () => false,
		downloads:         () => 0,
		coreVersions:      () => undefined,
		releaseDate:       () => undefined,
		releaseDates:      () => [],
		latestVersion:     () => undefined,
		close:             () => { /* nothing to release */ }
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
				return s;
			}
		}).sort()
	}) as LintingRuleResult<Name>);
}
/** Asserts the linting results, comparing only the fields the expected results state (the union over all of them, so state a field for every result or none).*/
export function assertLinterFields<Name extends LintingRuleNames>(
	parser: KnownParser,
	code: string,
	ruleName: Name,
	expected: Record<string, unknown>[],
	emptyFiles: readonly string[] = [],
	assumeLoaded?: readonly string[]
) {
	const keys = new Set(expected.flatMap(e => Object.keys(e)));
	const setup: LinterTestSetup = { addFiles: emptyFiles.map(f => new FlowrInlineTextFile(f, '')), assumeLoaded };
	assertLinterWithCleanup(`${ruleName}: ${JSON.stringify(code)}`, parser, code, ruleName, expected, undefined, setup as DeepPartial<LintingRuleConfig<Name>> & LinterTestSetup,
		r => Object.fromEntries(Object.entries(r).filter(([k]) => keys.has(k))));
}

/** extra setup of {@link assertLinterPackage}: the package files besides the linted one, and where the linted code lives */
export type PackageTestSetup = {
	/** files of the package by their path below the package root; `DESCRIPTION` defaults to a minimal one, `null` drops it */
	readonly files?: Readonly<Record<string, string | null>>
	/** the path of the linted code below the package root (default `R/code.R`) */
	readonly file?:  string
};

/** the root all {@link assertLinterPackage} packages live at */
export const TestPackageRoot = '/pkg';

/**
 * Asserts the linting results of `code` as a file of an R package (by default `R/code.R` next to a minimal
 * `DESCRIPTION` of a package called `pkg`), comparing only the fields the expected results state (the union over all of them, so state a field for every result or none).
 */
export function assertLinterPackage<Name extends LintingRuleNames>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	ruleName: Name,
	expected: Record<string, unknown>[],
	setup: PackageTestSetup & DeepPartial<LintingRuleConfig<Name>> & LinterTestSetup = {} as PackageTestSetup & DeepPartial<LintingRuleConfig<Name>> & LinterTestSetup
) {
	const { files, file, ...config } = setup;
	const all: Record<string, string | null> = { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nTitle: A Package\nLicense: MIT\n', ...files };
	const keys = new Set(expected.flatMap(e => Object.keys(e)));
	const cfg = {
		...config,
		useAsFilePath: `${TestPackageRoot}/${file ?? 'R/code.R'}`,
		addFiles:      [...Object.entries(all).filter(([, c]) => c !== null).map(([p, c]) => new FlowrInlineTextFile(`${TestPackageRoot}/${p}`, c as string)), ...config.addFiles ?? []]
	} as DeepPartial<LintingRuleConfig<Name>> & LinterTestSetup;
	assertLinterWithCleanup(name, parser, code, ruleName, expected, undefined, cfg,
		r => Object.fromEntries(Object.entries(r).filter(([k]) => keys.has(k))));
}

/** Asserts the lines the findings of `rule` start at, as the linter query of a fresh analyzer reports them */
export function assertLintedLines(name: string, parser: KnownParser, code: string, rule: LintingRuleNames, lines: readonly number[]) {
	test(name, async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(code);
		const linted = await analyzer.query([{ type: 'linter', rules: [rule] }]);
		const results = (linted.linter.results[rule] as unknown as { results?: { loc: readonly number[] }[] } | undefined)?.results ?? [];
		assert.deepStrictEqual(results.map(r => r.loc[0]), lines, `${rule} should report the lines ${JSON.stringify(lines)}`);
	});
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
	const assumed = assumedPackagesOf(lintingRuleConfig);
	test(decorateLabelContext(name, ['linter']), async() => {
		let builder = applyAssumedPackages(new FlowrAnalyzerBuilder()
			.setInput({
				getId: deterministicCountingIdGenerator(0)
			})
			.setParser(parser)
			.configure('solver.resolveSource.dropPaths', DropPathsOption.All), assumed);
		// swap in a controlled signature database (or none) so tests do not depend on the bundled collection
		if(lintingRuleConfig?.sigDb !== undefined) {
			builder = withSigDb(builder, lintingRuleConfig.sigDb);
		} else if(lintingRuleConfig?.noSigDb) {
			builder = builder.unregisterPlugins(SigDbPluginName);
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
			assert.deepEqual(results.results.map(r => cleanup(r, ast)), expected.map(r => cleanup(r, ast)), `Expected ${ruleName} to return ${JSON.stringify(expected)}, but got ${JSON.stringify(results)}`);
		} catch(e) {
			console.error('dfg:', Dataflow.visualize.mermaid.url((await analyzer.dataflow()).graph));
			console.error('cfg:', cfgToMermaidUrl(await analyzer.controlflow(), await analyzer.normalize()));
			throw e;
		}
		if(expectedMetadata !== undefined) {
			const { searchTimeMs: _searchTimeMs, processTimeMs: _processTimeMs, ...strippedMeta } = results['.meta'];
			assert.deepEqual(strippedMeta as unknown as LintingRuleMetadata<Name>, expectedMetadata,
				`Expected ${ruleName} to have metadata ${JSON.stringify(expectedMetadata)}, but got ${JSON.stringify(results['.meta'])}`);
		}
	});
}
