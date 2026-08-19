import {
	LintingPrettyPrintContext,
	type LintingResult,
	LintingResultCertainty,
	type LintingRule,
	LintingRuleCertainty
} from '../linter-format';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { isNotUndefined } from '../../util/assert';
import type { Writable } from 'ts-essentials';
import { OriginType } from '../../dataflow/origin/dfg-get-origin';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import type { DependencyInfo } from '../../queries/catalog/dependencies-query/dependencies-query-format';

export interface UnusedImportResult extends LintingResult{
	readonly version: [packageName: string, version: string | undefined]
}

export interface UnusedImportConfig extends MergeableRecord {
	/* Packages that only work on load and should therefore not be considered */
	whitelist: string[]
};

export type UnusedImportMetadata = MergeableRecord;

/**
 * Flags imported functions that are not required for the code to run. We assume this applies to packages that do not have
 * an ingoing reads-edge. We only consider packages that could be resolved from the signature database.
 */
export const UNUSED_IMPORT = {
	createSearch:        () => Q.fromQuery({ type: 'dependencies', 'enabledCategories': ['library'] }),
	processSearchResult: async(elements, config, data) => {
		const dataflow = await data.dataflow();
		const deps = data.inspectContext().deps;
		// needs a signature database to compute
		if(!deps.hasSignatureDatabase()){
			return { results: [], '.meta': {} };
		}
		const whitelist = new Set(config.whitelist);
		const unknownIds = new Set<NodeId>(dataflow.graph.unknownSideEffects.values().map(e => typeof e === 'object' && 'id' in e ? e.id : e));
		// a library call that is shadowed by a user definition tells us nothing about the package
		let uncalledLib = elements.getElements().filter(element => {
			if(unknownIds.has(element.node.info.id)) {
				return false;
			}
			const origins = Dataflow.origin(dataflow.graph, element.node.info.id);
			return !isNotUndefined(origins) || origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
		});
		// all NodeIds that have an ingoing reads-edge, with `pkg::fn` counting as a read of `pkg`
		const readEdges = new Set(dataflow.graph.edges().flatMap(e => e[1].entries()).filter(
			entry => (typeof entry[0] === 'string' && entry[0].includes('::')) || DfEdge.includesType(entry[1], EdgeType.Reads)
		).map(e => e[0]));

		uncalledLib = uncalledLib.filter(element => !readEdges.has(element.node.info.id));
		const uncalledLibSet = new Set(uncalledLib.map(element => element.node.info.id));
		const idToDependencyName = (elements.enrichmentContent(Enrichment.QueryData).queries as { dependencies: { library: DependencyInfo[] } }).dependencies.library
			.filter(element => uncalledLibSet.has(element.nodeId) && isNotUndefined(element.value) && !whitelist.has(element.value))
			.reduce((map, element) => {
				map.set(element.nodeId, element.value as string);
				return map;
			}, new Map<NodeId, string>());
		return {
			results:
			uncalledLib.filter(element =>
				// only report libraries that survived the whitelist and could be named
				idToDependencyName.has(element.node.info.id)
			).map(element => {
				const name = idToDependencyName.get(element.node.info.id) as string;
				return {
					certainty:  LintingResultCertainty.Uncertain,
					involvedId: element.node.info.id,
					loc:        SourceLocation.fromNode(element.node),
					version:    [name, deps.getDependency(name)?.resolvedVersion]
				};
			}).filter(element => isNotUndefined(element.loc)) as Writable<UnusedImportResult>[],
			'.meta': {}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Import at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => {
			const [name, version] = result.version;
			return `Import at ${SourceLocation.format(result.loc)} is unused (${version ? `${name}@${version}` : name}).`;
		}
	},
	info: {
		name:          'Unused Import',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Readability],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Flags imported packages that are not required for the code to run. Packages that are only used on load might be mistaken as such and should therefore be added to the whitelist in the configuration.',
		defaultConfig: {
			whitelist: []
		}
	}
} as const satisfies LintingRule<UnusedImportResult, UnusedImportMetadata, UnusedImportConfig>;