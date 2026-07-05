import { LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import { functionFinderUtil, type FunctionsMetadata, type FunctionsResult } from './function-finder-util';
import { LintingRuleTag } from '../linter-tags';
import type { MergeableRecord } from '../../util/objects';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import type { FlowrSearchElement } from '../../search/flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Ternary } from '../../util/logic';
import { SourceFunctions } from '../../queries/catalog/dependencies-query/function-info/source-functions';
import { WriteFunctions } from '../../queries/catalog/dependencies-query/function-info/write-functions';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';

export interface NetworkFunctionsConfig extends MergeableRecord {
	/**
	 * The list of function names or more detailed {@link NetworkFunction} information that should be marked in the given context if their arguments match.
	 */
	fns:                      readonly (string | NetworkFunction)[]
	/**
	 * Only trigger if the function's read argument is linked to a value that matches this pattern.
	 * This value is only used for entries in {@link fns} that are either strings, or whose {@link NetworkFunction.onlyTriggerWithArgument} value is unset.
	 */
	onlyTriggerWithArgument?: RegExp | string
}
export interface NetworkFunction extends MergeableRecord{
	/**
	 * The name of the network function to find.
	 */
	name:                     string,
	/**
	 * The {@link FunctionInfo} to use for querying the argument whose value should match {@link onlyTriggerWithArgument}.
	 * If this is not specified, flowR's default database of functions ({@link ReadFunctions}, {@link SourceFunctions} and {@link WriteFunctions}) is queried for appropriate information on the function's read argument.
	 */
	info?:                    Omit<FunctionInfo, 'name'>
	/**
	 * Only trigger if the function's read argument is linked to a value that matches this pattern through {@link info}.
	 *  If this is unset for any function, the default value from the {@link NetworkFunctionsConfig} is used.
	 */
	onlyTriggerWithArgument?: RegExp | string
}

const DefaultFunctionPool = new Map(ReadFunctions.concat(SourceFunctions, WriteFunctions).map(f => [f.name, f] as const));
export const NETWORK_FUNCTIONS = {
	createSearch:        (config) => functionFinderUtil.createSearch(config.fns.map(f => typeof f === 'string' ? f : f.name)),
	processSearchResult: (e, c, d) => {
		const fnPool = new Map<string, FunctionInfo>([
			...DefaultFunctionPool,
			...c.fns.flatMap(f => typeof f === 'string' ? [] : f.info === undefined ? [] : [[f.name, { name: f.name, ...f.info }] as const])
		]);
		const onlyTriggerLookup = new Map(c.fns.flatMap(f => typeof f === 'string' ? [] : [[f.name, f.onlyTriggerWithArgument] as const]));
		return functionFinderUtil.processSearchResult(e, c, d,
			async(es) => {
				const res: (FlowrSearchElement<ParentInformation> & { certainty: LintingResultCertainty })[] = [];
				for(const e of es) {
					const val = await functionFinderUtil.requireArgumentValue(e, fnPool, d, onlyTriggerLookup.get(e.node.lexeme ?? '') ?? c.onlyTriggerWithArgument);
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
