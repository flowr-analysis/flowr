import { type LintingResult, type LintingRule, type LintQuickFixReplacement, LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { isUrl, fileUrlToPath } from '../../util/text/strings';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import { findSource } from '../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { Ternary } from '../../util/logic';
import { happensBefore } from '../../control-flow/happens-before';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { LintingRuleTag } from '../linter-tags';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import { WorkingDirectory } from '../../dataflow/eval/resolve/resolve-working-directory';
import { DropPathsOption, type FlowrLaxSourcingOptions } from '../../config';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export interface FilePathValidityResult extends LintingResult {
	filePath: string
}

export interface FilePathValidityConfig extends MergeableRecord {
	/**
	 * The set of functions that should additionally be considered as reading a file path.
	 * Entries in this array use the {@link FunctionInfo} format from the dependencies query.
	 */
	additionalReadFunctions:  FunctionInfo[]
	/**
	 * The set of functions that should additionally be considered as writing to a file path.
	 * Entries in this array use the {@link FunctionInfo} format from the dependencies query.
	 */
	additionalWriteFunctions: FunctionInfo[]
	/**
	 * Whether unknown file paths should be included as linting results.
	 */
	includeUnknown:           boolean
	/**
	 * Whether URLs should be validated by checking the endpoint exists.
	 * When `false` (default), URLs are silently ignored.
	 * When `true`, an HTTP HEAD request is made and the URL is reported if unreachable.
	 */
	checkUrls:                boolean
}

export interface FilePathValidityMetadata extends MergeableRecord {
	totalReads:              number
	totalUnknown:            number
	totalWritesBeforeAlways: number
	totalValid:              number
}

async function urlExists(url: string): Promise<boolean> {
	try {
		const response = await fetch(url, { method: 'HEAD' });
		return response.ok;
	} catch{
		return false;
	}
}

export const FILE_PATH_VALIDITY = {
	createSearch: (config) => Q.fromQuery({
		type:              'dependencies',
		enabledCategories: ['read', 'write'],
		readFunctions:     config.additionalReadFunctions,
		writeFunctions:    config.additionalWriteFunctions
	}).with(Enrichment.CfgInformation),
	processSearchResult: async(elements, config, data): Promise<{ results: FilePathValidityResult[], '.meta': FilePathValidityMetadata }> => {
		const cfg = elements.enrichmentContent(Enrichment.CfgInformation).cfg.graph;
		const metadata: FilePathValidityMetadata = {
			totalReads:              0,
			totalUnknown:            0,
			totalWritesBeforeAlways: 0,
			totalValid:              0
		};
		const results = elements.enrichmentContent(Enrichment.QueryData).queries['dependencies'];
		const ctx = data.inspectContext();
		const dfg = (await data.dataflow()).graph;
		const resolveSource = data.flowrConfig.solver.resolveSource;
		const wdRootsFor = WorkingDirectory.rootsResolver(dfg, cfg, ctx);
		const findings = await Promise.all(elements.getElements().map(async element => {
			const matchingRead = results.read.find(r => r.nodeId === element.node.info.id);
			if(!matchingRead) {
				return [];
			}
			metadata.totalReads++;
			const loc = SourceLocation.fromNode(element.node);
			if(!loc) {
				return [];
			}
			// check if we can't parse the file path statically
			if(matchingRead.value === Unknown) {
				metadata.totalUnknown++;
				if(config.includeUnknown) {
					return [{
						involvedId: matchingRead.nodeId,
						loc,
						filePath:   Unknown,
						certainty:  LintingResultCertainty.Uncertain
					}];
				} else {
					return [];
				}
			}

			// file:// URIs are local paths; resolve and check existence directly
			const localFromFileUrl = fileUrlToPath(matchingRead.value as string);
			if(localFromFileUrl !== undefined) {
				const paths = findSource(data.flowrConfig.solver.resolveSource, localFromFileUrl, {
					referenceChain: element.node.info.file ? [element.node.info.file] : [],
					ctx:            data.inspectContext()
				});
				if(paths && paths.length) {
					metadata.totalValid++;
					return [];
				}
				return [{
					involvedId: matchingRead.nodeId,
					loc,
					filePath:   localFromFileUrl,
					certainty:  LintingResultCertainty.Certain
				}];
			}

			// handle remote URLs separately from file paths
			if(isUrl(matchingRead.value as string)) {
				if(!config.checkUrls) {
					return [];
				}
				const exists = await urlExists(matchingRead.value as string);
				if(exists) {
					metadata.totalValid++;
					return [];
				}
				return [{
					involvedId: matchingRead.nodeId,
					loc,
					filePath:   matchingRead.value as string,
					certainty:  LintingResultCertainty.Uncertain
				}];
			}

			// check if any write to the same file happens before the read, and exclude this case if so
			const writesToFile = results.write.filter(r => samePath(r.value as string, matchingRead.value as string, data.flowrConfig.solver.resolveSource?.ignoreCapitalization));
			const writesBefore = writesToFile.map(w => happensBefore(cfg, w.nodeId, element.node.info.id));
			if(writesBefore.some(w => w === Ternary.Always)) {
				metadata.totalWritesBeforeAlways++;
				return [];
			}

			// check if the file exists, resolving relative paths against the effective working directory
			const value = matchingRead.value as string;
			const referenceChain = element.node.info.file ? [element.node.info.file] : [];
			const wdRoots = wdRootsFor(element.node.info.id, element.node.info.file);
			const withWd = { ...resolveSource, searchPath: [...(resolveSource?.searchPath ?? []), ...wdRoots] } as FlowrLaxSourcingOptions;
			const paths = findSource(withWd, value, { referenceChain, ctx });
			if(paths && paths.length) {
				metadata.totalValid++;
				return [];
			}

			// a lax retry (drop leading dirs, ignore case) may surface a near match to offer as a quick fix
			const near = findSource({ ...withWd, ignoreCapitalization: true, dropPaths: DropPathsOption.All }, value, { referenceChain, ctx });
			const quickFix = dfg.idMap && near && near.length ? buildDidYouMeanFix(dfg.idMap, matchingRead.nodeId, value, near[0]) : undefined;
			return [{
				involvedId: matchingRead.nodeId,
				loc,
				filePath:   value,
				certainty:  writesBefore && writesBefore.length && writesBefore.every(w => w === Ternary.Maybe) ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain,
				...(quickFix ? { quickFix } : {})
			}];
		}));
		return {
			results: findings.flat() as FilePathValidityResult[],
			'.meta': metadata
		};
	},
	info: {
		name:          'File Path Validity',
		description:   'Checks whether file paths used in read and write operations are valid and point to existing files.',
		// checks all found paths for whether they're valid to ensure correctness, but doesn't handle non-constant paths so not all will be returned
		certainty:     LintingRuleCertainty.BestEffort,
		tags:          [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility, LintingRuleTag.Bug, LintingRuleTag.QuickFix],
		defaultConfig: {
			additionalReadFunctions:  [],
			additionalWriteFunctions: [],
			includeUnknown:           false,
			checkUrls:                false
		}
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Path \`${result.filePath}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Path \`${result.filePath}\` at ${SourceLocation.format(result.loc)} does not point to a valid file`
	}
} as const satisfies LintingRule<FilePathValidityResult, FilePathValidityMetadata, FilePathValidityConfig>;

function samePath(a: string, b: string, ignoreCapitalization: boolean | undefined): boolean {
	if(ignoreCapitalization === true) {
		a = a.toLowerCase();
		b = b.toLowerCase();
	}
	return a === b;
}

/** the string-literal path argument of a call whose resolved value is `value`, for anchoring a quick fix */
function pathArgStringNode(idMap: AstIdMap, callId: NodeId, value: string): RString | undefined {
	const call = idMap.get(callId);
	if(call?.type !== RType.FunctionCall) {
		return undefined;
	}
	for(const arg of call.arguments) {
		if(arg !== EmptyArgument && arg.value && RString.is(arg.value) && arg.value.content.str === value) {
			return arg.value;
		}
	}
	return undefined;
}

/** rewrite the read path to `found`, an existing file surfaced by the lax retry */
function buildDidYouMeanFix(idMap: AstIdMap, callId: NodeId, value: string, found: string): LintQuickFixReplacement[] | undefined {
	const str = pathArgStringNode(idMap, callId, value);
	if(!str) {
		return undefined;
	}
	return [{
		type:        'replace',
		loc:         SourceLocation.fromNode(str) ?? SourceLocation.invalid(),
		description: `Replace with existing path \`${found}\``,
		replacement: str.content.quotes + found + str.content.quotes
	}];
}
