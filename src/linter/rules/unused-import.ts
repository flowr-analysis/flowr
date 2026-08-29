import { LintingPrettyPrintContext, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty, type LintQuickFix } from '../linter-format';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { Dataflow } from '../../dataflow/graph/df-helper';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { DfgVertex } from '../../dataflow/graph/vertex';
import type { BrandedIdentifier } from '../../dataflow/environments/identifier';
import { Identifier } from '../../dataflow/environments/identifier';
import { OriginType } from '../../dataflow/origin/dfg-get-origin';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import type { DependencyInfo } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import { LibraryFunctions } from '../../queries/catalog/dependencies-query/function-info/library-functions';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';

export interface UnusedImportResult extends LintingResult {
	/** the package the flagged call attaches */
	readonly package: string
	/** the version whose exports the finding was checked against, as the signature database resolved it */
	readonly version: string
}

export interface UnusedImportConfig extends MergeableRecord {
	/** packages that do their work on load and hence should never be reported, however unused they look */
	whitelist: readonly string[]
}

export interface UnusedImportMetadata extends MergeableRecord {
	/** attaching calls the rule looked at */
	totalConsidered:   number
	/** skipped because the database could not resolve the package the call names */
	totalUnresolved:   number
	/** skipped because one call attaches several packages at once */
	totalMultiPackage: number
	/** the attaches reported as unused */
	totalUnused:       number
}

/** one attached package, as the search found it */
interface Attachment {
	readonly id:       NodeId;
	readonly node:     RNode<ParentInformation>;
	readonly loc:      SourceLocation;
	readonly name:     string;
	readonly version:  string;
	/** the exports a bare call in this program could bind to */
	readonly callable: ReadonlySet<string>;
}

/**
 * Whether the loader a `library`-category finding came from attaches the package, taken from the one place that
 * says so. A call this does not know attaches nothing either: `pkg::fn` is reported as a loader of `pkg` and is no
 * import of its own, and neither is whatever else may come to be reported here. Matching ignores the loader's own
 * namespace, so `base::require` is caught just as well as a bare `require`.
 */
function attachesPackage(info: DependencyInfo): boolean {
	return LibraryFunctions.some(loader => loader.attaches && Identifier.matches(loader.name, info.functionName));
}

/** whether the call reaches no definition of the analyzed code itself */
function isUnbound(graph: DataflowGraph, id: NodeId): boolean {
	const origins = Dataflow.origin(graph, id);
	return origins === undefined || origins.every(o => o.type === OriginType.BuiltInFunctionOrigin);
}

/** whether removing the call would empty a slot the syntax requires, as in an unbraced `if(c) library(x)` */
function removalWouldBreakSyntax(node: RNode<ParentInformation>, idMap: AstIdMap): boolean {
	const parent = node.info.parent === undefined ? undefined : idMap.get(node.info.parent);
	return RExpressionList.isImplicit(parent) && parent.children.length === 1 && parent.info.role !== RoleInParent.Root;
}

/** whether anything reads out of the attach itself */
function isReadFrom(graph: DataflowGraph, id: NodeId): boolean {
	for(const edge of (graph.edgesTo(id)).values()) {
		if(DfEdge.includesType(edge, EdgeType.Reads)) {
			return true;
		}
	}
	return false;
}

/**
 * Which of the `attachments` the program never makes use of. A call that resolves names its package outright;
 * one that does not bind yet (a call in a function body) keeps every attached package exporting its name.
 */
function unusedPackages(attachments: readonly Attachment[], graph: DataflowGraph): ReadonlySet<string> {
	const pending = new Set(attachments.map(a => a.name));
	const unbound = new Set<BrandedIdentifier>();
	for(const [id, qualified] of Dataflow.qualifyAll(graph)) {
		const namespace = qualified === undefined ? undefined : Identifier.getNamespace(qualified);
		if(namespace !== undefined) {
			pending.delete(namespace);
			if(pending.size === 0) {
				return pending;
			}
			continue;
		}
		const vertex = graph.getVertex(id);
		if(DfgVertex.isFunctionCall(vertex) && isUnbound(graph, id)) {
			unbound.add(Identifier.getName(vertex.name));
		}
	}
	for(const { name, callable } of attachments) {
		if(!pending.has(name)) {
			continue;
		}
		for(const call of unbound) {
			if(callable.has(call)) {
				pending.delete(name);
				break;
			}
		}
	}
	return pending;
}

