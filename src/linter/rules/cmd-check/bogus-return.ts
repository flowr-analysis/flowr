import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { Identifier } from '../../../dataflow/environments/identifier';
import { DfgVertex } from '../../../dataflow/graph/vertex';
import { EdgeType } from '../../../dataflow/graph/edge';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { boundName, type CmdCheckResult, isQuoted, packageInfo } from './cmd-check-util';

export interface BogusReturnResult extends CmdCheckResult {
	/** the name of the function the bare `return` is in, if it is bound to one */
	readonly function?: string
}

export type BogusReturnConfig = MergeableRecord;

export type BogusReturnMetadata = MergeableRecord;

/**
 * Port of the `R CMD check` note "Possibly missing '()' after 'return'" (`checking R code for possible problems`,
 * `tools:::.check_bogus_return`). A bare `return` does not leave the function, it evaluates to the function `return`.
 */
export const BOGUS_RETURN = {
	createSearch:        () => Q.all().filter(RType.Symbol),
	processSearchResult: async(elements, _config, data) => {
		const { graph } = await data.dataflow();
		const idMap = (await data.normalize()).idMap;
		const pkg = packageInfo(data.inspectContext());
		const results: BogusReturnResult[] = [];
		for(const { node } of elements.getElements()) {
			if(!RSymbol.is(node) || Identifier.getName(node.content) !== 'return' || !pkg.isPackageCode(node.info.file)) {
				continue;
			}
			/* a call of `return` has a call vertex, a bare read is a use that resolves to the built-in */
			const vertex = graph.getVertex(node.info.id);
			const loc = SourceLocation.fromNode(node);
			if(!DfgVertex.isUse(vertex) || loc === undefined || isQuoted(graph, node.info.id, idMap)) {
				continue;
			}
			const targets = Dataflow.targetsOf(graph, node.info.id, EdgeType.Reads);
			if(targets.some(t => !NodeId.isBuiltIn(t))) {
				continue;
			}
			const fn = idMap.get(RNode.findEnclosing(node.info.id, idMap, RFunctionDefinition.is) ?? '');
			if(fn === undefined) {
				continue;
			}
			const name = boundName(fn, idMap);
			results.push({
				certainty:  LintingResultCertainty.Certain,
				involvedId: node.info.id,
				loc,
				function:   name,
				message:    `Possibly missing '()' after 'return'${name ? ` in ${name}` : ''}, a bare return evaluates to the function itself`,
				quickFix:   [{ type: 'replace', description: 'Call `return()`', replacement: 'return()', loc }]
			});
		}
		return { results, '.meta': {} };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Bare \`return\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} at ${SourceLocation.format(result.loc)}`
	},
	info: {
		name:          'Bogus Return',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.QuickFix],
		certainty:     LintingRuleCertainty.Exact,
		description:   'Port of the `R CMD check` note *"Possibly missing \'()\' after \'return\'"* (`checking R code for possible problems`). A bare `return` within a function does not return, it merely evaluates to the function `return`. Unlike `R CMD check`, which reports the enclosing function, flowR reports each bare `return`, offers `return()` as a quick fix, and ignores a `return` the code defines itself.',
		defaultConfig: () => ({})
	}
} as const satisfies LintingRule<BogusReturnResult, BogusReturnMetadata, BogusReturnConfig>;
