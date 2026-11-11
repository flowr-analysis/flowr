import { LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import { type FunctionsMetadata, type FunctionsResult, functionFinderUtil } from './function-finder-util';
import { LintingRuleTag } from '../linter-tags';
import { Identifier, type BrandedIdentifier } from '../../dataflow/environments/identifier';
import type { MergeableRecord } from '../../util/objects';
import { SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RIfThenElse } from '../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RUnaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RWhileLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';

export interface InteractiveFunctionsConfig extends MergeableRecord {
	/** The functions that only do their job in an interactive session, by default every built-in tagged {@link SemanticCallTag.Interactive} */
	fns: readonly Identifier[]
}

/** the calls asking whether the session is interactive */
const InteractiveChecks: ReadonlySet<BrandedIdentifier> = new Set(['interactive', 'is_interactive']);

/**
 * Whether `condition` evaluating to `holds` means the session is interactive: `interactive()` holding, `!interactive()`
 * failing, and what `&&`, `||`, `isTRUE`, and parentheses make of them (`if(!interactive() || n == 0) ... else View(d)`).
 */
function impliesInteractive(condition: RNode<ParentInformation> | undefined, holds: boolean): boolean {
	if(RExpressionList.is(condition) && condition.children.length === 1) {
		return impliesInteractive(condition.children[0], holds);
	} else if(RUnaryOp.is(condition) && condition.operator === '!') {
		return impliesInteractive(condition.operand, !holds);
	} else if(RBinaryOp.is(condition) && (condition.operator === '&&' || condition.operator === '||')) {
		/* `a && b` holds only if both do, `a || b` fails only if both do: one of them implying it is enough */
		const either = (condition.operator === '&&') === holds;
		const [lhs, rhs] = [impliesInteractive(condition.lhs, holds), impliesInteractive(condition.rhs, holds)];
		return either ? lhs || rhs : lhs && rhs;
	} else if(RFunctionCall.isNamed(condition)) {
		const name = Identifier.getName(condition.functionName.content);
		if(name === 'isTRUE') {
			return holds && impliesInteractive(RArgument.valueOf(condition.arguments[0]), true);
		}
		return holds && InteractiveChecks.has(name);
	}
	return false;
}

/** what a control dependency on `node` depends on: the condition of an `if` or a loop, the left side of `&&` and `||`, or the call itself (`stopifnot(interactive())`) */
function conditionOf(node: RNode<ParentInformation> | undefined): RNode<ParentInformation> | undefined {
	if(RIfThenElse.is(node) || RWhileLoop.is(node)) {
		return node.condition;
	} else if(RBinaryOp.is(node)) {
		return node.lhs;
	}
	return node;
}

/**
 * Whether the call only runs in an interactive session, as one of the conditions it runs under says so
 * (`if(interactive()) View(df)`, `interactive() && View(df)`, `if(!interactive()) return(); View(df)`).
 */
function guarded(id: NodeId, graph: DataflowGraph, idMap: AstIdMap): boolean {
	return graph.getVertex(id)?.cds?.some(cd => cd.when !== undefined && impliesInteractive(conditionOf(idMap.get(cd.id)), cd.when)) === true;
}

/** whether the call sits in a function, which the code may only call interactively */
function inFunction(node: RNode<ParentInformation>, idMap: AstIdMap): boolean {
	return RNode.iterateParents(node, idMap).some(RFunctionDefinition.is);
}

export const INTERACTIVE_FUNCTIONS = {
	createSearch:        config => functionFinderUtil.createSearch(config.fns),
	processSearchResult: async(elements, config, data) => {
		const idMap = (await data.normalize()).idMap;
		const graph = (await data.dataflow()).graph;
		return functionFinderUtil.processSearchResult(elements, config, data, found => found.flatMap(element => guarded(element.node.info.id, graph, idMap) ? []
			/* a function may be meant for interactive use only, the script itself is not */
			: [Object.assign(element, { certainty: inFunction(element.node, idMap) ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain })]));
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
