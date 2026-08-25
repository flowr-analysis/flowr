import type { Range } from 'semver';
import type { BrandedIdentifier, BrandedNamespace } from '../../dataflow/environments/identifier';
import { Identifier } from '../../dataflow/environments/identifier';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { FunctionCallVertex, VertexType } from '../../dataflow/graph/vertex';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { uniqueArray } from '../../util/collections/arrays';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { isNotUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import type { LintingResult, LintingRule, LintQuickFix } from '../linter-format';
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
import { CallProps, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';

/**
 * Information about an argument of a function that should be flagged as deprecated if it is called with this argument
 *
 * Used in {@link DeprecatedFunctionInformation} to mark a function argument as deprecated under certain conditions
 */
export interface DeprecatedArgumentInformation {
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
 * Used in {@link DeprecatedFunctionsConfig.conditionally} to mark a function as deprecated under certain conditions
 */
export interface DeprecatedFunctionInformation {
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
}

/**
 * Result of the {@link DEPRECATED_FUNCTIONS} linting rule
 * See also the specializations {@link DeprecatedFunctionResult} and {@link DeprecatedArgumentResult}
 */
export interface DeprecatedFunctionResultBase extends LintingResult {
	/** The function affected by the deprecation */
	readonly function:      Identifier
	/** The suggested replacement for the deprecated argument or function */
	readonly replacedBy?:   string
	/** Since which package version this argument or function is deprecated */
	readonly sinceVersion?: Range
	/** Lifecycle State {@link DeprecationState} */
	readonly state?:        DeprecationState
}

/**
 * Returned by the {@link DEPRECATED_FUNCTIONS} linting rule, when a deprecated function is detected.
 * Provided for convenience to differentiate between {@link DeprecatedArgumentResult} and {@link DeprecatedFunctionResult}
 */
export interface DeprecatedFunctionResult extends DeprecatedFunctionResultBase {
	readonly type: 'deprecated-function'
}

/**
 * Returned by the {@link DEPRECATED_FUNCTIONS} linting rule, when a deprecated argument is detected.
 * Provided for convenience to differentiate between {@link DeprecatedArgumentResult} and {@link DeprecatedFunctionResult}
 */
export interface DeprecatedArgumentResult extends DeprecatedFunctionResultBase {
	readonly type: 'deprecated-argument'
	/** The name of the deprecated argument. Index in case of unnamed argument */
	readonly arg:  string | number
}

export type DeprecatedFunctionRuleResult = DeprecatedFunctionResult | DeprecatedArgumentResult;

export enum DeprecationState {
	/** A better alternative is available, but the function is kept (softer alternative to deprecated) {@link https://lifecycle.r-lib.org/articles/stages.html#superseded} */
	Superseded = 'superseded',
	/** A better alternative is available, and the function is marked for removal {@link https://lifecycle.r-lib.org/articles/stages.html#deprecated} */
	Deprecated = 'deprecated',
	/** No longer works and is removed and replaced by another function {@link https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/Defunct} */
	Defunct = 'defunct'
}

export interface DeprecatedFunctionsConfig extends MergeableRecord {
	/** Functions to always mark as deprecated */
	always:        Identifier[]
	/**
	 * Functions to mark as deprecated for specific argument, argument value or version. Keyed like
	 * {@link DeprecatedFunctionsConfig.always}: `pkg::fn` names the package the versions are checked against and
	 * matches only that one, a bare name matches any package.
	 */
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

/**
 * `size` names the stroke width of every line-based geom until ggplot2 4.0.0 renamed it: it gained
 * `linewidth` beside it in 3.4.0, and 4.0.0 drops `size`.
 */
const GgplotLinewidth: DeprecatedFunctionInformation = {
	whenArgs: [{ argName: 'size', state: DeprecationState.Deprecated, replacedBy: 'linewidth', sinceVersion: RRange.parse('>= 3.4.0') }]
};

const ConditionallyDeprecated = {
	/* https://tidyverse.org/blog/2025/09/ggplot2-4-0-0/#violin--quantiles */
	/* the quantiles moved to the stat, and the geom only kept arguments styling them, so neither is a rename of
	   `draw_quantiles = 0.5`: the value is a quantile, not a linetype, and `quantiles` is no formal of the geom */
	'ggplot2::geom_violin':  { whenArgs: [{ argName: 'draw_quantiles', state: DeprecationState.Deprecated, replacedBy: 'stat_ydensity(quantiles)', sinceVersion: RRange.parse('>= 4.0.0') }] },
	'ggplot2::element_line': GgplotLinewidth,
	'ggplot2::element_rect': GgplotLinewidth
} as Record<BrandedIdentifier, DeprecatedFunctionInformation>;

/** One entry with the package its key named, `undefined` for a bare key. */
interface ConditionalEntry {
	readonly info: DeprecatedFunctionInformation
	readonly pkg:  BrandedNamespace | undefined
}

/** The entries by bare name, as a call names its package only when written `pkg::fn`. */
function indexConditionals(conditionally: DeprecatedFunctionsConfig['conditionally']): Map<string, ConditionalEntry[]> {
	const index = new Map<string, ConditionalEntry[]>();
	for(const [key, info] of Object.entries(conditionally)) {
		const id = Identifier.parse(key);
		const name = Identifier.getName(id);
		const known = index.get(name);
		const entry = { info, pkg: Identifier.getNamespace(id) };
		if(known === undefined) {
			index.set(name, [entry]);
		} else {
			known.push(entry);
		}
	}
	return index;
}

/** The entry for `target`: its own package's, else a bare one; a call naming no package takes the first. */
function conditionalFor(index: ReadonlyMap<string, ConditionalEntry[]>, target: Identifier): ConditionalEntry | undefined {
	const found = index.get(Identifier.getName(target));
	if(found === undefined) {
		return undefined;
	}
	const namespace = Identifier.getNamespace(target);
	return namespace === undefined ? found[0] : found.find(e => e.pkg === namespace) ?? found.find(e => e.pkg === undefined);
}

/** The packages each `always` name belongs to; `undefined` for an entry claiming none. */
function indexAlways(always: readonly Identifier[]): Map<string, (BrandedNamespace | undefined)[]> {
	const index = new Map<string, (BrandedNamespace | undefined)[]>();
	for(const entry of always) {
		const name = Identifier.getName(entry);
		const known = index.get(name);
		const namespace = Identifier.getNamespace(entry);
		if(known === undefined) {
			index.set(name, [namespace]);
		} else if(!known.includes(namespace)) {
			known.push(namespace);
		}
	}
	return index;
}

/** The packages the code attaches; `undefined` when one of them cannot be named, so nothing is ruled out. */
async function attachedPackages(analyzer: ReadonlyFlowrAnalysisProvider<KnownParser>): Promise<ReadonlySet<string> | undefined> {
	const attached = new Set<string>();
	for(const lib of (await analyzer.query([{ type: 'dependencies', enabledCategories: ['library'] }]))['dependencies'].library) {
		if(lib.value === undefined || lib.value === Unknown) {
			return undefined;
		}
		attached.add(lib.value);
	}
	return attached;
}

/** A call naming its package, or whose package is attached, is that function; any other is a guess. */
function certaintyOf(target: Identifier, owners: readonly (BrandedNamespace | undefined)[], attached: ReadonlySet<string> | undefined): LintingResultCertainty {
	const namespace = Identifier.getNamespace(target);
	const sure = owners.some(owner => owner === undefined || owner === namespace || attached === undefined || attached.has(owner));
	return sure ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain;
}

function functionListFromBuiltinConfig(): Identifier[] {
	return DefaultBuiltinConfig.filter(def => def.type === 'function'
			&& CallProps.hasAny(def.config, SemanticCallTag.Deprecated))
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
		const always = indexAlways(config.always);
		const conditionals = indexConditionals(config.conditionally);
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
		const matched = detectedFunctions.map(candidate => ({
			candidate,
			conditional: conditionalFor(conditionals, candidate.target),
			owners:      always.get(Identifier.getName(candidate.target))
		})).filter(m => m.conditional !== undefined || m.owners !== undefined);
		/* only asked once something matched, so a clean file queries nothing */
		const attached = matched.length === 0 ? undefined : await attachedPackages(data);
		const packageVersions = await inferPackageVersions(data, matched.map(m => m.conditional));
		const results: DeprecatedFunctionRuleResult[] = matched.map(({ candidate, conditional, owners }) => {
			if(conditional !== undefined) {
				return deprecateFunctionConditionally(candidate, graph, idMap, data, conditional, packageVersions, attached);
			} else {
				return deprecateFunctionAlways(candidate, owners as (BrandedNamespace | undefined)[], attached);
			}
		}).flat();

		// 3. If available, use sigdb to flag deprecated functions
		const deps = data.inspectContext().deps;
		if(deps.signatureSources().length === 0) {
			return { results, '.meta': { builtin: results.length, sigdb: 0 } };
		}

		// sigdb-driven detection: flag any resolved call whose signature-database entry marks it deprecated,
		// even when it is not part of the hardcoded `fns` list above
		const alreadyFlagged = new Set(results.map(r => r.involvedId));
		const deprecatedByName = new Map<string, boolean>();
		const sigdbFlagged: DeprecatedFunctionRuleResult[] = [];
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
				deprecated = deps.signatures().functionOf(qualified)?.props.includes('deprecated') === true;
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
				function:   qualified,
				loc
			});
		}

		return {
			results: results.concat(sigdbFlagged),
			'.meta': { builtin: results.length, sigdb: sigdbFlagged.length }
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result: DeprecatedFunctionRuleResult) => `${result.type === 'deprecated-argument' ? `Argument \`${result.arg}\` of ` : ''}function \`${Identifier.toString(result.function)}\` at ${SourceLocation.format(result.loc)}`,
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
		tags:          [LintingRuleTag.Deprecated, LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility, LintingRuleTag.QuickFix],
		// the hardcoded `always` and `conditionally` list ensures every reported hit is real, but the list is pre-crawled and hence
		// incomplete; the signature-database pass above adds recall for whichever packages are resolved
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks deprecated functions and deprecated arguments of still-current functions, offering the replacement as a quick fix where one is known. A call to a bare name whose package the code never attaches is reported as uncertain, as any function of that name would answer to it.',
		defaultConfig: {
			always:        functionListFromBuiltinConfig(),
			conditionally: ConditionallyDeprecated
		}
	}
} as const satisfies LintingRule<DeprecatedFunctionRuleResult, Metadata, DeprecatedFunctionsConfig>;

