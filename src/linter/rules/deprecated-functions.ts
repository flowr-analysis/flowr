import type { Range } from 'semver';
import type { BrandedIdentifier, BrandedNamespace } from '../../dataflow/environments/identifier';
import { Identifier } from '../../dataflow/environments/identifier';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import { FunctionCallVertex, VertexType } from '../../dataflow/graph/vertex';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { isNotUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import { RRange } from '../../util/r-version';
import { Q } from '../../search/flowr-search-builder';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Dataflow } from '../../dataflow/graph/df-helper';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { hasArgumentValue } from './function-finder-util';
import { Ternary } from '../../util/logic';
import type  { KnownParser } from '../../r-bridge/parser';
import { DefaultBuiltinConfig } from '../../dataflow/environments/default-builtin-config';
import { CallProp } from '../../dataflow/environments/built-in-props';

/**
 * Information about an argument of a function that should be flagged as deprecated if it is called with this argument
 *
 * Used in {@link DeprecatedFunctionInformation} to mark a function argument as deprecate under certain conditions
 */
interface DeprecatedArgumentInformation {
	/** Index of the argument */
	readonly argIdx?:       number,
	/** Name of the argument */
	readonly argName?:      string
	/** Only mark this argument as deprecated, if a specific value was provided */
	readonly ifValue?:      RegExp | string
	/** Suggested replacement for this argument */
	readonly replacedBy?:   string
	/** The version since this argument is deprecated */
	readonly sinceVersion?: Range
	/** The state of deprecation {@link DeprecationState}, i.e. is the argument completely removed, or are there better alternatives */
	readonly state?:        DeprecationState
}

/**
 * Information about a deprecated function
 *
 * Used in {@link DeprecatedFunctionsConfig.conditionally} to mark a function as deprecate under certain conditions
 */
interface DeprecatedFunctionInformation {
	/**
	 * Mark specific arguments as deprecated
	 * If only whenArgs is provided, and not sinceVersion, the function is only marked as deprecated, if the argument is provided.
	 */
	readonly whenArgs?:     DeprecatedArgumentInformation[]
	/** Suggested replacement for this function */
	readonly replacedBy?:   string
	/** The version since this function is deprecated, if version is provided the entire function will be marked as deprecated, if the version range matches */
	readonly sinceVersion?: Range
	/** Lifecycle State {@link DeprecationState}, i.e. is the function completely removed, or are there better alternatives */
	readonly state?:        DeprecationState
	/** The package this function comes from */
	readonly package:       string
}

/**
 * Result of the {@link DEPRECATED_FUNCTIONS} linting rule
 * See also the specializations {@link DeprecatedFunctionResult} and {@link DeprecatedArgumentResult}
 */
export interface DeprecatedFunctionResultBase extends LintingResult {
	/** The function affected by the deprecation */
	readonly function:      Identifier
	/** The suggest replacement for the deprecated argument or function */
	readonly replacedBy?:   string
	/** Since which package version this argument or function is deprecated */
	readonly sinceVersion?: Range
	/** Lifecycle State {@link DeprecationState} */
	readonly state?:        DeprecationState
}

/**
 * Returned by the {@link DEPRECATED_FUNCTIONS} linting rule, when a deprecated function is detected.
 * Provided for convince to differentiate between {@link DeprecatedArgumentResult} and {@link DeprecatedFunctionResult}
 */
export interface DeprecatedFunctionResult extends DeprecatedFunctionResultBase {
	readonly type: 'deprecated-function'
}

/**
 * Returned by the {@link DEPRECATED_FUNCTIONS} linting rule, when a deprecated argument is detected.
 * Provided for convince to differentiate between {@link DeprecatedArgumentResult} and {@link DeprecatedFunctionResult}
 */
export interface DeprecatedArgumentResult extends DeprecatedFunctionResultBase {
	readonly type: 'deprecated-argument'
	/** The name of the deprecated argument. Index in case of unnamed argument */
	readonly arg:  string | number
}

export type DeprecatedFunctionRuleResult = DeprecatedFunctionResult | DeprecatedArgumentResult;

