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
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { PkgDb } from '../../project/plugins/package-version-plugins/pkgdb';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import { DependencyInfo } from '../../queries/catalog/dependencies-query/dependencies-query-format';

export interface UnusedImportResult extends LintingResult{
	readonly version: [string, string]
}

export interface UnusedImportConfig extends MergeableRecord {
	/* Packages that only work on load and should therefore not be considered */
	whitelist: string[]
};

export type UnusedImportMetadata = MergeableRecord;

/**
 * Flags imported functions that are not required for the code to run. We assume this applies to packages that do not have
 * an ingoing reads-edge. We only consider packages that could be resolved from the `flowr-pkgdb` database.
 */
export const UNUSED_IMPORT = {
	createSearch:        () => Q.fromQuery({ type: 'dependencies', 'enabledCategories': ['library'] }),
	processSearchResult: async(elements, config, data) => {
		const dataflow = await data.dataflow();
		// needs a package database to compute
		if(data.inspectContext().deps.loadedPackageDatabases().length === 0){
			return { results: [], '.meta': {} };
		}
		const dependencyToVersion = Object.entries((config.pkgDb as PkgDb).pkgs).reduce((map, entry) => {
			map.set(entry[0], entry[1][0]);
			return map;
		}, new Map());
		const whitelist = new Set(config.whitelist);
		const unknownIds = new Set<NodeId>(dataflow.graph.unknownSideEffects.values().map(e => { return typeof e === 'object' && 'id' in e ? e.id : e }));
		let uncalledLib = elements.getElements().filter(element => {
			if(unknownIds.has(element.node.info.id)){
					return false;
				}
				const origins = getOriginInDfg(dataflow.graph, element.node.info.id);
				if(isNotUndefined(origins)) {
					const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
					if(!builtIn){
						return false;
					}
				}
				return true;
		});
			//todo:idetifier get namespace 
			//packagedb kann :: erkennen, so kann man die libraries direkt rausfiltern
			//dependency query additionalAnalysis function
			// -> eigene catergorie mit den drei von additionalAnalysis und dann bekommt man die mit den punkten gar nicht überhaupt 
			//Todo: über identifier gehen um zu gucken ob es sich um einen identifier handel anstatt::
		//all NodeIds that have an ingoing read-edge
		const readEdges = new Set(dataflow.graph.edges().flatMap(e => e[1].entries()).filter(entry => {
			//nodes with "::" are definitely read
			if(typeof entry[0] === 'string' && entry[0].includes('::')/*Identifier.getNamespace(entry[1] as unknown as Identifier*/){
				return true;
			} else if(DfEdge.includesType(entry[1], EdgeType.Reads)){
				return true;
			} else{
				return false;
			}
		}).map(e => e[0]));
		
		uncalledLib = uncalledLib.filter(element => !readEdges.has(element.node.info.id));
		const uncalledLibSet = new Set(uncalledLib.map(element => element.node.info.id));
		const idToDependecyName = (elements.enrichmentContent(Enrichment.QueryData).queries as { dependencies: { library: DependencyInfo[] } }).dependencies.library.filter(element => uncalledLibSet.has(element.nodeId) && isNotUndefined(element.value) && !whitelist.has(element.value))
		.reduce((map, element) => {
			map.set(element.nodeId, element.value);
			return map;
		}, new Map());
		return {
			results:
			uncalledLib.filter(element => {
				//check that lib not whitelisted
				return  idToDependecyName.has(element.node.info.id);
			}).map(element => ({
				certainty:  LintingResultCertainty.Uncertain,
				involvedId: element.node.info.id,
				loc:        SourceLocation.fromNode(element.node),
				version:    [idToDependecyName.get(element.node.info.id), dependencyToVersion.get(idToDependecyName.get(element.node.info.id))]
		})).filter(element => isNotUndefined(element.loc)) as Writable<UnusedImportResult>[],
			'.meta': {}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Import at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Import at ${SourceLocation.format(result.loc)} is unused. Used version is ${result.version.join()}.`
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