type PackageVersionMap = Map<BrandedNamespace, Range>;
/** The version of each package a matched entry constrains, asked for only when one does. */
async function inferPackageVersions(analyzer: ReadonlyFlowrAnalysisProvider<KnownParser>, matched: readonly (ConditionalEntry | undefined)[]): Promise<PackageVersionMap> {
	const packages = matched.filter(isNotUndefined)
		.filter(({ info }) => info.sinceVersion !== undefined || info.whenArgs?.some(arg => arg.sinceVersion) === true)
		.map(({ pkg }) => pkg)
		.filter(isNotUndefined);

	if(packages.length === 0) {
		return new Map<BrandedNamespace, Range>();
	}

	const queryResult = await analyzer.query([{
		type:     'guess-dep-versions',
		packages: uniqueArray(packages)
	}]);
	const versions = queryResult['guess-dep-versions'].dependencies
		.map(d => [d.package, RRange.parse(d.range)])
		.filter(([_, version]) => isNotUndefined(version)) as [BrandedNamespace, Range][];

	return new Map<BrandedNamespace, Range>(versions);
}

/**
 * The node of the deprecated argument, `undefined` when the call does not supply it. Matches as R does: a name
 * binds wherever it stands, then the unnamed arguments fill the rest, so `f(other = 1, x)` supplies `x` at 0.
 */
