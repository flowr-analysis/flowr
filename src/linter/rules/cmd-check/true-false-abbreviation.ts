import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { Identifier } from '../../../dataflow/environments/identifier';
import { DfgVertex } from '../../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RParameter } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { type CmdCheckResult, packageInfo } from './cmd-check-util';

export interface TrueFalseAbbreviationResult extends CmdCheckResult {
	/** the abbreviation used */
	readonly name: 'T' | 'F'
	/** a read of the abbreviation, or a definition masking it */
	readonly kind: 'use' | 'redefinition'
}

export interface TrueFalseAbbreviationConfig extends MergeableRecord {
	/** report definitions of `T` or `F`, which change what every later abbreviation means (default `true`) */
	readonly reportRedefinitions: boolean
}

export interface TrueFalseAbbreviationMetadata extends MergeableRecord {
	/** uses of `T`/`F` that resolve to a definition of the analyzed code and are hence left alone */
	readonly locallyDefined: number
}

const Abbreviations: Readonly<Record<string, string>> = { T: 'TRUE', F: 'FALSE' };

/**
 * Whether a read of `id` may reach the built-in constant and whether it may reach a definition of the code. As the
 * functions of a package only run once all of its top-level code has, a function reading an unconditional top-level
 * definition never sees the built-in.
 */
function reachedDefinitions(graph: DataflowGraph, id: NodeId, idMap: AstIdMap): { builtIn: boolean, local: boolean } {
	let builtIn = false;
	let local = false;
	let shadowed = false;
	const inFunction = RNode.findEnclosing(id, idMap, RFunctionDefinition.is) !== undefined;
	for(const [target, edge] of graph.edgesFrom(id)) {
		if(DfEdge.doesNotIncludeType(edge, EdgeType.Reads)) {
			continue;
		}
		if(NodeId.isBuiltIn(target)) {
			builtIn = true;
		} else {
			local = true;
			shadowed ||= inFunction && isUnconditionalTopLevel(target, idMap);
		}
	}
	return { builtIn: builtIn && !shadowed, local };
}

/** whether the node is evaluated by the top level of its file whenever the file is, i.e. not within a function or a branch */
function isUnconditionalTopLevel(id: NodeId, idMap: AstIdMap): boolean {
	for(let cur = idMap.get(id); cur?.info.parent !== undefined; cur = idMap.get(cur.info.parent)) {
		const parent = idMap.get(cur.info.parent);
		if(parent !== undefined && !RExpressionList.is(parent) && !(RBinaryOp.is(parent) && parent.lhs === cur)) {
			return false;
		}
	}
	return true;
}

/**
 * Port of the `R CMD check` note "found T/F in" (`checking R code for possible problems`, `tools::checkTnF`).
 * `T` and `F` are ordinary variables that merely default to `TRUE` and `FALSE`, so any code (or user) may rebind them.
 */
export const TRUE_FALSE_ABBREVIATION = {
	createSearch:        () => Q.all().filter(RType.Symbol),
	processSearchResult: async(elements, config, data) => {
		const { graph } = await data.dataflow();
		const idMap = (await data.normalize()).idMap;
		const pkg = packageInfo(data.inspectContext());
		const results: TrueFalseAbbreviationResult[] = [];
		let locallyDefined = 0;
		for(const { node } of elements.getElements()) {
			if(!RSymbol.is(node)) {
				continue;
			}
			const name = Identifier.getName(node.content);
			const replacement = Abbreviations[name];
			const loc = SourceLocation.fromNode(node);
			if(replacement === undefined || Identifier.getNamespace(node.content) !== undefined || loc === undefined || !pkg.isPackageCode(node.info.file)) {
				continue;
			}
			const vertex = graph.getVertex(node.info.id);
			if(DfgVertex.isVariableDefinition(vertex)) {
				/* a local `T` (a parameter, a variable of a function) only shadows within that function */
				if(config.reportRedefinitions && RNode.strictlyEnclosingFunction(node.info.id, idMap) === undefined && !RParameter.is(idMap.get(node.info.parent ?? ''))) {
					results.push({
						certainty:  LintingResultCertainty.Certain,
						involvedId: node.info.id,
						loc,
						name:       name as 'T' | 'F',
						kind:       'redefinition',
						message:    `${name} is redefined, which changes the meaning of every ${name} used as an abbreviation of ${replacement}`
					});
				}
				continue;
			}
			if(!DfgVertex.isUse(vertex)) {
				continue;
			}
			const { builtIn, local } = reachedDefinitions(graph, node.info.id, idMap);
			if(local && !builtIn) {
				locallyDefined++;
				continue;
			}
			results.push({
				certainty:  local ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain,
				involvedId: node.info.id,
				loc,
				name:       name as 'T' | 'F',
				kind:       'use',
				message:    `${name} is used as an abbreviation of ${replacement}`,
				quickFix:   [{ type: 'replace', description: `Replace \`${name}\` with \`${replacement}\``, replacement, loc }]
			});
		}
		return { results, '.meta': { locallyDefined } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.kind === 'use' ? 'Use' : 'Redefinition'} of \`${result.name}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} at ${SourceLocation.format(result.loc)}`
	},
	info: {
		name:            'TRUE/FALSE Abbreviation',
		tags:            [LintingRuleTag.CmdCheck, LintingRuleTag.Robustness, LintingRuleTag.Readability, LintingRuleTag.QuickFix],
		certainty:       LintingRuleCertainty.Exact,
		/* R CMD check only runs `checkTnF` for a package without a NAMESPACE, which no current package is */
		activeByDefault: false,
		description:     'Finds `T` and `F` used for `TRUE` and `FALSE`, and top-level definitions of `T` or `F`. Off by default, as R only checks this for packages without a NAMESPACE.',
		defaultConfig:   () => ({
			reportRedefinitions: true
		})
	}
} as const satisfies LintingRule<TrueFalseAbbreviationResult, TrueFalseAbbreviationMetadata, TrueFalseAbbreviationConfig>;
