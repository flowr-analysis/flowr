import { LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import type { FunctionsToDetectConfig,  FunctionsMetadata,  FunctionsResult } from './function-finder-util';
import { functionFinderUtil } from './function-finder-util';
import { LintingRuleTag } from '../linter-tags';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import type { FlowrSearchElement } from '../../search/flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Ternary } from '../../util/logic';
import { SourceFunctions } from '../../queries/catalog/dependencies-query/function-info/source-functions';
import { WriteFunctions } from '../../queries/catalog/dependencies-query/function-info/write-functions';

export interface NetworkFunctionsConfig extends FunctionsToDetectConfig {
	/** only trigger if the function's read argument is linked to a value that matches this pattern */
	onlyTriggerWithArgument?: RegExp | string
}


const FnPool = new Map(ReadFunctions.concat(SourceFunctions, WriteFunctions).map(f => [f.name, f] as const));
export const NETWORK_FUNCTIONS = {
	createSearch:        (config) => functionFinderUtil.createSearch(config.fns),
	processSearchResult: (e, c, d) => {
		return functionFinderUtil.processSearchResult(e, c, d,
			async(es) => {
				const res: (FlowrSearchElement<ParentInformation> & { certainty: LintingResultCertainty })[] = [];
				for(const e of es) {
					const val = await functionFinderUtil.requireArgumentValue(
						e,
						FnPool,
						d,
						c.onlyTriggerWithArgument);

					if(val === Ternary.Never) {
						continue;
					}
					const x = e as unknown as FlowrSearchElement<ParentInformation> & {
						certainty: LintingResultCertainty
					};
					x.certainty = val === Ternary.Always ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain;
					res.push(x);
				}
				return res;
			}
		);
	},
	prettyPrint: functionFinderUtil.prettyPrint('network operations'),
	info:        {
		name:          'Network Functions',
		tags:          [LintingRuleTag.Reproducibility, LintingRuleTag.Security, LintingRuleTag.Performance, LintingRuleTag.Smell],
		// ensures all network functions found are actually network functions through its limited config, but doesn't find all network functions since the config is pre-crawled, and the DFG may be over-approximated
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks network functions that execute network operations, such as downloading files or making HTTP requests.',
		defaultConfig: {
			fns: [
				'read.table', 'read.csv', 'read.csv2', 'read.delim', 'read.delim2', 'readRDS', 'download.file', 'url', 'GET', 'POST', 'PUT',
				'DELETE', 'PATCH', 'HEAD', 'content', 'handle', 'get_callback', 'VERB', 'fread', 'gzcon', 'readlines', 'readLines', 'source', 'load', 'curl_download',
				'curl_fetch_memory', 'getURL', 'getForm', 'read_html', 'read_xml', 'html_nodes', 'html_text', 'fromJSON', 'read.xlsx', 'drive_download', 'drive_get',
				's3read_using', 's3write_using', 'storage_download', 'AnnotationHub', 'ExperimentHub', 'scan',
				'socketConnection', 'request', 'curl'
			],
			onlyTriggerWithArgument: /^(https?|ftps?):\/\//
		}
	}
} as const satisfies LintingRule<FunctionsResult, FunctionsMetadata, NetworkFunctionsConfig>;
