import { VertexType } from '../../dataflow/graph/vertex';
import { Q } from '../../search/flowr-search-builder';
import { assertUnreachable } from '../../util/assert';
import { formatRange } from '../../util/mermaid/dfg';
import type { MergeableRecord } from '../../util/objects';
import type { SourceRange } from '../../util/range';
import { LintingCertainty, type LintingResult, type LintingRule } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';


export enum CasingConvention {
    FlatCase        = 'flatcase',
    Uppercase       = 'UPPERCASE',
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
    suggestion:     string,
    range:          SourceRange,
}

export interface NamingConventionConfig extends MergeableRecord {
    caseing: CasingConvention
}

export interface NamingConventionMetadata extends MergeableRecord {
    idk: number
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
		} else {
			return CasingConvention.Unknown;
		}
	}  

	if(isAllUpper) { // UPPERCASE
		return CasingConvention.Uppercase;
	} else if(isAllLower) { // flatcase
		return CasingConvention.FlatCase; 
	} 

	if(identifier[0] === lower[0]) { // camelCase
		return CasingConvention.CamelCase;
	} else if(identifier[0] === upper[0]) { // PascalCase
		return CasingConvention.PascalCase;
	}

	return CasingConvention.Unknown;
}

export function tryFixCasing(identifier: string, convention: CasingConvention) {
	const tokens = identifier.split(/(?=[A-Z])|_/).map(s => s.toLowerCase());

	const firstUp = (s: string) => `${s[0].toUpperCase()}${s.substring(1)}`;

	switch(convention) {
		case CasingConvention.FlatCase: // flatcase
			return tokens.join(''); 
		case CasingConvention.Uppercase: // UPPERCASE
			return tokens.join('').toUpperCase();
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

export const NAMING_CONVENTION = {
	createSearch:        (_config) => Q.all().filter(VertexType.VariableDefinition),
	processSearchResult: (elements, config) =>  {
		const results = elements.getElements()
			.map(m => ({
				certainty:      LintingCertainty.Definitely,
				detectedCasing: detectCasing(m.node.content as string),
				name:           m.node.content as string,
				range:          m.node.info.fullRange as SourceRange
			}))
			.filter(m => m.detectedCasing !== config.caseing)
			.map(m => ({
				...m,
				suggestion: tryFixCasing(m.name, config.caseing)
			}));
        
		return {
			results: results,
			'.meta': { idk: 0 }
		};   
	},
	prettyPrint: result => `Identifier '${result.name}' at ${formatRange(result.range)} follows ${result.detectedCasing} convention. Suggestion: '${result.suggestion}'`,
	info:        {
		name:          'Naming Convention',
		description:   'Checks wether the symbols conform to a certain naming convention',
		tags:          [LintingRuleTag.Style, LintingRuleTag.QuickFix],
		defaultConfig: {
			caseing: CasingConvention.PascalCase
		}
	}
} as const satisfies LintingRule<NamingConventionResult, NamingConventionMetadata, NamingConventionConfig>;