/**
 * Flags packages that are attached but never used, so dropping the `library`/`require` call would leave the code running
 * just the same. A package counts as used as soon as any call resolves into it or anything reads one of its exports.
 *
 * Needs a signature database to know what a package exports; without one the rule reports nothing. Packages the database
 * does not know, packages whose namespace loads with side effects, and those in the
 * {@link UnusedImportConfig#whitelist|whitelist} are skipped. Every step errs towards keeping an import.
 */
export const UNUSED_IMPORT = {
	createSearch:        () => Q.fromQuery({ type: 'dependencies', enabledCategories: ['library'] }),
	processSearchResult: async(elements, config, data) => {
		const metadata: UnusedImportMetadata = { totalConsidered: 0, totalUnresolved: 0, totalMultiPackage: 0, totalUnused: 0 };
		const deps = data.inspectContext().deps;
		if(!deps.hasSignatureDatabase()) {
			return { results: [], '.meta': metadata };
		}
		const whitelist = new Set(config.whitelist);
		// one call may name more than one package, so the query can report it several times under the same id
		const attachedBy = new Map<NodeId, DependencyInfo[]>();
		for(const info of elements.enrichmentContent(Enrichment.QueryData).queries['dependencies'].library) {
			const known = attachedBy.get(info.nodeId);
			if(known === undefined) {
				attachedBy.set(info.nodeId, [info]);
			} else {
				known.push(info);
			}
		}
		const attachments: Attachment[] = [];
		const seen = new Set<NodeId>();
		for(const { node } of elements.getElements()) {
			const infos = attachedBy.get(node.info.id);
			if(infos === undefined || seen.has(node.info.id) || !attachesPackage(infos[0])) {
				continue;
			}
			seen.add(node.info.id);
			metadata.totalConsidered++;
			if(infos.length > 1) {
				// a dynamic attach, e.g. `for(p in pkgs) library(p, character.only = TRUE)`; naming one of them would be a guess
				metadata.totalMultiPackage++;
				continue;
			}
			const name = infos[0].value;
			if(name === undefined || name === Unknown) {
				metadata.totalUnresolved++;
				continue;
			}
			if(whitelist.has(name)) {
				continue;
			}
			const pkg = deps.getDependency(name);
			const loc = SourceLocation.fromNode(node);
			if(pkg?.resolvedVersion === undefined || loc === undefined) {
				metadata.totalUnresolved++;
				continue;
			}
			if(pkg.namespaceInfo?.loadsWithSideEffects) {
				continue;
			}
			attachments.push({
				id:       node.info.id,
				node,
				loc,
				name,
				version:  pkg.resolvedVersion,
				callable: new Set(pkg.namespaceInfo?.callable)
			});
		}
		if(attachments.length === 0) {
			return { results: [], '.meta': metadata };
		}
		const { graph } = await data.dataflow();
		const idMap = (await data.normalize()).idMap;
		const unused = unusedPackages(attachments, graph);

		const results = attachments.filter(
			({ id, name }) => unused.has(name) && !isReadFrom(graph, id)
		).map(({ id, node, loc, name, version }) => ({
			certainty:  LintingResultCertainty.Uncertain,
			involvedId: id,
			loc,
			package:    name,
			version,
			quickFix:   removalWouldBreakSyntax(node, idMap) ? undefined
				: [{ type: 'remove', description: `Remove the unused import of ${name}`, loc }] as LintQuickFix[]
		}));
		metadata.totalUnused = results.length;
		return { results, '.meta': metadata };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Import of ${result.package} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Import of ${result.package} at ${SourceLocation.format(result.loc)} is unused (checked v${result.version}).`
	},
	info: {
		name:          'Unused Import',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Readability, LintingRuleTag.QuickFix],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Highlights packages that are attached but never used, so the code runs just the same without them. Requires a signature database, and packages that only do their work on load should be whitelisted in the configuration.',
		defaultConfig: {
			whitelist: []
		}
	}
} as const satisfies LintingRule<UnusedImportResult, UnusedImportMetadata, UnusedImportConfig>;
