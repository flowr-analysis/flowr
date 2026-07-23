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
import { Identifier } from '../../dataflow/environments/identifier';
import { Dataflow } from '../../dataflow/graph/df-helper';

export interface NetworkFunctionsConfig extends MergeableRecord {
	/**
	 * The list of function names or more detailed {@link NetworkFunction} information that should be marked in the given context if their arguments match.
	 */
	fns: readonly (Identifier | NetworkFunction)[]
}
export interface NetworkFunction extends MergeableRecord{
	/**
	 * The name of the network function to find.
	 */
	name:                     Identifier,
	/**
	 * The {@link FunctionInfo} to use for querying the argument whose value should match {@link onlyTriggerWithArgument}.
	 * If this is not specified, flowR's default database of functions ({@link ReadFunctions}, {@link SourceFunctions} and {@link WriteFunctions}) is queried for appropriate information on the function's read argument.
	 */
	info?:                    Omit<FunctionInfo, 'name'>
	/**
	 * Only trigger if the function's read argument is linked to a value that matches this pattern through {@link info}.
	 * If this is unset, the read argument is not queried for whether its value matches a pattern.
	 */
	onlyTriggerWithArgument?: RegExp | string
}

const DefaultFunctionPool = new Map(ReadFunctions.concat(SourceFunctions, WriteFunctions).map(f => [Identifier.toString(Identifier.make(f.name, f.package)), f] as const));
export const NETWORK_FUNCTIONS = {
	createSearch:        (config) => functionFinderUtil.createSearch(config.fns.map(f => Identifier.is(f) ? f : f.name)),
	processSearchResult: async(e, c, d) => {
		const df = await d.dataflow();
		const fnPool = new Map<string, FunctionInfo>([
			...DefaultFunctionPool,
			...c.fns.flatMap(f => Identifier.is(f) ? [] : f.info === undefined ? [] : [[Identifier.toString(f.name), { name: Identifier.toString(f.name), ...f.info }] as const])
		]);
		const onlyTriggerLookup = new Map(c.fns.flatMap(f => Identifier.is(f) ? [] : [[Identifier.toString(f.name), f.onlyTriggerWithArgument] as const]));
		return functionFinderUtil.processSearchResult(e, c, d,
			async(es) => {
				const res: (FlowrSearchElement<ParentInformation> & { certainty: LintingResultCertainty })[] = [];
				for(const e of es) {
					// TODO das gibt manchmal undefined zurück und ich verstehe noch nicht so ganz wieso :( benutze ich das richtig?
					const identifier = Dataflow.qualify(e.node.info.id, df.graph);
					if(identifier === undefined) {
						continue;
					}
					// we allow onlyTriggerLookup to contain non-namespaced functions
					const requireValue = onlyTriggerLookup.get(Identifier.toString(identifier)) ?? onlyTriggerLookup.get(Identifier.getName(identifier));
					const val = await functionFinderUtil.requireArgumentValue(e, fnPool, d, requireValue);
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
				// subset of default network functions provided by manually reviewed results from analysis based on the signature database, see the dirty-network-funcs-test branch there
				...['oauth_endpoint', 'DELETE', 'PATCH', 'HEAD', 'GET', 'POST', 'PUT', 'BROWSE', 'RETRY', 'VERB', 'content', 'handle', 'get_callback', 'VERB'].map(f => Identifier.make(f, 'httr')),
				...['read.table', 'read.csv', 'read.csv2', 'read.delim', 'read.delim2', 'download.file'].map(f => Identifier.make(f, 'utils')),
				...['socketConnection', 'readRDS', 'url', 'gzcon', 'readlines', 'readLines', 'source', 'load', 'scan'].map(f => Identifier.make(f, 'base')),
				...['nslookup', 'new_handle', 'multi_download', 'curl', 'curl_upload', 'curl_echo', 'curl_download', 'curl_fetch_memory'].map(f => Identifier.make(f, 'curl')),
				...['read_html', 'read_xml'].map(f => Identifier.make(f, 'xml2')),
				...['download_html', 'html_nodes', 'html_text'].map(f => Identifier.make(f, 'rvest')),
				...['shared_drive_get', 'shared_drive_rm', 'drive_download', 'drive_get'].map(f => Identifier.make(f, 'googledrive')),
				...['s3read_using', 's3write_using'].map(f => Identifier.make(f, 'aws.s3')),
				...['url_filename', 'url_accessible', 'url_destination'].map(f => Identifier.make(f, 'xfun')),
				...['source_url', 'source_gist'].map(f => Identifier.make(f, 'devtools')),
				...['install_bioc', 'install_bitbucket', 'install_cran', 'install_dev', 'install_git', 'install_github', 'install_gitlab', 'install_svn', 'install_url', 'install_version'].flatMap(f => [Identifier.make(f, 'devtools'), Identifier.make(f, 'remotes')]),
				...['github_pull', 'update_packages'].map(f => Identifier.make(f, 'remotes')),
				...['viewer', 'getDelegatedAzureToken'].map(f => Identifier.make(f, 'rstudioapi')),
				...['runGist', 'runUrl', 'httpResponse', 'session'].map(f => Identifier.make(f, 'shiny')),
				...['create_from_github', 'use_git_remote', 'use_github_action', 'use_github_file', 'use_tidy_thanks'].map(f => Identifier.make(f, 'usethis')),
				Identifier.make('copy_to', 'dplyr'),
				Identifier.make('getURL', 'RCurl'),
				Identifier.make('fread', 'data.table'),
				Identifier.make('getForm', 'rBDAT'),
				Identifier.make('fromJSON', 'jsonlite'),
				Identifier.make('read.xlsx', 'openxlsx'),
				Identifier.make('storage_download', 'googleCloudStorageR'),
				Identifier.make('AnnotationHub', 'AnnotationHub'),
				Identifier.make('ExperimentHub', 'ExperimentHub'),
				Identifier.make('datasource', 'readr'),
				Identifier.make('melt_csv', 'meltr'),
				Identifier.make('addServer', 'rsconnect'),
				Identifier.make('vroom', 'vroom'),
			].map(f => ({
				name:                    f,
				onlyTriggerWithArgument: /^(https?|ftps?):\/\//
			}))
		}
	}
} as const satisfies LintingRule<FunctionsResult, FunctionsMetadata, NetworkFunctionsConfig>;
