import { VertexType, isFunctionCallVertex } from '../../dataflow/graph/vertex';
import { getOriginInDfg } from '../../dataflow/origin/dfg-get-origin';
import { Identifier } from '../../dataflow/environments/identifier';
import { Q } from '../../search/flowr-search-builder';
import { isNotUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import { type LintingResult, type LintingRule, LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';

export interface UndefinedSymbolResult extends LintingResult {
	/** the called name that could not be resolved */
	name: string
}

export type UndefinedSymbolConfig = MergeableRecord;

export interface UndefinedSymbolMetadata extends MergeableRecord {
	totalCalls: number
}

/** calls that load a package; an unresolved one means we cannot enumerate all exports in scope */
const LibraryLoadFunctions = new Set(['library', 'require', 'requireNamespace', 'loadNamespace', 'attachNamespace', 'load_all', 'use', 'p_load']);

/**
 * Flags calls to functions that are neither defined locally, a known builtin, nor exported by a
 * package loaded via `library()`/`require()`/`use()` (resolved from the `flowr-pkgdb` database).
 * Over-approximative: reflection/NSE and packages without export info can cause false positives.
 */
export const UNDEFINED_SYMBOL = {
	createSearch:        (_config: UndefinedSymbolConfig) => Q.all().filter(VertexType.FunctionCall),
	processSearchResult: async(elements, config, data) => {
		const dataflow = await data.dataflow();
		const deps = data.inspectContext().deps;
		const meta: UndefinedSymbolMetadata = { totalCalls: 0 };

		// only report when every loaded library's exports are known: a library() whose package we could
		// not resolve is flagged with an unknown side effect and could export the symbol, so we bail out
		const unknownIds = new Set<string>();
		for(const e of dataflow.graph.unknownSideEffects) {
			unknownIds.add(String(typeof e === 'object' ? e.id : e));
		}
		if(unknownIds.size > 0) {
			for(const [id, v] of dataflow.graph.verticesOfType(VertexType.FunctionCall)) {
				if(LibraryLoadFunctions.has(Identifier.getName(v.name)) && unknownIds.has(String(id))) {
					return { results: [], '.meta': meta };
				}
			}
		}

		const results = elements.getElements().map(element => {
			const vtx = dataflow.graph.getVertex(element.node.info.id);
			if(!vtx || !isFunctionCallVertex(vtx) || vtx.origin === 'unnamed') {
				return undefined;
			}
			meta.totalCalls++;
			const name = Identifier.getName(vtx.name);
			// resolved locally, as a builtin, or as an attached package export?
			const origins = getOriginInDfg(dataflow.graph, vtx.id);
			if(origins && origins.length > 0) {
				return undefined;
			}
			// cross-check loaded packages' exports (covers namespace-only / `pkg::fn` loads)
			const namespace = Identifier.getNamespace(vtx.name);
			const known = namespace !== undefined
				? deps.getDependency(namespace)?.has(name) === true
				: deps.getDependencies().some(p => p.has(name));
			if(known) {
				return undefined;
			}
			const loc = SourceLocation.fromNode(element.node);
			return loc === undefined ? undefined : {
				certainty:  LintingResultCertainty.Uncertain,
				name,
				involvedId: vtx.id,
				loc
			} satisfies UndefinedSymbolResult;
		}).filter(isNotUndefined);

		return { results, '.meta': meta };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Call to \`${result.name}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `\`${result.name}\` at ${SourceLocation.format(result.loc)} is neither defined locally nor exported by a loaded package`
	},
	info: {
		name:          'Undefined Symbol',
		certainty:     LintingRuleCertainty.OverApproximative,
		description:   'Flags calls to functions that are neither defined locally, a known builtin, nor exported by a loaded package.',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Experimental],
		defaultConfig: {}
	}
} as const satisfies LintingRule<UndefinedSymbolResult, UndefinedSymbolMetadata, UndefinedSymbolConfig>;
