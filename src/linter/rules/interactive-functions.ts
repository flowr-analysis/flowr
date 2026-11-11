import { LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import { type FunctionsMetadata, type FunctionsResult, functionFinderUtil } from './function-finder-util';
import { LintingRuleTag } from '../linter-tags';
import type { Identifier } from '../../dataflow/environments/identifier';
import type { MergeableRecord } from '../../util/objects';
import { SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RIfThenElse } from '../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RUnaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';

export interface InteractiveFunctionsConfig extends MergeableRecord {
	/** The functions that only do their job in an interactive session, by default every built-in tagged {@link SemanticCallTag.Interactive} */
	fns: readonly Identifier[]
}

/** Whether `condition` is `interactive()` (`asks` true) or `!interactive()` (`asks` false). */
function asksInteractive(condition: RNode<ParentInformation>, asks: boolean): boolean {
	if(RUnaryOp.is(condition) && condition.operator === '!') {
		return asksInteractive(condition.operand, !asks);
	}
	return asks && RFunctionCall.isNamed(condition, 'interactive');
}

/**
 * Whether the call only runs in an interactive session, as it sits in the branch an `interactive()` check takes
 * there (`if(interactive()) View(df)`), and whether it sits in a function, which the code may only call interactively.
 */
function placeOf(node: RNode<ParentInformation>, idMap: AstIdMap): { guarded: boolean, inFunction: boolean } {
	let child = node;
	let inFunction = false;
	for(const parent of RNode.iterateParents(node, idMap)) {
		if(RIfThenElse.is(parent) && child !== parent.condition
			&& asksInteractive(parent.condition, child === parent.then)) {
			return { guarded: true, inFunction };
		}
		inFunction ||= RFunctionDefinition.is(parent);
		child = parent;
	}
	return { guarded: false, inFunction };
}

export const INTERACTIVE_FUNCTIONS = {
	createSearch:        config => functionFinderUtil.createSearch(config.fns),
	processSearchResult: async(elements, config, data) => {
		const idMap = (await data.normalize()).idMap;
		return functionFinderUtil.processSearchResult(elements, config, data, found => found.flatMap(element => {
			const { guarded, inFunction } = placeOf(element.node, idMap);
			/* a function may be meant for interactive use only, the script itself is not */
			return guarded ? [] : [Object.assign(element, { certainty: inFunction ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain })];
		}));
	},
	prettyPrint: functionFinderUtil.prettyPrint('an interactive session, which Rscript does not have'),
	info:        {
		name:          'Interactive Functions',
		tags:          [LintingRuleTag.Reproducibility, LintingRuleTag.Smell, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds calls that only do their job in an interactive session, such as `View`, `edit`, `browser`, or `debug`, left in a script, where `Rscript` skips or stops at them. A call in the branch an `interactive()` check takes is fine, one within a function is uncertain, as the function may only be meant for interactive use.',
		defaultConfig: ctx => ({
			fns: ctx.env.deriveFromIndex(index => index.with(SemanticCallTag.Interactive))
		})
	}
} as const satisfies LintingRule<FunctionsResult, FunctionsMetadata, InteractiveFunctionsConfig>;
