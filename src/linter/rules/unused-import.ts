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
import { VertexType, type DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { LibraryFunctions } from '../../queries/catalog/dependencies-query/function-info/library-functions';
import { pMatch } from '../../dataflow/internal/linker';
import { resolveIdToValue } from '../../dataflow/eval/resolve/alias-tracking';
import { valueSetGuard } from '../../dataflow/eval/values/general';

export interface UnusedImportResult extends LintingResult{
	readonly version: string[][]
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
	//createSearch:        () => Q.fromQuery({ type: 'call-context', callName: '^(library)|(use)|(require)$' }),
	createSearch:        () => Q.all().filter(VertexType.FunctionCall),
	processSearchResult: async(elements, config, data) => {
		const dataflow = await data.dataflow();
		//get library functions to filter out 
		let ecurrent = dataflow.environment.current;
		const usedpackages = new Set();
		while(ecurrent !== undefined){
			if(isNotUndefined(ecurrent.n)){
				usedpackages.add(ecurrent.n);
			}
			ecurrent = ecurrent.parent;
		}
		const libraryFunctions = LibraryFunctions.filter(v => usedpackages.has(v.package) || v.package === 'base').reduce((a, b) => {
			return a.add(b.name);
		}, new Set<String>)

		const deps = data.inspectContext().deps;
		const dependencyToVersion: Map<String, String> = new Map();
		for(const dep of deps.getDependencies()){
			dependencyToVersion.set(dep.name, new String(dep.deriveVersion()))
		}
		const whitelist = new Set(config.whitelist);
		const unknownIds = new Set<NodeId>();
		for(const e of dataflow.graph.unknownSideEffects) {
			unknownIds.add(typeof e === 'object' ? e.id : String(e));
		}

		//all library calls we want to test
		const libraryFCalls = elements.getElements()
			.filter(element => {
				if(isNotUndefined(element.node.lexeme) && !libraryFunctions.has(element.node.lexeme)){
					return false;
				}
				//for libraries where we can't read the export, cannot decide whether they are used or not
				if(unknownIds.has(element.node.info.id)){
					return false; 
				}
				//is of built-in origin			
			const origins = getOriginInDfg(dataflow.graph, element.node.info.id);
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
			if(DfEdge.includesType(entry[1], EdgeType.Reads)){
				return true;
			} else {
				return false; 
			}
		}).map(e => e[0]));
		return {
			results:
				libraryFCalls.filter(c => !readEdges.has(c.node.info.id))
					.map(element => {
						const fCall = dataflow.graph.getVertex(element.node.info.id) as DataflowGraphVertexFunctionCall;
						const paramMap = {
							'package':    'pkg',
						} as const;
						let arg = []
						const mapping = pMatch(fCall.args, paramMap);
						const mappedToF = mapping.get('pkg') ?? [];
						for(const argId of mappedToF) {
							const res = resolveIdToValue(argId, { graph: dataflow.graph, environment: fCall.environment, ctx: data.inspectContext() });
							const values = valueSetGuard(res);
							if(values?.type === 'set' && values.elements.length !== 0){
								for(const elem of values.elements){
									if(elem.type === 'string' && 'str' in elem.value){
										arg.push(elem.value.str)
									}
								}
							}
						}
						return {
						element: element,
						lib: arg
					}})
					//only packages for which we have a package db entry
					.filter(({ lib }) => {
						return !lib.some(v => !dependencyToVersion.has(v));
					})
					//don't consider entries in whitelist
					.filter(({ lib }) => !lib.some(v => whitelist.has(v)))
					.map(({ element, lib }) => ({
						certainty:  LintingResultCertainty.Uncertain,
						involvedId: element.node.info.id,
						loc:        SourceLocation.fromNode(element.node),
						//of form: [[package, version]]
						version:    lib.map(v => [v, dependencyToVersion.get(v)])
					}))
					.filter(element => isNotUndefined(element.loc)) as Writable<UnusedImportResult>[],
			'.meta': {}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Import at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Import at ${SourceLocation.format(result.loc)} is unused. Used version is ${result.version}.`
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