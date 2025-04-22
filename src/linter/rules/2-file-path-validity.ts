import type { LintingResult, LintingRule } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';

export interface FilePathValidityResult extends LintingResult {

}

export interface FilePathValidityConfig extends MergeableRecord {

}

export const R2_FILE_PATH_VALIDITY = {
	createSearch: (_config) => Q.fromQuery({
		type:             'dependencies',
		libraryFunctions: [],
		sourceFunctions:  [],
		writeFunctions:   []
	}),
	processSearchResult: (elements, config) => elements.getElements(),
	prettyPrint:         result => '',
	defaultConfig:       {}
} as const satisfies LintingRule<FilePathValidityResult, FilePathValidityConfig>;
