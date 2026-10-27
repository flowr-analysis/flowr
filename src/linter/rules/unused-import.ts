import { prettyPrint, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty, type LintQuickFix } from '../linter-format';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { type DataflowGraph, UnknownSideEffect } from '../../dataflow/graph/graph';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { DfgVertex } from '../../dataflow/graph/vertex';
import type { BrandedIdentifier } from '../../dataflow/environments/identifier';
import { Identifier } from '../../dataflow/environments/identifier';
import { OriginType } from '../../dataflow/origin/dfg-get-origin';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import { attachesPackage } from '../../queries/catalog/dependencies-query/function-info/library-functions';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { PackageSignatureSource } from '../../project/sigdb/reader';
import { DepType } from '../../project/sigdb/schema';
import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';

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
	/** the packages it imports from, whose exports it may re-export, as dplyr does tibble's `glimpse` */
	readonly imports:  ReadonlySet<string>;
}

/** The packages `name` imports from apart from base R, whose exports it may re-export. */
export function nonBaseImports(src: PackageSignatureSource, name: string, version?: string): string[] {
	return src.dependencies(name, version)?.filter(d => d.type === DepType.Imports && !src.isBaseR(d.name)).map(d => d.name) ?? [];
}

/** whether the call reaches no definition of the analyzed code itself */
function isUnbound(graph: DataflowGraph, id: NodeId): boolean {
	const origins = Dataflow.origin(graph, id);
	return origins === undefined || origins.every(o => o.type === OriginType.BuiltInFunctionOrigin);
}

/** whether removing the call would empty a slot the syntax requires, as in an unbraced `if(c) library(x)` */
function removalWouldBreakSyntax(node: RNode<ParentInformation>, idMap: AstIdMap): boolean {
	const parent = RNode.directParent(node, idMap);
	return RExpressionList.isImplicit(parent) && parent.children.length === 1 && parent.info.role !== RoleInParent.Root;
}

/** whether anything reads out of the attach itself */
function isReadFrom(graph: DataflowGraph, id: NodeId): boolean {
	return graph.edgesTo(id).values().some(edge => DfEdge.includesType(edge, EdgeType.Reads));
}

/**
 * Which of the `attachments` the program never makes use of. A call that resolves names its package outright;
 * one that does not bind yet (a call in a function body) keeps every attached package exporting its name.
 */
function unusedPackages(attachments: readonly Attachment[], graph: DataflowGraph, src: PackageSignatureSource): ReadonlySet<string> {
	const pending = new Set(attachments.map(a => a.name));
	for(const [, qualified] of Dataflow.qualifyAll(graph)) {
		const namespace = qualified === undefined ? undefined : Identifier.getNamespace(qualified);
		if(namespace !== undefined && pending.delete(namespace) && pending.size === 0) {
			return pending;
		}
	}
	/* a call or a read of a name the code binds nowhere, like `percent` in `scale_y_continuous(labels = percent)` */
	const unbound = new Set<BrandedIdentifier>();
	for(const [id, vertex] of graph.vertices(true)) {
		if(DfgVertex.isFunctionCall(vertex) && Identifier.getNamespace(vertex.name) === undefined && isUnbound(graph, id)) {
			unbound.add(Identifier.getName(vertex.name));
		} else if(DfgVertex.isUse(vertex) && isUnbound(graph, id)) {
			const name = NodeId.recoverName(id, graph.idMap);
			if(name !== undefined) {
				unbound.add(Identifier.getName(name));
			}
		}
	}
	for(const { name, callable, imports } of attachments) {
		const usesPackage = (call: string) => callable.has(call) || src.packagesExporting(call).some(p => imports.has(p));
		if(pending.has(name) && unbound.values().some(usesPackage)) {
			pending.delete(name);
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
		const src = deps.signatures().sources();
		/* one call may name more than one package, so the query can report it several times under the same id */
		const libraryInfos = elements.enrichmentContent(Enrichment.QueryData).queries['dependencies'].library;
		const attachedBy = Map.groupBy(libraryInfos.filter(info => info.nodeId !== undefined), info => info.nodeId as NodeId);
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
				/* a dynamic attach, e.g. `for(p in pkgs) library(p, character.only = TRUE)`; naming one of them would be a guess */
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
				callable: new Set(pkg.namespaceInfo?.callable),
				imports:  new Set(nonBaseImports(src, name, pkg.resolvedVersion))
			});
		}
		if(attachments.length === 0) {
			return { results: [], '.meta': metadata };
		}
		const { graph } = await data.dataflow();
		const idMap = (await data.normalize()).idMap;
		/* code a `source()` flowR could not resolve runs as well and may use any attached package */
		const unseen = graph.unknownSideEffects.values().some(e => DfgVertex.hasOrigin(graph.getVertex(UnknownSideEffect.id(e)), BuiltInProcName.Source));
		const unused = unseen ? new Set<string>() : unusedPackages(attachments, graph, src);

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
	prettyPrint: prettyPrint(
		result => `Import of ${result.package} at ${SourceLocation.format(result.loc)}`,
		result => `Import of ${result.package} at ${SourceLocation.format(result.loc)} is unused (checked v${result.version}).`
	),
	info: {
		name:          'Unused Import',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Readability, LintingRuleTag.QuickFix],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds packages that are attached but never used, so the code runs just the same without them. Requires a signature database, and packages that only do their work on load should be whitelisted in the configuration.',
		defaultConfig: () => ({
			whitelist: []
		})
	}
} as const satisfies LintingRule<UnusedImportResult, UnusedImportMetadata, UnusedImportConfig>;
