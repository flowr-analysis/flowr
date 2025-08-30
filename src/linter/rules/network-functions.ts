import type { LintingRule } from '../linter-format';
import type { FunctionsMetadata, FunctionsResult, FunctionsToDetectConfig } from './function-finder-util';
import { functionFinderUtil } from './function-finder-util';

export const NETWORK_FUNCTIONS = {
	createSearch:        (config) => functionFinderUtil.createSearch(config.functionsToFind),
	processSearchResult: functionFinderUtil.processSearchResult,
	prettyPrint:         functionFinderUtil.prettyPrint('network operations'),
	info:                functionFinderUtil.info(
		'Network Functions',
		[],
		'Marks network functions that execute network operations, such as downloading files or making HTTP requests.',
		['read.table', 'read.csv', 'read.csv2', 'read.delim', 'read.delim2', 'readRDS', 'download.file', 'url', 'httr::GET', 'httr::POST', 'httr::PUT', 'httr::DELETE', 'httr::PATCH', 'httr::HEAD', 'httr::content', 'httr::handle', 'httr::get_callback','httr::VERB', 'fread', 'gzcon'],
		new RegExp("https://|(www\\.)|[a-zA-Z0-9-._~:?#\\[\\]@!$&'()*+,;=%]+")
	)
} as const satisfies LintingRule<FunctionsResult, FunctionsMetadata, FunctionsToDetectConfig>;