export enum DeprecationState {
	/** A better alternative is available, but the function is kept (softer alternative to deprecated) {@link https://lifecycle.r-lib.org/articles/stages.html#superseded} */
	Superseeded = 'superseeded',
	/** A better alternative is available, and the function is marked for removal {@link https://lifecycle.r-lib.org/articles/stages.html#deprecated} */
	Deprecated = 'deprecated',
	/** No longer works and is removed and replaced by another function {@link https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/Defunct} */
	Defunct = 'defunct'
}

export interface DeprecatedFunctionsConfig extends MergeableRecord {
	/** Functions to always mark as deprecated */
	always:        Identifier[]
	/** Functions to mark as deprecated for specific argument, argument value or version */
	conditionally: Record<BrandedIdentifier, DeprecatedFunctionInformation>
}

interface PotentialFunction {
	node:           RNode<ParentInformation>;
	target:         Identifier;
	sourceLocation: SourceLocation
}

interface Metadata extends MergeableRecord {
	/** Number of deprecated functions flagged by the sigdb */
	sigdb:   number,
	/** Number of deprecated functions flagged by the builtin config */
	builtin: number
}

const ConditionallyDeprecated = {
	/* https://tidyverse.org/blog/2025/09/ggplot2-4-0-0/#violin--quantiles */
	'geom_violin': { package: 'ggplot2', whenArgs: [{ argName: 'draw_quantiles', state: DeprecationState.Deprecated, replacedBy: 'quantile.linetype', sinceVersion: RRange.parse('>= 4.0.0') }] },
} as Record<BrandedIdentifier, DeprecatedFunctionInformation>;

function functionListFromBuiltinConfig(): Identifier[] {
	return DefaultBuiltinConfig.filter(def => def.type === 'function'
			&& def.config?.props !== undefined
			&& (def.config.props & CallProp.Deprecated) !== 0)
		.flatMap(def => def.names);
}

