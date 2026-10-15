import { type LintingResult, type LintingRule, type LintQuickFixReplacement, LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { isUrl, fileUrlToPath } from '../../util/text/strings';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { Constant, Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import { findSource } from '../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { Ternary } from '../../util/logic';
import { happensBefore } from '../../control-flow/happens-before';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { readFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import { attachesPackage } from '../../queries/catalog/dependencies-query/function-info/library-functions';
import { Identifier } from '../../dataflow/environments/identifier';
import { LintingRuleTag } from '../linter-tags';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import { WorkingDirectory } from '../../dataflow/eval/resolve/resolve-working-directory';
import { DropPathsOption, type FlowrLaxSourcingOptions, InferWorkingDirectory } from '../../config';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { RFunctionCall, EmptyArgument  } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RIfThenElse } from '../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RWhileLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { DfgVertex } from '../../dataflow/graph/vertex';
import type { DataflowInformation } from '../../dataflow/info';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { callFnProps } from '../../dataflow/environments/query-fn-props';
import { SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { getArgumentStringValue } from '../../dataflow/eval/resolve/resolve-argument';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { BaseDatasets } from '../../util/r-base-packages';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { SecureMode } from '../../util/secure-mode';

export interface FilePathValidityResult extends LintingResult {
	filePath: string
}

export interface FilePathValidityConfig extends MergeableRecord {
	/**
	 * The set of functions that should additionally be considered as reading a file path.
	 * Entries in this array use the {@link FunctionInfo} format from the dependencies query.
	 */
	additionalReadFunctions:  readonly FunctionInfo[]
	/**
	 * The set of functions that should additionally be considered as writing to a file path.
	 * Entries in this array use the {@link FunctionInfo} format from the dependencies query.
	 */
	additionalWriteFunctions: readonly FunctionInfo[]
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

const DataSetExtensions = ['R', 'r', 'RData', 'rdata', 'rda', 'tab', 'txt', 'TXT', 'tab.gz', 'tab.bz2', 'tab.xz', 'txt.gz', 'txt.bz2', 'txt.xz', 'csv', 'CSV'];

function namesPackage(node: RNode<ParentInformation>): boolean {
	return RFunctionCall.is(node) && node.arguments.some(a => a !== EmptyArgument && a.name !== undefined && ['package', 'lib.loc'].includes(Identifier.getName(a.name.content)));
}

async function urlExists(url: string): Promise<boolean> {
	SecureMode.guard('network access', url);
	try {
		return (await fetch(url, { method: 'HEAD' })).ok;
	} catch{
		return false;
	}
}

export const FILE_PATH_VALIDITY = {
	createSearch: config => Q.fromQuery({
		type:              'dependencies',
		enabledCategories: ['read', 'write', 'library'],
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
		const df = await data.dataflow();
		const dfg = df.graph;
		const { resolveSource } = data.flowrConfig.solver;
		const wdRootsFor = WorkingDirectory.rootsResolver(dfg, cfg, ctx);
		/* `data("x")` names a data set, not a file */
		const namesOnly = new Set(readFunctions(ctx).concat(config.additionalReadFunctions).filter(f => f.resolveValue === 'library').map(f => f.name));
		const attached = (results.library ?? []).filter(attachesPackage);
		const atTopLevel = (id: NodeId) => dfg.idMap === undefined || RNode.findEnclosing(id, dfg.idMap, RFunctionDefinition.is) === undefined;
		const librariesLoadedBefore = (read: NodeId) => attached.some(l => l.nodeId === undefined || !atTopLevel(l.nodeId) || !atTopLevel(read)
			|| !cfg.hasVertex(l.nodeId) || happensBefore(cfg, l.nodeId, read) !== Ternary.Never);
		const uniqueElements = [...new Map(elements.getElements().map(e => [e.node.info.id, e])).values()];
		const reads = uniqueElements.flatMap(element => results.read
			.filter(r => r.nodeId === element.node.info.id)
			.map(matchingRead => ({ element, matchingRead })));
		const findings = await Promise.all(reads.map(async({ element, matchingRead }): Promise<FilePathValidityResult[]> => {
			const { nodeId, value } = matchingRead;
			/* data built from constants, like `matrix(1:6, 2)`, reads no file */
			if(nodeId === undefined || value === Constant) {
				return [];
			}
			const { id, file } = element.node.info;
			const loc = SourceLocation.fromNode(element.node);
			const referenceChain = file ? [file] : [];
			const verdict = (valid: boolean, filePath: string, certainty: LintingResultCertainty, quickFix?: LintQuickFixReplacement[]): FilePathValidityResult[] => {
				if(valid) {
					metadata.totalValid++;
					return [];
				}
				return [{ involvedId: nodeId, loc: loc as SourceLocation, filePath, certainty, ...(quickFix ? { quickFix } : {}) }];
			};
			if(namesOnly.has(Identifier.getName(matchingRead.functionName))) {
				if(!loc || typeof value !== 'string' || value === Unknown
					|| librariesLoadedBefore(id) || BaseDatasets.has(value) || namesPackage(element.node)) {
					return [];
				}
				metadata.totalReads++;
				const find = finderAt(resolveSource, wdRootsFor(id, file), file, ctx);
				const exists = DataSetExtensions.some(ext => find(`data/${value}.${ext}`).length);
				return verdict(exists, `data/${value}`, LintingResultCertainty.Uncertain);
			}
			metadata.totalReads++;
			if(!loc) {
				return [];
			}
			// check if we can't parse the file path statically
			if(value === Unknown) {
				metadata.totalUnknown++;
				return config.includeUnknown ? [{ involvedId: nodeId, loc, filePath: Unknown, certainty: LintingResultCertainty.Uncertain }] : [];
			}
			const path = value as string;
			// file:// URIs are local paths; resolve and check existence directly
			const localFromFileUrl = fileUrlToPath(path);
			if(localFromFileUrl !== undefined) {
				const exists = !!findSource(resolveSource, localFromFileUrl, { referenceChain, ctx })?.length;
				return verdict(exists, localFromFileUrl, LintingResultCertainty.Certain);
			}
			// handle remote URLs separately from file paths
			if(isUrl(path)) {
				// the secure mode forbids network access, so the URL stays unchecked as if checkUrls was off
				return config.checkUrls && !SecureMode.isEnabled() ? verdict(await urlExists(path), path, LintingResultCertainty.Uncertain) : [];
			}
			// check if any write to the same file happens before the read, and exclude this case if so
			const writesToFile = results.write.filter((r): r is typeof r & { nodeId: NodeId } =>
				r.nodeId !== undefined && samePath(r.value as string, path, resolveSource?.ignoreCapitalization));
			const writesBefore = writesToFile.map(w => happensBefore(cfg, w.nodeId, id));
			if(writesBefore.includes(Ternary.Always)) {
				metadata.totalWritesBeforeAlways++;
				return [];
			}
			// check if the file exists, resolving relative paths against the effective working directory
			const wdRoots = wdRootsFor(id, file);
			if(finderAt(resolveSource, wdRoots, file, ctx)(path).length) {
				return verdict(true, path, LintingResultCertainty.Certain);
			}
			/* a lax retry (drop leading dirs, ignore case) may surface a near match to offer as a quick fix */
			const laxOptions: FlowrLaxSourcingOptions = {
				...searchingFrom(resolveSource, wdRoots.roots),
				ignoreCapitalization: true,
				dropPaths:            DropPathsOption.All
			};
			const near = findSource(laxOptions, path, { referenceChain, ctx });
			const quickFix = dfg.idMap && near?.length ? buildDidYouMeanFix(dfg.idMap, nodeId, path, near[0]) : undefined;
			const maybeWrittenBefore = writesBefore.length > 0 && writesBefore.every(w => w === Ternary.Maybe);
			const uncertain = maybeWrittenBefore || guardedByFileQuery(df, id, path, data);
			return verdict(false, path, uncertain ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain, quickFix);
		}));
		return {
			results: findings.flat(),
			'.meta': metadata
		};
	},
	info: {
		name:          'File Path Validity',
		description:   'Checks whether file paths used in read and write operations are valid and point to existing files.',
		// checks all found paths for whether they're valid to ensure correctness, but doesn't handle non-constant paths so not all will be returned
		certainty:     LintingRuleCertainty.BestEffort,
		tags:          [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility, LintingRuleTag.Bug, LintingRuleTag.QuickFix],
		defaultConfig: () => ({
			additionalReadFunctions:  [],
			additionalWriteFunctions: [],
			includeUnknown:           false,
			checkUrls:                false
		})
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Path \`${result.filePath}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Path \`${result.filePath}\` at ${SourceLocation.format(result.loc)} does not point to a valid file`
	}
} as const satisfies LintingRule<FilePathValidityResult, FilePathValidityMetadata, FilePathValidityConfig>;

/** Whether the read only runs depending on a condition that queries the same file, as in `if(file.exists(p)) readLines(p)`. */
function guardedByFileQuery(df: DataflowInformation, read: NodeId, path: string, data: ReadonlyFlowrAnalysisProvider): boolean {
	const dfg = df.graph;
	return (dfg.getVertex(read)?.cds ?? []).some(cd => {
		const construct = dfg.idMap?.get(cd.id);
		const condition = RIfThenElse.is(construct) || RWhileLoop.is(construct) ? construct.condition : undefined;
		return [...RNode.collectAllIds(condition)].some(id => {
			const call = dfg.getVertex(id);
			if(!DfgVertex.isFunctionCall(call) || !FunctionSemantics.call.props.hasAny(callFnProps(call.id, df), SemanticCallTag.File)) {
				return false;
			}
			const args = getArgumentStringValue(data.flowrConfig.solver.variables, dfg, call, 'unnamed', undefined, true, data.inspectContext());
			return args?.values().some(v => v.has(path)) ?? false;
		});
	});
}

function searchingFrom(resolveSource: FlowrLaxSourcingOptions | undefined, roots: readonly string[]): FlowrLaxSourcingOptions {
	return { ...resolveSource, searchPath: [...(resolveSource?.searchPath ?? []), ...roots] } as FlowrLaxSourcingOptions;
}

/** looks a path up from the working directories a `setwd` pins down, and laxly along the configured search path if none does. */
function finderAt(resolveSource: FlowrLaxSourcingOptions | undefined, { roots, pinned }: { roots: readonly string[], pinned: boolean }, file: string | undefined, ctx: ReadOnlyFlowrAnalyzerContext): (value: string) => readonly string[] {
	const referenceChain = file ? [file] : [];
	if(!pinned) {
		const lax = searchingFrom(resolveSource, roots);
		return value => findSource(lax, value, { referenceChain, ctx }) ?? [];
	}
	const strict = { ...resolveSource, searchPath: [], dropPaths: DropPathsOption.No, inferWorkingDirectory: InferWorkingDirectory.No } as FlowrLaxSourcingOptions;
	return value => roots.flatMap(root => findSource(strict, WorkingDirectory.applyChange(root, value), { referenceChain, ctx }) ?? []);
}

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
	if(!RFunctionCall.is(call)) {
		return undefined;
	}
	return call.arguments.map(RArgument.valueOf).find(v => RString.is(v) && v.content.str === value) as RString | undefined;
}

/** rewrite the read path to `found`, an existing file surfaced by the lax retry */
function buildDidYouMeanFix(idMap: AstIdMap, callId: NodeId, value: string, found: string): LintQuickFixReplacement[] | undefined {
	const str = pathArgStringNode(idMap, callId, value);
	const loc = str === undefined ? undefined : SourceLocation.fromNode(str);
	if(!str || loc === undefined || found === value) {
		/* a fix that names no place or changes nothing cannot be carried out, so none is offered */
		return undefined;
	}
	return [{
		type:        'replace',
		loc,
		description: `Replace with existing path \`${found}\``,
		replacement: str.content.quotes + found + str.content.quotes
	}];
}
