import type { DataflowGraph } from '../../dataflow/graph/graph';
import { VertexType } from '../../dataflow/graph/vertex';
import { getAllRefsToSymbol } from '../../dataflow/origin/dfg-get-symbol-refs';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Q } from '../../search/flowr-search-builder';
import { assertUnreachable } from '../../util/assert';
import { formatRange } from '../../util/mermaid/dfg';
import type { MergeableRecord } from '../../util/objects';
import type { SourceRange } from '../../util/range';
import type { LintingResult, LintingRule, LintQuickFixReplacement } from '../linter-format';
import { LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';


export enum CasingConvention {
    CamelCase       = 'camelCase',
    PascalCase      = 'PascalCase',
    SnakeCase       = 'snake_case',
    ConstantCase    = 'CONSTANT_CASE', 
    CamelSnakeCase  = 'camel_Snake_Case', 
    PascalSnakeCase = 'Pascal_Snake_Case',
    Unknown         = 'unknown'
}

export interface NamingConventionResult extends LintingResult {
    name:           string,
    detectedCasing: CasingConvention,
    range:          SourceRange,
}

/**
 * It is planned to have a config like ESLint
 */
export interface NamingConventionConfig extends MergeableRecord {
    caseing: CasingConvention | 'auto'
}

export interface NamingConventionMetadata extends MergeableRecord {
	/** number of symbols matching the casing convetion */
    numMatches: number

	/** number of symbols breaking the casing convetion */
	numBreak: number;

}

export function detectCasing(identifier: string): CasingConvention {
	if(identifier.trim() === '') {
		return CasingConvention.Unknown;
	}

	const upper = identifier.toUpperCase();
	const lower = identifier.toLowerCase();
	const isAllUpper = identifier === upper;
	const isAllLower = identifier === lower;
	
	if(identifier.includes('_')) {
		if(isAllUpper) { // CONSTANT_CASE
			return CasingConvention.ConstantCase;
		} else if(isAllLower) { // snake_case
			return CasingConvention.SnakeCase;
		} 

		// Returns true if the letter after an _ is uppercase
		function expectUpperAfterScore(identifier: string) {
			for(let i = 0; i < identifier.length - 1; i++) {
				if(identifier[i] === '_') {
					if(identifier[i+1] !== upper[i+1]) {
						return false;
					}
				}
			}

			return true;
		}

		if(identifier[0] === lower[0] && expectUpperAfterScore(identifier)) {  // camel_Snake_Case
			return CasingConvention.CamelSnakeCase; 
		} else if(identifier[0] === upper[0] && expectUpperAfterScore(identifier)) { // Pascal_Snake_Case
			return CasingConvention.PascalSnakeCase;
		}
	} else {	
		if(identifier[0] === lower[0]) { // camelCase
			return CasingConvention.CamelCase;
		} else if(identifier[0] === upper[0]) { // PascalCase
			return CasingConvention.PascalCase;
		}
	}  

	return CasingConvention.Unknown;
}

export function getMostUsedCasing(symbols: { detectedCasing: CasingConvention }[] ): CasingConvention {
	if(symbols.length === 0) {
		return CasingConvention.Unknown;
	}

	const map = new Map<CasingConvention, number>();

	for(const symbol of symbols) {
		const o = map.get(symbol.detectedCasing) ?? 0;
		map.set(symbol.detectedCasing, o + 1);
	}

	// Return element with most occurances 
	return [...map].reduce((p, c) => p[1] > c[1] ? p : c)[0];
}

export function fixCasing(identifier: string, convention: CasingConvention): string {
	const tokens = identifier.split(/(?=[A-Z])|_/).map(s => s.toLowerCase());

	const firstUp = (s: string) => `${s[0].toUpperCase()}${s.substring(1)}`;

	switch(convention) {
		case CasingConvention.CamelCase: // camelCase
			return `${tokens[0]}${tokens.slice(1).map(firstUp).join('')}`;
		case CasingConvention.PascalCase: // PascalCase
			return tokens.map(firstUp).join('');
		case CasingConvention.SnakeCase: // snake_case
			return tokens.join('_');
		case CasingConvention.ConstantCase: // CONSTANT_CASE
			return tokens.map(s => s.toUpperCase()).join('_');
		case CasingConvention.CamelSnakeCase: // camel_Snake_Case
			return `${tokens[0]}_${tokens.slice(1).map(firstUp).join('_')}`;
		case CasingConvention.PascalSnakeCase: // Pascal_Snake_Case
			return tokens.map(firstUp).join('_');
		case CasingConvention.Unknown:
			return identifier;
		default:
			assertUnreachable(convention);
	}
}

export function createNamingConventionQuickFixes(graph: DataflowGraph, nodeId: NodeId, replacement: string, conv: CasingConvention): LintQuickFixReplacement[] | undefined {
	const refs = getAllRefsToSymbol(graph, nodeId);
	const idMap = graph.idMap;
	if(refs === undefined || idMap === undefined) {
		return undefined;
	}

	const result: LintQuickFixReplacement[] = [];
	for(const ref of refs) {
		const node  = idMap.get(ref);
		if(node === undefined) {
			continue;
		}

		const range = node.info.fullRange;
		if(range) {
			// In case of a function call we only need to include the name, not the '()'
			range[3] = range[1] + (node.lexeme as string).length - 1;

			result.push(
				{
					type:        'replace',
					replacement: replacement,
					description: `Rename to match naming convention ${conv}`,
					range:       range
				} satisfies LintQuickFixReplacement
			);
		}
	}

	return result.length === 0 ? 
		undefined : // We sort so that when applied in order the fixes will start from the end of the line to avoid conflicts
		result.sort((a, b) => a.range[0] == b.range[0] ? b.range[1] - a.range[1] : b.range[0] - a.range[0]);
}

export const NAMING_CONVENTION = {
	createSearch:        (_config) => Q.all().filter(VertexType.VariableDefinition),
	processSearchResult: (elements, config, data) =>  {
		const symbols = elements.getElements()
			.map(m => ({
				certainty:      LintingResultCertainty.Certain,
				detectedCasing: detectCasing(m.node.lexeme as string),
				name:           m.node.lexeme as string,
				range:          m.node.info.fullRange as SourceRange,
				id:             m.node.info.id
			}));
		const casing = config.caseing === 'auto' ? getMostUsedCasing(symbols) : config.caseing;
		const results = symbols.filter(m => m.detectedCasing !== casing)
			.map(({ id, ...m }) => ({
				...m,
				quickFix: createNamingConventionQuickFixes(data.dataflow.graph, id, fixCasing(m.name, casing), casing)
			}));
		
		return {
			results: results,
			'.meta': { 
				numMatches: symbols.length - results.length,
				numBreak:   results.length
			}
		};   
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Identifier '${result.name}' at ${formatRange(result.range)} (${result.detectedCasing})`,
		[LintingPrettyPrintContext.Full]:  result => `Identifier '${result.name}' at ${formatRange(result.range)} follows wrong convention: ${result.detectedCasing}`
	},
	info: {
		name:          'Naming Convention',
		// detects casing heuristically so correctness is not ensured using default config, but checks all identifiers in the code for naming convention match
		certainty:     LintingRuleCertainty.OverApproximative,
		description:   'Checks wether the symbols conform to a certain naming convention',
		tags:          [LintingRuleTag.Style, LintingRuleTag.QuickFix],
		defaultConfig: {
			caseing: 'auto'
		}
	}
} as const satisfies LintingRule<NamingConventionResult, NamingConventionMetadata, NamingConventionConfig>;
