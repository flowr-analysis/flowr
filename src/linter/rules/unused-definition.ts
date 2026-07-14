import { type LintingResult, type LintingRule, type LintQuickFixRemove, LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { isNotUndefined } from '../../util/assert';
import { isFunctionDefinitionVertex, isVariableDefinitionVertex, VertexType } from '../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { F } from '../../search/flowr-search-filters';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { FileRole } from '../../project/context/flowr-file';
import { getExportedNames } from '../../project/plugins/file-plugins/files/flowr-namespace-file';
import { Identifier } from '../../dataflow/environments/identifier';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { removeRQuotes } from '../../r-bridge/retriever';

export interface UnusedDefinitionResult extends LintingResult {
	variableName?: string
}

export interface UnusedDefinitionConfig extends MergeableRecord {
	/**
	 * Whether to include (potentially anonymous) function definitions in the search (e.g., should we report uncalled anonymous functions?).
	 */
	includeFunctionDefinitions: boolean
	/**
	 * Whether to suppress definitions that the analyzed project exports via its `NAMESPACE` (the package's public API).
	 * flowR cannot observe external callers, so exported names would otherwise be reported as (uncertain) false positives.
	 */
	excludeExportedDefinitions: boolean
}

/**
 * The dots parameter is a special parameter and must never be reported as an unused definition.
 */
const DotsParameter = '...';

/**
 * Common base/standard-library S3 generics. A definition named `generic.class` where `generic` is one of these
 * is an S3 method dispatched indirectly (e.g. `print(x)` on an object of class `class`), so it is used even
 * without a direct textual call.
 */
const KnownS3Generics = new Set<string>([
	'print', 'format', 'summary', 'plot', 'coef', 'vcov', 'residuals', 'fitted', 'predict',
	'as.character', 'as.data.frame', 'as.list', 'as.matrix', 'as.vector', 'as.numeric',
	'length', 'dim', 'dimnames', 'names', 'str', 'toString', 'all.equal', 'aggregate',
	'update', 'anova', 'confint', 'logLik', 'AIC', 'BIC', 'deviance', 'df.residual',
	'model.matrix', 'terms', 'weights', 'simulate', 'lines', 'points', 'head', 'tail',
	'merge', 'rbind', 'cbind', 'split', 'window', 'subset', 'sort', 'rev', 'unique',
	'mean', 'median', 'quantile', 'range', 'diff', 't'
]);

/**
 * R package lifecycle hooks called automatically by R's package machinery.
 * These functions are invoked by the package system, so they are used even without textual callers.
 */
const PackageHookFunctions = new Set<string>([
	'.onLoad', '.onAttach', '.onUnload', '.onDetach', '.Last.lib', '.First.lib'
]);

interface PackageInfo {
	/** all names the project exports via its `NAMESPACE` (functions, symbols, patterns, S3 methods as `generic.class`) */
	readonly exported:   ReadonlySet<string>
	/** S3 generics the project's `NAMESPACE` declares methods for (via `S3method(generic, class)`) */
	readonly s3Generics: ReadonlySet<string>
}

/** Gathers the analyzed project's own `NAMESPACE` exports and declared S3 generics (empty when it is not a package). */
function collectPackageInfo(data: ReadonlyFlowrAnalysisProvider): PackageInfo {
	const exported = new Set<string>();
	const s3Generics = new Set<string>();
	for(const ns of data.inspectContext().files.getFilesByRole(FileRole.Namespace)) {
		const info = ns.content().current;
		for(const name of getExportedNames(info)) {
			exported.add(name);
		}
		for(const generic of info.exportS3Generics.keys()) {
			s3Generics.add(generic);
		}
	}
	return { exported, s3Generics };
}

/** Collects the names of every function call in the graph, so we can tell whether an S3 generic is dispatched anywhere. */
function collectCalledNames(dfg: DataflowGraph): ReadonlySet<string> {
	const names = new Set<string>();
	for(const [, vertex] of dfg.verticesOfType(VertexType.FunctionCall)) {
		names.add(Identifier.getName(vertex.name));
	}
	return names;
}

/**
 * A definition is treated as used (and hence not reported) if it is the dots parameter, a package lifecycle hook,
 * an S3 method for a dispatched generic, or - when {@link UnusedDefinitionConfig#excludeExportedDefinitions} is set -
 * a package export.
 */
function isConsideredUsed(lexeme: string | undefined, config: UnusedDefinitionConfig, pkg: PackageInfo, called: ReadonlySet<string>): boolean {
	if(lexeme === undefined) {
		return false;
	}
	// non-syntactic definition names (e.g. S3 methods like `"[.irts"`) carry their R quotes in the lexeme
	const name = removeRQuotes(lexeme);
	// the dots are a special parameter and must never be reported
	if(name === DotsParameter) {
		return true;
	}
	// package lifecycle hooks are called by R's package machinery
	if(PackageHookFunctions.has(name)) {
		return true;
	}
	const dot = name.indexOf('.');
	if(dot > 0) {
		const generic = name.slice(0, dot);
		if(KnownS3Generics.has(generic) || pkg.s3Generics.has(generic) || called.has(generic)) {
			return true;
		}
	}
	if(config.excludeExportedDefinitions && pkg.exported.has(name)) {
		return true;
	}
	return false;
}

export interface UnusedDefinitionMetadata extends MergeableRecord {
	totalConsidered: number
}

const InterestingEdgesVariable = EdgeType.Reads | EdgeType.Calls | EdgeType.DefinesOnCall;
const InterestingEdgesFunction = EdgeType.Reads | EdgeType.Calls;// include read as this could print the function definition
const InterestingEdgesTargets = EdgeType.SideEffectOnCall;

function getDefinitionArguments(def: NodeId, dfg: DataflowGraph) {
	return dfg.outgoingEdges(def)?.entries().filter(([,e]) => DfEdge.includesType(e, EdgeType.DefinedBy))
		.map(([target]) => target).toArray() ?? [];
}

function buildQuickFix(variable: RNode<ParentInformation>, dfg: DataflowGraph, ast: NormalizedAst): LintQuickFixRemove[] | undefined {
	// first we check whether any of the 'Defined by' targets have any obligations - if so, we can not remove the definition
	// otherwise we can automatically remove the full definition!

	if(variable.info.role === RoleInParent.Accessed || variable.info.role === RoleInParent.ForVariable) {
		// this is an access or a for variable, we can not remove it currently
		return undefined;
	}
	const definedBys = getDefinitionArguments(variable.info.id, dfg);

	const hasImportantArgs = definedBys.some(d => dfg.unknownSideEffects.has(d))
		|| definedBys.flatMap(e => Array.from(dfg.outgoingEdges(e) ?? []))
			.some(([target, e]) => {
				return DfEdge.includesType(e, InterestingEdgesTargets) || dfg.unknownSideEffects.has(target);
			});

	if(hasImportantArgs) {
		return undefined; // we can not remove this definition, it has important arguments
	}

	const totalRangeToRemove = SourceLocation.merge(
		[...definedBys.map(d => {
			const vertex = ast.idMap.get(d);
			return vertex ? SourceLocation.fromNode(vertex) : undefined;
		}),
		variable.info.fullRange ?? variable.location]
	);

	return [{
		type:        'remove',
		loc:         totalRangeToRemove ?? SourceLocation.invalid(),
		description: `Remove unused definition of \`${variable.lexeme}\``
	}];
}

/**
 * consider `x <- function() ...` if we say `x` is unused and propose to remove everything, there should be no separate quick fix for the function definition
 */
function onlyKeepSupersetOfUnused(
	elements: UnusedDefinitionResult[]
): UnusedDefinitionResult[] {
	const locs = elements.flatMap(e => e.quickFix?.map(q => q.loc) ?? [e.loc]);
	if(locs.length <= 1) {
		return elements; // nothing to filter, only one element
	}
	return elements.filter(e => {
		const otherLoc = SourceLocation.merge((e.quickFix?.map(q => q.loc) ?? [e.loc])) ?? SourceLocation.invalid();
		return !locs.some(r => SourceLocation.compare(r, otherLoc) !== 0 && SourceLocation.isSubsetOf(otherLoc, r)); // there is no smaller remove
	});
}

export const UNUSED_DEFINITION = {
	/* this can be done better once we have types */
	createSearch: config => Q.all().filter(
		config.includeFunctionDefinitions ? F.or(VertexType.VariableDefinition, VertexType.FunctionDefinition) : VertexType.VariableDefinition),
	processSearchResult: async(elements, config, data): Promise<{ results: UnusedDefinitionResult[], '.meta': UnusedDefinitionMetadata }> => {
		const normalize = await data.normalize();
		const dataflow = await data.dataflow();
		const packageInfo = collectPackageInfo(data);
		const calledNames = collectCalledNames(dataflow.graph);
		const metadata: UnusedDefinitionMetadata = {
			totalConsidered: 0
		};
		return {
			results: onlyKeepSupersetOfUnused(elements.getElements().flatMap(element => {
				metadata.totalConsidered++;

				const dfgVertex = dataflow.graph.getVertex(element.node.info.id);
				if(!dfgVertex || (
					!isVariableDefinitionVertex(dfgVertex)
					&& isFunctionDefinitionVertex(dfgVertex) && !config.includeFunctionDefinitions
				)) {
					return undefined;
				}

				if(isConsideredUsed(element.node.lexeme, config, packageInfo, calledNames)) {
					return undefined;
				}

				const ingoingEdges = dataflow.graph.ingoingEdges(dfgVertex.id);

				const interestedIn = isVariableDefinitionVertex(dfgVertex) ? InterestingEdgesVariable : InterestingEdgesFunction;
				const ingoingInteresting = ingoingEdges?.values().some(e => DfEdge.includesType(e, interestedIn));

				if(ingoingInteresting) {
					return undefined;
				}

				// found an unused definition
				const variableName = element.node.lexeme;
				return [{
					certainty:  LintingResultCertainty.Uncertain,
					variableName,
					involvedId: element.node.info.id,
					loc:        SourceLocation.fromNode(element.node) ?? SourceLocation.invalid(),
					quickFix:   buildQuickFix(element.node, dataflow.graph, normalize)
				}] satisfies UnusedDefinitionResult[];
			}).filter(isNotUndefined)),
			'.meta': metadata
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Definition of \`${result.variableName}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Definition of \`${result.variableName}\` at ${SourceLocation.format(result.loc)} is unused`
	},
	info: {
		name:          'Unused Definitions',
		description:   'Checks for unused definitions.',
		tags:          [LintingRuleTag.Readability, LintingRuleTag.Smell, LintingRuleTag.QuickFix],
		// our limited analysis causes unused definitions involving complex reflection etc. not to be included in our result, but unused definitions are correctly validated
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: {
			includeFunctionDefinitions: true,
			excludeExportedDefinitions: true
		}
	}
} as const satisfies LintingRule<UnusedDefinitionResult, UnusedDefinitionMetadata, UnusedDefinitionConfig>;
