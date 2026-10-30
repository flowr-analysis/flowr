import { type LintingRule, LintingRuleCertainty, type LintQuickFix } from '../../linter-format';
import { RWhileLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RIfThenElse } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { FlowrFilterCombinator } from '../../../search/flowr-search-filters';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RFunctionCall, EmptyArgument  } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { callsBuiltIn } from '../../linter-util';
import { Resolve } from '../../../dataflow/environments/resolve-helper';
import { NodeValue } from '../../../dataflow/eval/resolve/node-value';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { at, type CmdCheckResult, packageInfo, printer } from './cmd-check-util';

export interface ClassStringComparisonResult extends CmdCheckResult {
	/** the class name(s) the condition compares with */
	readonly classes: readonly string[]
}

export interface ClassStringComparisonConfig extends MergeableRecord {
	/** also check the conditions of `while` loops, which `R CMD check` does not (default `true`) */
	readonly checkWhile:     boolean
	/** also flag a comparison with a variable flowR resolves to a string, which `R CMD check` cannot see (default `true`) */
	readonly resolveStrings: boolean
}

export interface ClassStringComparisonMetadata extends MergeableRecord {
	/** conditions inspected */
	readonly consideredConditions: number
}

const LogicalOps: ReadonlySet<string> = new Set(['&&', '||', '&', '|']);

/** whether the node is a call of the built-in `class`, however it is reached */
function isBuiltinClassCall(node: RNode<ParentInformation>, graph: DataflowGraph): node is RFunctionCall<ParentInformation> {
	return RFunctionCall.is(node) && node.arguments.length === 1 && node.arguments[0] !== EmptyArgument && callsBuiltIn(graph, node.info.id, 'class');
}

/** the class names `node` stands for: a string literal, or (if allowed) what flowR resolves it to */
function stringsOf(node: RNode<ParentInformation>, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, resolve: boolean): string[] | undefined {
	if(RString.is(node)) {
		return [node.content.str];
	}
	if(!resolve || !RSymbol.is(node)) {
		return undefined;
	}
	const strs = NodeValue.stringsOf(node.info.id, Resolve.info(graph, ctx));
	return strs !== undefined && strs.length > 0 ? strs : undefined;
}

interface Comparison {
	readonly node:    RNode<ParentInformation>
	readonly negated: boolean
	readonly object:  RNode<ParentInformation>
	readonly against: RNode<ParentInformation>
	readonly classes: readonly string[]
	readonly literal: boolean
}

/** the class-to-string comparisons a condition is made of, looking through `(`, `!` and the logical operators like `R CMD check` does */
function comparisonsIn(cond: RNode<ParentInformation>, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, resolve: boolean): Comparison[] {
	switch(cond.type) {
		case RType.ExpressionList:
			return cond.grouping !== undefined && cond.children.length === 1 ? comparisonsIn(cond.children[0], graph, ctx, resolve) : [];
		case RType.UnaryOp:
			return cond.operator === '!' ? comparisonsIn(cond.operand, graph, ctx, resolve) : [];
		case RType.BinaryOp: {
			if(LogicalOps.has(cond.operator)) {
				return [...comparisonsIn(cond.lhs, graph, ctx, resolve), ...comparisonsIn(cond.rhs, graph, ctx, resolve)];
			}
			if(cond.operator !== '==' && cond.operator !== '!=') {
				return [];
			}
			/* `R CMD check` only spots `class(x) == "a"`, flowR the mirrored `"a" == class(x)` as well */
			for(const [call, other] of [[cond.lhs, cond.rhs], [cond.rhs, cond.lhs]] as const) {
				if(!isBuiltinClassCall(call, graph)) {
					continue;
				}
				const classes = stringsOf(other, graph, ctx, resolve);
				const arg = call.arguments[0];
				if(classes !== undefined && arg !== EmptyArgument && arg.value !== undefined) {
					return [{ node: cond, negated: cond.operator === '!=', object: arg.value, against: other, classes, literal: RString.is(other) }];
				}
			}
			return [];
		}
		default:
			return [];
	}
}

function quickFixFor(c: Comparison): LintQuickFix[] | undefined {
	const object = RNode.lexeme(c.object);
	const against = RNode.lexeme(c.against);
	const loc = SourceLocation.fromNode(c.node);
	if(object === undefined || against === undefined || loc === undefined) {
		return undefined;
	}
	return [{
		type:        'replace',
		description: `Replace with \`${c.negated ? '!' : ''}inherits(${object}, ${against})\``,
		replacement: `${c.negated ? '!' : ''}inherits(${object}, ${against})`,
		loc
	}];
}

/**
 * Port of the `R CMD check` note "Found if() conditions comparing class() to string"
 * (`checking R code for possible problems`, `_R_CHECK_CODE_CLASS_IS_STRING_`).
 * As an object may have more than one class, `class(x) == "a"` gives a condition longer than one (an error since
 * R 4.2) or misses a subclass; `inherits(x, "a")` is what is meant.
 */
export const CLASS_STRING_COMPARISON = {
	createSearch:        () => Q.all().filter(FlowrFilterCombinator.or(RType.IfThenElse, RType.WhileLoop)),
	processSearchResult: async(elements, config, data) => {
		const ctx = data.inspectContext();
		const { graph } = await data.dataflow();
		const pkg = packageInfo(ctx);
		let considered = 0;
		const results: ClassStringComparisonResult[] = [];
		for(const { node } of elements.getElements()) {
			if(!pkg.isPackageCode(node.info.file) || (RWhileLoop.is(node) && !config.checkWhile)) {
				continue;
			}
			const cond = RIfThenElse.is(node) ? node.condition : RWhileLoop.is(node) ? node.condition : undefined;
			if(cond === undefined) {
				continue;
			}
			considered++;
			for(const c of comparisonsIn(cond, graph, ctx, config.resolveStrings)) {
				const loc = SourceLocation.fromNode(c.node);
				if(loc === undefined) {
					continue;
				}
				results.push({
					...at(c.node),
					classes:  c.classes,
					message:  `${RIfThenElse.is(node) ? 'if' : 'while'}() condition compares class() to ${c.literal ? 'a string' : 'a string variable'}, use ${c.negated ? '!' : ''}inherits() instead`,
					quickFix: quickFixFor(c)
				});
			}
		}
		return { results, '.meta': { consideredConditions: considered } };
	},
	prettyPrint: printer<ClassStringComparisonResult>(r => `class() compared to ${r.classes.map(c => JSON.stringify(c)).join(', ')}`),
	info:        {
		name:          'Class String Comparison',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.Robustness, LintingRuleTag.QuickFix],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds `if`/`while` conditions comparing `class(x)` with a string, which fail for objects with several classes. Offers `inherits(x, ...)` as a quick fix.',
		defaultConfig: () => ({
			checkWhile:     true,
			resolveStrings: true
		})
	}
} as const satisfies LintingRule<ClassStringComparisonResult, ClassStringComparisonMetadata, ClassStringComparisonConfig>;