function isDeprecatedArgumentPresent(vertex: DataflowGraphVertexFunctionCall, info: DeprecatedArgumentInformation, idMap: AstIdMap): RNode<ParentInformation> | undefined {
	const named = info.argName === undefined ? undefined : vertex.args.find(arg => FunctionArgument.hasName(arg, info.argName as string));
	const arg = named ?? (info.argIdx === undefined ? undefined : vertex.args.filter(FunctionArgument.isPositional)[info.argIdx]);
	return arg === undefined ? undefined : idMap.get(arg.nodeId);
}

type SetUncertainFn = () => void;
function doesPackageVersionMatch(derivedVersion: Range | undefined, info: DeprecatedArgumentInformation, setUncertain: SetUncertainFn): boolean  {
	if(info.sinceVersion === undefined) {
		return true;
	}

	if(derivedVersion == undefined) {
		setUncertain();
		return true;
	} else {
		return info.sinceVersion.intersects(derivedVersion);
	}
}

function doesArgumentValueMatch(info: DeprecatedArgumentInformation, vertex: DataflowGraphVertexFunctionCall, analyzer: ReadonlyFlowrAnalysisProvider<KnownParser>, dataflow: DataflowGraph, setUncertain: SetUncertainFn): boolean {
	if(info.ifValue === undefined) {
		return true;
	}

	const hasArg = hasArgumentValue(info.ifValue, vertex, analyzer, dataflow, true, info.argName, info.argIdx);
	if(hasArg === Ternary.Never) {
		return false;
	} else if(hasArg === Ternary.Maybe) {
		setUncertain();
	}

	return true;
}

/**
 * Whether the replacement is a plain name, which is what makes swapping the old one for it a rename at all.
 * A replacement that names where the thing went instead (`stat_ydensity(quantiles)`) says the right thing to a
 * reader and the wrong thing to an editor, so it carries no fix.
 */
function isRename(replacedBy: string): boolean {
	return /^(?:[A-Za-z.][A-Za-z0-9._]*|`[^`]+`)$/.test(replacedBy);
}

/** The rename that carries a finding out, when a replacement name is known and swapping it in is one. */
function renameFix(node: RNode<ParentInformation> | undefined, replacedBy: string | undefined, what: string): LintQuickFix[] | undefined {
	const loc = node === undefined ? undefined : SourceLocation.fromNode(node);
	if(replacedBy === undefined || loc === undefined || !isRename(replacedBy)) {
		return undefined;
	}
	return [{ type: 'replace', description: `Replace ${what} with \`${replacedBy}\``, replacement: replacedBy, loc }];
}

