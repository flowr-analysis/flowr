import { VertexType } from '../../dataflow/graph/vertex';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import type { MergeableRecord } from '../../util/objects';
import type { SourceRange } from '../../util/range';
import { LintingCertainty, type LintingResult, type LintingRule } from '../linter-format';


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

function tryFixCasing(identifier: string, _detectedCasing: CasingConvention, _wantedCasing: CasingConvention) {
	return identifier; // TODO
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
				suggestion: tryFixCasing(m.name, m.detectedCasing, config.caseing)
			}));
        
		return {
			results: results,
			'.meta': { idk: 0 }
		};   
	},
	prettyPrint:   result => `Identifier '${result.name}' at ${formatRange(result.range)} follows wrong casing convention`,
	defaultConfig: {
		caseing: CasingConvention.PascalCase
	}
} as const satisfies LintingRule<NamingConventionResult, NamingConventionMetadata, NamingConventionConfig>;

