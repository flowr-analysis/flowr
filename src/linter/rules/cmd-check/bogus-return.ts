import { type LintingRule, LintingRuleCertainty } from '../../linter-format';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { DfgVertex } from '../../../dataflow/graph/vertex';
import { EdgeType } from '../../../dataflow/graph/edge';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { at, boundName, type CmdCheckResult, isQuoted, packageInfo, printer } from './cmd-check-util';

export interface BogusReturnResult extends CmdCheckResult {
	/** the name of the function the bare `return` is in, if it is bound to one */
	readonly function?: string
}

export type BogusReturnConfig = MergeableRecord;

export type BogusReturnMetadata = MergeableRecord;

/** Port of the `R CMD check` note "Possibly missing '()' after 'return'". */
export const BOGUS_RETURN = {
	createSearch:        () => Q.all().filter(RType.Symbol),
	processSearchResult: async(elements, _config, data) => {
		const { graph } = await data.dataflow();
		const idMap = (await data.normalize()).idMap;
		const pkg = packageInfo(data.inspectContext());
		const results: BogusReturnResult[] = [];
		for(const { node } of elements.getElements()) {
			if(!RSymbol.is(node) || !pkg.isPackageCode(node.info.file)) {
				continue;
			}
			/* a call of `return` has a call vertex, a bare read is a use that resolves to the built-in */
			const vertex = graph.getVertex(node.info.id);
			const loc = SourceLocation.fromNode(node);
			const targets = DfgVertex.isUse(vertex) ? Dataflow.targetsOf(graph, node.info.id, EdgeType.Reads) : [];
			if(loc === undefined || targets.length === 0 || !targets.every(t => NodeId.isBuiltIn(t) && NodeId.fromBuiltIn(t) === 'return') || isQuoted(graph, node.info.id, idMap)) {
				continue;
			}
			const fn = idMap.get(RNode.findEnclosing(node.info.id, idMap, RFunctionDefinition.is) ?? '');
			if(fn === undefined) {
				continue;
			}
			const name = boundName(fn, idMap);
			results.push({
				...at(node),
				function: name,
				message:  `Possibly missing '()' after 'return'${name ? ` in ${name}` : ''}, a bare return evaluates to the function itself`,
				quickFix: [{ type: 'replace', description: 'Call `return()`', replacement: 'return()', loc }]
			});
		}
		return { results, '.meta': {} };
	},
	prettyPrint: printer<BogusReturnResult>(() => 'Bare `return`'),
	info:        {
		name:          'Bogus Return',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.QuickFix],
		certainty:     LintingRuleCertainty.Exact,
		description:   'Finds a bare `return` (without `()`), which evaluates to the function `return` instead of returning. Offers `return()` as a quick fix.',
		defaultConfig: () => ({})
	}
} as const satisfies LintingRule<BogusReturnResult, BogusReturnMetadata, BogusReturnConfig>;
