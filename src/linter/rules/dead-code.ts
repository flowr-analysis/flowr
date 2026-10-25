import {
	prettyPrint,
	type LintingResult,
	LintingResultCertainty,
	type LintingRule,
	LintingRuleCertainty
} from '../linter-format';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
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
			).map(result => isStatement(result, idMap) ? { ...result, quickFix: [{ type: 'remove', loc: result.loc, description: 'Remove the unreachable code' }] } : result)
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

/** whether the result is a whole statement of a block or the file, which can go without breaking the code around it */
function isStatement(result: DeadCodeResult, idMap: AstIdMap): boolean {
	const ids = Array.isArray(result.involvedId) ? result.involvedId : [result.involvedId];
	return ids.some(id => {
		const node = id === undefined ? undefined : idMap.get(id);
		const parent = node?.info.parent === undefined ? undefined : idMap.get(node.info.parent);
		/* the branch of an `if` without braces is a list of its own, which is no block */
		const own = SourceLocation.fromNode(node);
		return node?.info.role === RoleInParent.ExpressionListChild && RExpressionList.is(parent)
			&& (parent.grouping !== undefined || parent.info.parent === undefined)
			&& own !== undefined && SourceLocation.isSubsetOf(result.loc, own) && SourceLocation.isSubsetOf(own, result.loc);
	});
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