export const DEPRECATED_FUNCTIONS = {
	// unlike functionFinderUtil.createSearch(config.fns), this does not pre-filter to the hardcoded list: the
	// sigdb-driven pass below needs every resolved call, so the `fns` filtering happens in processSearchResult instead
	createSearch: (_config) => Q.all().filter(VertexType.FunctionCall).with(Enrichment.CallTargets, {
		onlyBuiltin:  true,
		qualifyNames: true
	}),
	processSearchResult: async(elements, config, data) => {
		const matchesConfiguredFns = Identifier.regex(...config.always);
		const graph = (await data.dataflow()).graph;
		const idMap = (await data.normalize()).idMap;

		// 1. Collect all function call targets from detected function calls
		const detectedFunctions = elements.getElements().flatMap(e => {
			return enrichmentContent(e, Enrichment.CallTargets).targets.map(target => {
				const sourceLocation = SourceLocation.fromNode(e.node);
				if(sourceLocation !== undefined) {
					return {
						node: e.node, target: Identifier.parse(target as string), sourceLocation
					};
				}
			});
		}).filter(p => isNotUndefined(p));

		// 2. Uses hardcoded information about deprecated arguments and deprecated functions
		const packageVersions = await inferPackageVersions(data, detectedFunctions, config.conditionally);
		const results: DeprecatedFunctionRuleResult[] = (await Promise.all(detectedFunctions.map(async candidate => {
			const name = Identifier.getName(candidate.target);
			const info = config.conditionally[name];
			if(isNotUndefined(info)) {
				return await deprecateFunctionConditionally(candidate, graph, idMap, data, info, packageVersions);
			} else {
				return deprecateFunctionAlways(candidate, matchesConfiguredFns);
			}
		}))).filter(p => isNotUndefined(p)).flat();


		// 3. If available, use sigdb to flag deprecated functions
		const deps = data.inspectContext().deps;
		if(deps.signatureSources().length === 0) {
			return { results, '.meta': { builtin: results.length, sigdb: 0 } };
		}

		// sigdb-driven detection: flag any resolved call whose signature-database entry marks it deprecated,
		// even when it is not part of the hardcoded `fns` list above
		const alreadyFlagged = new Set(results.map(r => r.involvedId));
		const deprecatedByName = new Map<string, boolean>();
		const sigdbFlagged: DeprecatedFunctionResult[] = [];
		for(const element of elements.getElements()) {
			const id = element.node.info.id;
			if(alreadyFlagged.has(id)) {
				continue;
			}
			const qualified = Dataflow.qualify(id, graph);
			if(qualified === undefined) {
				continue;
			}
			const name = Identifier.toString(qualified);
			let deprecated = deprecatedByName.get(name);
			if(deprecated === undefined) {
				deprecated = deps.signatureOf(qualified)?.props.includes('deprecated') === true;
				deprecatedByName.set(name, deprecated);
			}
			if(!deprecated) {
				continue;
			}
			const loc = SourceLocation.fromNode(element.node);
			if(loc === undefined) {
				continue;
			}
			alreadyFlagged.add(id);
			sigdbFlagged.push({
				type:       'deprecated-function',
				certainty:  LintingResultCertainty.Certain,
				involvedId: id,
				function:   name,
				loc
			});
		}

		return {
			results: results.concat(sigdbFlagged),
			'.meta': { builtin: results.length, sigdb: sigdbFlagged.length }
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result: DeprecatedFunctionRuleResult) => `${result.type === 'deprecated-argument' ? `Argument \`${result.arg}\` of ` : ''}Function \`${Identifier.toString(result.function)}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  (result: DeprecatedFunctionRuleResult) => {
			const str: string[] = [];
			if(result.type === 'deprecated-argument') {
				const argStr = typeof result.arg === 'number' ? `at position \`${result.arg}\`` : result.arg;
				str.push(`Argument \`${argStr}\` of`);
			}
			str.push(`Function \`${Identifier.toString(result.function)}\` is ${result.state ?? 'deprecated'}`);
			if(result.sinceVersion) {
				str.push(`since version ${result.sinceVersion.format()}`);
			}
			if(result.replacedBy) {
				str.push(`and is replaced by \`${result.replacedBy}\``);
			}
			return str.join(' ');
		}
	},
	info: {
		name:          'Deprecated Functions',
		tags:          [LintingRuleTag.Deprecated, LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		// the hardcoded `always` and `conditionally` list ensures every reported hit is real, but the list is pre-crawled and hence
		// incomplete; the signature-database pass above adds recall for whichever packages are resolved
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks deprecated functions that should not be used anymore.',
		defaultConfig: {
			always:        functionListFromBuiltinConfig(),
			conditionally: ConditionallyDeprecated
		}
	}
} as const satisfies LintingRule<DeprecatedFunctionRuleResult, Metadata, DeprecatedFunctionsConfig>;

type PackageVersionMap = Map<BrandedNamespace, Range>;
async function inferPackageVersions(analyzer: ReadonlyFlowrAnalysisProvider<KnownParser>, candidates: PotentialFunction[], info: typeof ConditionallyDeprecated): Promise<PackageVersionMap> {
	const infos = candidates.map(c => info[Identifier.getName(c.target)]).filter(inf => isNotUndefined(inf));
	const arePackageVersionsNeeded = infos.some(
		inf => inf.sinceVersion !== undefined ||
			inf.whenArgs?.some(arg => arg.sinceVersion) === true);

	if(!arePackageVersionsNeeded) {
		return new Map<BrandedNamespace, Range>();
	}

	const packages = infos.map(inf => inf.package);
	const queryResult = await analyzer.query([{
		type:     'guess-dep-versions',
		packages: packages
	}]);
  const versions = queryResult['guess-dep-versions'].dependencies
        .map(d => [d.package, RRange.parse(d.range)])
        .filter(([_, version]) => isNotUndefined(version)) as [BrandedNamespace, Range][];
        
  return new Map<BrandedNamespace, Range>(versions);
}

/**
 * This function is applied to function candidates that have an entry in the {@link DeprecatedFunctionsConfig.conditionally} map.
 */
