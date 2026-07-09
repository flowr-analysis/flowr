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
import { isNotUndefined, isUndefined } from '../../util/assert';
import type { Writable } from 'ts-essentials';
import { VertexType } from '../../dataflow/graph/vertex';
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import { EdgeType } from '../../dataflow/graph/edge';
import { Identifier } from '../../dataflow/environments/identifier';
import type { PkgDbSource } from '../../project/plugins/package-version-plugins/flowr-analyzer-package-versions-pkgdb-plugin';

export type UnusedImportResult = LintingResult;

export interface UnusedImportConfig extends MergeableRecord {
	pkgDb: PkgDbSource | undefined
};

export type UnusedImportMetadata = MergeableRecord;

const LibraryLoadFunctions = new Set(['library', 'require', 'requireNamespace', 'loadNamespace', 'attachNamespace', 'load_all', 'use', 'p_load']);



export const UNUSED_IMPORT = {
	createSearch: () => Q.var('library')
		.filter(VertexType.FunctionCall),
	processSearchResult: async(elements, _config, data) => {
		const dataflow = await data.dataflow();
		return {
			results:
				elements.getElements()
					.filter(element => {
						//if can't export we don't know if it used or not
						const unknownIds = new Set<string>();
						for(const e of dataflow.graph.unknownSideEffects) {
							unknownIds.add(String(typeof e === 'object' ? e.id : e));
						}
						if(unknownIds.size > 0) {
							for(const [id, v] of dataflow.graph.verticesOfType(VertexType.FunctionCall)) {
								if(LibraryLoadFunctions.has(Identifier.getName(v.name)) && unknownIds.has(String(id))) {
									return false;
								}
							}
						}

						const origins = getOriginInDfg(dataflow.graph, element.node.info.id);
						if(isNotUndefined(origins)) {
							const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
							if(!builtIn){
								return false;
							}
						}
						return isUndefined(dataflow.graph.ingoingEdges(element.node.info.id)) || dataflow.graph.ingoingEdges(element.node.info.id)?.values().filter(edge => edge.types === EdgeType.Calls + EdgeType.Reads).toArray().length === 0;
					})/*.map(v => {
						console.log(v)
						console.log('loc', SourceLocation.fromNode(v.node))
						return v
					})*/
					.map(element => ({
						certainty:  LintingResultCertainty.Uncertain,
						involvedId: element.node.info.id,
						loc:        SourceLocation.fromNode(element.node)
					}))
					.filter(element => isNotUndefined(element.loc)) as Writable<UnusedImportResult>[],
			'.meta': {}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Code at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Code at ${SourceLocation.format(result.loc)} is an unused package.`
	},
	info: {
		name:          'Unused Import',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Readability],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Checks whether an imported package is used.',
		defaultConfig: {
			pkgDb: undefined
		}
	}
} as const satisfies LintingRule<UnusedImportResult, UnusedImportMetadata, UnusedImportConfig>;