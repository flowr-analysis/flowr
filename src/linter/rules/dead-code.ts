import {
	prettyPrint,
	type LintingResult,
	LintingResultCertainty,
	type LintingRule,
	LintingRuleCertainty
} from '../linter-format';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import { isNotUndefined } from '../../util/assert';
import { type CfgSimplificationPassName, DefaultCfgSimplificationOrder } from '../../control-flow/cfg-simplification';
import type { Writable } from 'ts-essentials';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { F, FlowrFilter } from '../../search/flowr-search-filters';

export type DeadCodeResult = LintingResult;

export interface DeadCodeConfig extends MergeableRecord {
	/**
	 * The simplification passes that should be run on the extracted CFG.
	 * Defaults to the entries of {@link DefaultCfgSimplificationOrder} and `analyze-dead-code`.
	 */
	simplificationPasses?: readonly CfgSimplificationPassName[]
}

export const DEAD_CODE = {
	createSearch: (config) => Q.all().with(Enrichment.CfgInformation, {
		checkReachable:       true,
		simplificationPasses: config.simplificationPasses ?? [...DefaultCfgSimplificationOrder, 'analyze-dead-code']
	}).filter(F.not(F.or(
		{
			name: FlowrFilter.MatchesEnrichment,
			args: {
				enrichment: Enrichment.CfgInformation,
				test:       {
					isReachable: true
				}
			}
		},
		{
			name: FlowrFilter.RoleInParent,
			args: {
				roleInParent: RoleInParent.ExpressionListGrouping
			}
		}
	))),
	processSearchResult: async(elements, _config, data) => {
		const { idMap } = await data.normalize();
		return {
			results: combineResults(
				elements.getElements()
					.map(element => ({
						certainty:  LintingResultCertainty.Certain,
						involvedId: element.node.info.id,
						loc:        SourceLocation.fromNode(element.node)
					}))
					.filter(element => isNotUndefined(element.loc)) as Writable<DeadCodeResult>[]
			).map(result => {
				const own = ownNode(result, idMap);
				/* a branch without braces cannot just go, as `if(c)  else b` does not parse, so it becomes the empty block a braced one leaves */
				const fix = own === undefined ? undefined : isUnbracedBody(own, idMap)
					? { type: 'replace' as const, loc: result.loc, replacement: '{}', description: 'Replace the unreachable code with an empty block' }
					: isStatement(own, idMap) ? { type: 'remove' as const, loc: result.loc, description: 'Remove the unreachable code' } : undefined;
				return fix === undefined ? result : { ...result, quickFix: [fix] };
			})
		};
	},
	prettyPrint: prettyPrint(
		result => `Code at ${SourceLocation.format(result.loc)}`,
		result => `Code at ${SourceLocation.format(result.loc)} can never be executed`
	),
	info: {
		name:          'Dead Code',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility, LintingRuleTag.QuickFix],
		// our limited dead code analysis causes complex cases of dead code not to be included in the linting result, but deadness is properly investigated for returned results
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds code that is never reached during execution.',
		defaultConfig: () => ({})
	}
} as const satisfies LintingRule<DeadCodeResult, never, DeadCodeConfig>;

/** the node of the result that spans exactly what it reports, a child of a list, `undefined` if there is none */
function ownNode(result: DeadCodeResult, idMap: AstIdMap): RNode<ParentInformation> | undefined {
	const ids = Array.isArray(result.involvedId) ? result.involvedId : [result.involvedId];
	return ids.map(id => id === undefined ? undefined : idMap.get(id)).find(node => {
		const own = SourceLocation.fromNode(node);
		return node?.info.role === RoleInParent.ExpressionListChild && own !== undefined
			&& SourceLocation.isSubsetOf(result.loc, own) && SourceLocation.isSubsetOf(own, result.loc);
	});
}

/** whether the node is a whole statement of a block or the file, which can go without breaking the code around it */
function isStatement(node: RNode<ParentInformation>, idMap: AstIdMap): boolean {
	const parent = RNode.directParent(node, idMap);
	return RExpressionList.is(parent) && (parent.grouping !== undefined || parent.info.parent === undefined);
}

/** whether the node is the body of an `if` or a loop written without braces, which is a list of its own and no block */
function isUnbracedBody(node: RNode<ParentInformation>, idMap: AstIdMap): boolean {
	const parent = RNode.directParent(node, idMap);
	return RExpressionList.isImplicit(parent) && parent.info.parent !== undefined && parent.children.length === 1;
}

function combineResults(results: Writable<DeadCodeResult>[]): DeadCodeResult[] {
	for(let i = results.length - 1; i >= 0; i--) {
		const result = results[i];
		const other = results.find(other => result !== other && SourceLocation.isSubsetOf(result.loc, other.loc));
		if(other !== undefined) {
			if(!Array.isArray(other.involvedId)) {
				other.involvedId = other.involvedId !== undefined ? [other.involvedId] : [];
			}
			if(Array.isArray(result.involvedId)) {
				other.involvedId.push(...result.involvedId);
			} else if(result.involvedId !== undefined) {
				other.involvedId.push(result.involvedId);
			}
			results.splice(i, 1);
		}
	}
	return results;
}
