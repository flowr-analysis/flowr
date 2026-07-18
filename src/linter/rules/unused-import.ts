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
		if(!(config.pkgDb !== null && typeof config.pkgDb === 'object' && 'format' in config.pkgDb && config.pkgDb.format === 'flowr-pkgdb' && 'pkgs' in config.pkgDb && (config.pkgDb as PkgDb).pkgs !== null)){
			return { results: [], '.meta': {} };
		}
		const whitelist = new Set(config.whitelist);
		const unknownIds = new Set<NodeId>();
		for(const e of dataflow.graph.unknownSideEffects) {
			unknownIds.add(typeof e === 'object' && 'id' in e ? e.id : e);
		}
		const libraryCalls = elements.enrichmentContent(Enrichment.QueryData).queries['dependencies'].library
			.filter(element => {
				//packages that could not be resolved from package database
				if(unknownIds.has(element.nodeId)){
					return false;
				}
				const origins = getOriginInDfg(dataflow.graph, element.nodeId);
				if(isNotUndefined(origins)) {
					const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
					if(!builtIn){
						return false;
					}
				}
				return true;
			});
		//all NodeIds that have an ingoing read-edge
		const readEdges = new Set(dataflow.graph.edges().flatMap(e => e[1].entries()).filter(entry => {
			//nodes with "::" are definitely read
			if(typeof entry[0] === 'string' && entry[0].includes('::')){
				return true;
			} else if(DfEdge.includesType(entry[1], EdgeType.Reads)){
				return true;
			} else{
				return false;
			}
		}).map(e => e[0]));

		const dependencyToVersion = Object.entries((config.pkgDb as PkgDb).pkgs).reduce((map, entry) => {
			map.set(entry[0], entry[1][0]);
			return map;
		}, new Map());
		const idToDependecyName = libraryCalls.filter(element => !readEdges.has(element.nodeId) && isNotUndefined(element.value) && !whitelist.has(element.value))
		.reduce((map, element) => {
			map.set(element.nodeId, element.value);
			return map;
		}, new Map());
		return {
			results:
			elements.getElements().filter(element => {
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