async function deprecateFunctionConditionally(candidate: PotentialFunction, dataflow: DataflowGraph, idMap: AstIdMap, analyzer: ReadonlyFlowrAnalysisProvider<KnownParser>, info: DeprecatedFunctionInformation, packageVersions: PackageVersionMap): Promise<DeprecatedFunctionRuleResult[]> {
	const results: DeprecatedFunctionRuleResult[] = [];
  const derrivedRange = packageVersions.get(info.package);
  
	// Deprecated Argument: If `whenArgs` is provided, only mark deprecated arguments
	if(info.whenArgs) {
		const vertex = dataflow.getVertex(candidate.node.info.id);
		if(vertex === undefined || !FunctionCallVertex.is(vertex)) {
			return results;
		}

		for(const deprecatedArgInfo of info.whenArgs) {
			// Check if function call has deprecated argument
			const arg = vertex.args.find((arg, idx) =>
				FunctionArgument.isNamed(arg) && arg.name === deprecatedArgInfo.argName ||
				FunctionArgument.isPositional(arg) && idx === deprecatedArgInfo.argIdx
			);
			const argNode = arg === undefined || arg === EmptyArgument ? undefined : idMap.get(arg.nodeId);
			if(argNode === undefined) {
				continue;
			}

			// If `sinceVersion` is set, check package version before marking argument as deprecated
			let certainty = LintingResultCertainty.Certain;
			if(deprecatedArgInfo.sinceVersion) {
				if(derrivedRange == undefined) {
					certainty = LintingResultCertainty.Uncertain;
				} else if(!deprecatedArgInfo.sinceVersion.intersects(derrivedRange)) {
					continue;
				}
			}

			// If `ifValue` is set, check argument value before marking argument as deprecate
			if(deprecatedArgInfo.ifValue) {
				const hasArg = hasArgumentValue(deprecatedArgInfo.ifValue, vertex, analyzer, dataflow, true, deprecatedArgInfo.argName, deprecatedArgInfo.argIdx);
				if(hasArg === Ternary.Never) {
					continue;
				} else if(hasArg === Ternary.Maybe) {
					certainty = LintingResultCertainty.Uncertain;
				}
			}

			// If all checks passed, mark as deprecated
			results.push({
				type:         'deprecated-argument',
				certainty:    certainty,
				involvedId:   argNode.info.id,
				function:     candidate.target,
				arg:          (deprecatedArgInfo.argName ?? deprecatedArgInfo.argIdx) as string | number,
				state:        deprecatedArgInfo.state,
				replacedBy:   deprecatedArgInfo.replacedBy,
				sinceVersion: deprecatedArgInfo.sinceVersion,
				loc:          SourceLocation.fromNode(argNode) ?? candidate.sourceLocation
			} satisfies DeprecatedArgumentResult);
		}
	}

	// Deprecated Function: If `sinceVersion` is set, check package version before marking as deprecated
	if(info.sinceVersion) {
		const isDeprecatedVersion = derrivedRange ? info.sinceVersion.intersects(derrivedRange) : undefined;
		if(isDeprecatedVersion === true || isDeprecatedVersion === undefined) {
			results.push({
				type:         'deprecated-function',
				certainty:    isDeprecatedVersion === undefined ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain,
				involvedId:   candidate.node.info.id,
				loc:          candidate.sourceLocation,
				function:     candidate.target,
				state:        info.state,
				replacedBy:   info.replacedBy,
				sinceVersion: info.sinceVersion
			} satisfies DeprecatedFunctionResult);
		}
	}

	return results;
}


/**
 * This function is applied to function candidates that have an entry in the {@link DeprecatedFunctionsConfig.always} map.
 */
function deprecateFunctionAlways(candidate: PotentialFunction, matchesConfiguredFns: RegExp): DeprecatedFunctionResult | undefined {
	if(!matchesConfiguredFns.test(Identifier.getName(candidate.target))) {
		return undefined;
	}

	return {
		type:       'deprecated-function',
		certainty:  LintingResultCertainty.Certain,
		involvedId: candidate.node.info.id,
		loc:        candidate.sourceLocation,
		function:   candidate.target,
	} satisfies DeprecatedFunctionResult;
}