/** The name to rename, `undefined` for `pkg::fn` as the replacement states no package to put back. */
function calledName(node: RNode<ParentInformation>): RNode<ParentInformation> | undefined {
	return RFunctionCall.isNamed(node) && Identifier.getNamespace(node.functionName.content) === undefined
		? node.functionName : undefined;
}

/**
 * This function is applied to function candidates that have an entry in the {@link DeprecatedFunctionsConfig.conditionally} map.
 */
function deprecateFunctionConditionally(candidate: PotentialFunction, dataflow: DataflowGraph, idMap: AstIdMap, analyzer: ReadonlyFlowrAnalysisProvider<KnownParser>, entry: ConditionalEntry, packageVersions: PackageVersionMap, attached: ReadonlySet<string> | undefined): DeprecatedFunctionRuleResult[] {
	const { info, pkg } = entry;
	const results: DeprecatedFunctionRuleResult[] = [];
	const derivedRange = pkg === undefined ? undefined : packageVersions.get(pkg);
	const known = certaintyOf(candidate.target, [pkg], attached);

	// Deprecated Argument: If `whenArgs` is provided, only mark deprecated arguments
	if(info.whenArgs) {
		const vertex = dataflow.getVertex(candidate.node.info.id);
		if(vertex === undefined || !FunctionCallVertex.is(vertex)) {
			return results;
		}

		for(const deprecatedArgInfo of info.whenArgs) {
			const argNode = isDeprecatedArgumentPresent(vertex, deprecatedArgInfo, idMap);
			if(argNode === undefined) {
				continue;
			}

			let certainty = known;
			const setUncertain = () => {
				certainty = LintingResultCertainty.Uncertain;
			};

			// If `sinceVersion` is set, check package version before marking argument as deprecated
			if(!doesPackageVersionMatch(derivedRange, deprecatedArgInfo, setUncertain)) {
				continue;
			}


			// If `ifValue` is set, check argument value before marking argument as deprecate
			if(!doesArgumentValueMatch(deprecatedArgInfo, vertex, analyzer, dataflow, setUncertain)) {
				continue;
			}

			// If all checks passed, mark as deprecated
			results.push({
				type:         'deprecated-argument',
				certainty:    certainty,
				involvedId:   vertex.id,
				function:     candidate.target,
				arg:          (deprecatedArgInfo.argName ?? deprecatedArgInfo.argIdx) as string | number,
				state:        deprecatedArgInfo.state,
				replacedBy:   deprecatedArgInfo.replacedBy,
				sinceVersion: deprecatedArgInfo.sinceVersion,
				loc:          SourceLocation.fromNode(argNode) ?? candidate.sourceLocation,
				quickFix:     deprecatedArgInfo.argName === undefined ? undefined : renameFix(argNode, deprecatedArgInfo.replacedBy, `argument \`${deprecatedArgInfo.argName}\``)
			} satisfies DeprecatedArgumentResult);
		}
	}

	// Deprecated Function: If `sinceVersion` is set, check package version before marking as deprecated
	if(info.sinceVersion) {
		const isDeprecatedVersion = derivedRange ? info.sinceVersion.intersects(derivedRange) : undefined;
		if(isDeprecatedVersion === true || isDeprecatedVersion === undefined) {
			results.push({
				type:         'deprecated-function',
				certainty:    isDeprecatedVersion === undefined ? LintingResultCertainty.Uncertain : known,
				involvedId:   candidate.node.info.id,
				loc:          candidate.sourceLocation,
				function:     candidate.target,
				state:        info.state,
				replacedBy:   info.replacedBy,
				sinceVersion: info.sinceVersion,
				quickFix:     renameFix(calledName(candidate.node), info.replacedBy, 'the call')
			} satisfies DeprecatedFunctionResult);
		}
	}

	return results;
}


/**
 * This function is applied to function candidates that have an entry in the {@link DeprecatedFunctionsConfig.always} map.
 * A call naming a package the list does not have under that name is another function and is left alone.
 */
function deprecateFunctionAlways(candidate: PotentialFunction, owners: readonly (BrandedNamespace | undefined)[], attached: ReadonlySet<string> | undefined): DeprecatedFunctionResult[] {
	const namespace = Identifier.getNamespace(candidate.target);
	if(namespace !== undefined && !owners.some(owner => owner === undefined || owner === namespace)) {
		return [];
	}

	return [{
		type:       'deprecated-function',
		certainty:  certaintyOf(candidate.target, owners, attached),
		involvedId: candidate.node.info.id,
		loc:        candidate.sourceLocation,
		function:   candidate.target,
	} satisfies DeprecatedFunctionResult];
}
