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
import { VertexType } from '../../dataflow/graph/vertex';
import { KnownRoxygenTags } from '../../r-bridge/roxygen2/roxygen-ast';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { Identifier } from '../../dataflow/environments/identifier';

export interface RoxygenArgsResult extends LintingResult {
	readonly overDocumented?:  string[]
	readonly underDocumented?: string[]
}

export type RoxygenArgsConfig = MergeableRecord;

export type RoxygenArgsMetadata = MergeableRecord;

function calculateArgumentDiff(inheritedParams: readonly string[], functionParam: readonly string[], roxygenParam: readonly string[]): false | { under: string[], over: string[] } {
	//match documented against existing params
	const underDocumented = new Set(functionParam).difference(new Set(roxygenParam));
	let overDocumented = new Set(roxygenParam).difference(new Set(functionParam));
	//case: '...', overdocumentation not possible
	if(functionParam.includes('...')) {
		//if still remaining overdocumented parameters, "..." doesn't need to be documented
		if(overDocumented.size > 0) {
			underDocumented.delete('...');
		}
		overDocumented = new Set();
	}
	//inherited params removed from list of overdocumented params
	overDocumented = overDocumented.difference(new Set(inheritedParams));
	return underDocumented.size === 0 && overDocumented.size === 0 ? false : { under: Array.from(underDocumented), over: Array.from(overDocumented) };
}

export const ROXYGEN_ARGS = {
	createSearch: () => Q.all()
		.filter(VertexType.FunctionDefinition)
		.with(Enrichment.Roxygen),
	processSearchResult: elements => ({
		results: elements.getElements().flatMap(element => {
			const node = element.node;
			const roxygen = enrichmentContent(element, Enrichment.Roxygen);
			if(!roxygen.documentation.length) {
				return [];
			}
			//get parameter names
			const params = roxygen.tags[KnownRoxygenTags.Param] ?? [];
			const functionParamNames = getParameters(node).map(p => Identifier.make(Identifier.getName(p.name.content)).toString());
			/* one `@param a,b` documents several parameters */
			const documented = (tag: { value: { name: string } }) => tag.value.name.split(',').map(n => n.trim()).filter(n => n.length > 0);
			const inheritedParams = params.filter(tag => tag.inherited).flatMap(documented);
			const diff = calculateArgumentDiff(inheritedParams, functionParamNames, params.flatMap(documented));
			const loc = SourceLocation.fromNode(node);
			return diff === false || loc === undefined ? [] : [{
				certainty:       LintingResultCertainty.Uncertain,
				involvedId:      node.info.id,
				loc,
				underDocumented: diff.under,
				overDocumented:  diff.over
			}];
		}),
		'.meta': {}
	}),
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Function at ${SourceLocation.format(result.loc)} has ${describeArgumentDiff(result)}`,
		[LintingPrettyPrintContext.Full]:  result => `Function at ${SourceLocation.format(result.loc)} has ${describeArgumentDiff(result)}`
	},
	info: {
		name:          'Roxygen Arguments',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Documentation, LintingRuleTag.Style],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Checks whether a function has undocumented or overdocumented parameters',
		defaultConfig: () => ({})
	}
} as const satisfies LintingRule<RoxygenArgsResult, RoxygenArgsMetadata, RoxygenArgsConfig>;

function getParameters(node: RNode): readonly RParameter[] {
	return RFunctionDefinition.is(node) ? node.parameters : [];
}

function quoteAll(names: readonly string[]): string {
	return names.map(name => `'${name}'`).join(', ');
}

/** Describes the concrete mismatch between roxygen `@param` documentation and the actual function arguments. */
function describeArgumentDiff(result: RoxygenArgsResult): string {
	const parts: string[] = [];
	const under = result.underDocumented ?? [];
	const over = result.overDocumented ?? [];
	if(under.length > 0) {
		parts.push(`undocumented argument${under.length > 1 ? 's' : ''} ${quoteAll(under)}`);
	}
	if(over.length > 0) {
		parts.push(`documented @param${over.length > 1 ? 's' : ''} with no matching argument: ${quoteAll(over)}`);
	}
	return parts.join(', and ');
}
