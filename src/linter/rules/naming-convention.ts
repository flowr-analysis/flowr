import type { DataflowGraph } from '../../dataflow/graph/graph';
import { VertexType } from '../../dataflow/graph/vertex';
import { getAllRefsToSymbol } from '../../dataflow/origin/dfg-get-symbol-refs';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Q } from '../../search/flowr-search-builder';
import { assertUnreachable } from '../../util/assert';
import { formatRange } from '../../util/mermaid/dfg';
import type { MergeableRecord } from '../../util/objects';
import type { SourceRange } from '../../util/range';
import { type LintingResult, type LintingRule, type LintQuickFixReplacement, LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
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
	/** which casing convention to enforce */
	caseing: CasingConvention | 'auto'

	/** if true non alphabetic characters are ignored */
	ignoreNonAlpha: boolean;
}

export interface NamingConventionMetadata extends MergeableRecord {
	/** number of symbols matching the casing convetion */
	numMatches: number

	/** number of symbols breaking the casing convetion */
	numBreak: number;
}

function containsAlpha(s: string): boolean {
	return /[A-Za-z]/.test(s);
}

/**
 * Attempts to detect the possible casing conventions used in the given identifier and returns an array ordered by likelihood of the casing convention being correct.
 */
export function detectPotentialCasings(identifier: string): CasingConvention[] {
	if(identifier.trim() === '' || !containsAlpha(identifier)) {
		return [];
	}

	const upper = identifier.toUpperCase();
	const lower = identifier.toLowerCase();
	const isAllUpper = identifier === upper;
	const isAllLower = identifier === lower;
	const hasUnderscores = identifier.includes('_');
	const upperAfterAllScores = Array(identifier.length-1).keys().every(i =>
		identifier[i] !== '_' || identifier[i + 1] === upper[i + 1]);
	const hasAnyUpperAfterLower = Array(identifier.length-1).keys().some(i =>
		containsAlpha(identifier[i]) && identifier[i] === lower[i] &&
		containsAlpha(identifier[i + 1]) && identifier[i + 1] === upper[i + 1]);

	const matches: CasingConvention[] = [];
	if(!hasUnderscores && identifier[0] === lower[0]) {
		matches.push(CasingConvention.CamelCase); // camelCase
	}
	if(!hasUnderscores && identifier[0] === upper[0] && !isAllUpper) {
		matches.push(CasingConvention.PascalCase); // PascalCase or Pascalcase
	}
	if(isAllUpper) {
		matches.push(CasingConvention.ConstantCase); // CONSTANT_CASE or CONSTANTCASE
	}
	if(isAllLower) {
		matches.push(CasingConvention.SnakeCase); // snake_case or snakecase or snakecase_
	}
	if(upperAfterAllScores && identifier[0] === lower[0] && !isAllUpper && hasUnderscores || (!hasUnderscores && isAllLower)) {
		matches.push(CasingConvention.CamelSnakeCase); // camel_Snake_Case or camelsnakecase or camelsnakecase_
	}
	if(upperAfterAllScores && identifier[0] === upper[0] && !isAllUpper && !hasAnyUpperAfterLower) {
		matches.push(CasingConvention.PascalSnakeCase); // Pascal_Snake_Case or Pascalsnakecase
	}
	return matches;
}

/**
 * Attempts to detect the possible casing conventions used in the given identifier and returns the first result.
 * The function {@link detectPotentialCasings} is generally preferred, as it returns all potential casings and not just the first one.
 */
export function detectCasing(identifier: string): CasingConvention {
	const casings = detectPotentialCasings(identifier);
	return casings.length > 0 ? casings[0] : CasingConvention.Unknown;
}

/**
 * Determines the most used casing convention in the given list of symbols.
 */
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

/**
 * Attempts to fix the casing of the given identifier to match the provided convention.
 */
export function fixCasing(identifier: string, convention: CasingConvention): string | undefined {
	if(!containsAlpha(identifier)) {
		return undefined;
	}

	const tokens = identifier.split(/(?=[A-Z])|_/).map(s => s.toLowerCase());

	const firstUp = (s: string) => {
		if(s.length < 1) {
			return s.toUpperCase();
		}

		return `${s[0].toUpperCase()}${s.substring(1)}`;
	};

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

/**
 * Creates quick fixes for renaming all references to the given node to match the provided replacement.
 */
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
		const results = symbols
			.filter(m => (m.detectedCasing !== casing) && (!config.ignoreNonAlpha || containsAlpha(m.name)))
			.map(({ id, ...m }) => {
				const fix = fixCasing(m.name, casing);
				return {
					...m,
					involvedId: id,
					quickFix:   fix ? createNamingConventionQuickFixes(data.dataflow.graph, id, fix, casing) : undefined
				};
			});
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
		description:   'Checks whether the symbols conform to a certain naming convention',
		tags:          [LintingRuleTag.Style, LintingRuleTag.QuickFix],
		defaultConfig: {
			caseing:        'auto',
			ignoreNonAlpha: true
		}
	}
} as const satisfies LintingRule<NamingConventionResult, NamingConventionMetadata, NamingConventionConfig>;
