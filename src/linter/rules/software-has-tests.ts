import { LintingResultCertainty, type LintingResult, type LintingRule, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { FileRole } from '../../project/context/flowr-file';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';

export interface SoftwareHasTestsResult extends LintingResult {
	readonly message: string
}

export interface SoftwareHasTestsConfig extends MergeableRecord {
	/** Additional test function patterns beyond the defaults */
	readonly additionalTestFunctions: FunctionInfo[]
}

export interface SoftwareHasTestsMetadata extends MergeableRecord {
	readonly testFilesFound: number
	readonly testCallsFound: number
}

export const SOFTWARE_HAS_TESTS = {
	createSearch: (config) => Q.fromQuery({
		type:              'dependencies',
		enabledCategories: ['test'],
		...(config.additionalTestFunctions.length > 0 ? { testFunctions: config.additionalTestFunctions } : {})
	}),
	processSearchResult: (elements, _config, data) => {
		const ctx = data.inspectContext();
		const testFiles = ctx.files.getFilesByRole(FileRole.Test);
		const testCalls = elements.getElements().length;
		const hasTests = testFiles.length > 0 || testCalls > 0;
		const results: SoftwareHasTestsResult[] = hasTests ? [] : [{
			certainty:  LintingResultCertainty.Certain,
			involvedId: undefined,
			loc:        SourceLocation.invalid(),
			message:    'No tests found in the project'
		}];
		return {
			results,
			'.meta': {
				testFilesFound: testFiles.length,
				testCallsFound: testCalls
			}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result: SoftwareHasTestsResult) => result.message,
		[LintingPrettyPrintContext.Full]:  (result: SoftwareHasTestsResult) => result.message
	},
	info: {
		name:          'Software Has Tests',
		description:   'Checks whether the software project has tests (test files in a test directory or test function calls in R code).',
		tags:          [LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: {
			additionalTestFunctions: []
		}
	}
} as const satisfies LintingRule<SoftwareHasTestsResult, SoftwareHasTestsMetadata, SoftwareHasTestsConfig>;
