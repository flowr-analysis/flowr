import type { LintingResult, LintingRule } from '../linter-format';
import { LintingCertainty, LintingOutput } from '../linter-format';
import { Q } from '../../search/flowr-search-builder';
import type { MergeableRecord } from '../../util/objects';

export interface DeprecatedFunctionsResult extends LintingResult {
	someImportantNode: string
}

export interface DeprecatedFunctionsConfig extends MergeableRecord {
	doTheThing: boolean
}

export const R1_DEPRECATED_FUNCTIONS = {
	name:                'deprecated-functions',
	createSearch:        () => Q.all().build(),
	processSearchResult: (elements, config) => elements.getElements().map(element => ({
		certainty:         config.doTheThing ? LintingCertainty.Definitely : LintingCertainty.Maybe,
		someImportantNode: element.node.lexeme as string
	})),
	printers: {
		[LintingOutput.Text]: result => `${result.someImportantNode} is important, please take care`
	}
} as const satisfies LintingRule<DeprecatedFunctionsResult, DeprecatedFunctionsConfig>;
