import { type LintingResult, type LintingRule, prettyPrint, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { Unknown, type DependencyInfo } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { LintingRuleTag } from '../linter-tags';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import { Ternary } from '../../util/logic';
import { happensBefore } from '../../control-flow/happens-before';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RFunctionCall, EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RLogical } from '../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { Identifier } from '../../dataflow/environments/identifier';
import { callFnProps } from '../../dataflow/environments/query-fn-props';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { SemanticCallTag } from '../../dataflow/environments/built-in-props';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';

export interface OverwrittenFileResult extends LintingResult {
	/** the file written again */
	readonly file:      string
	/** the line of the earlier write the later one replaces */
	readonly firstLine: number | undefined
}

export interface OverwrittenFileConfig extends MergeableRecord {
	/** functions that write a file, besides the ones the dependencies query knows */
	readonly additionalWriteFunctions: readonly FunctionInfo[]
}

export interface OverwrittenFileMetadata extends MergeableRecord {
	/** the number of distinct files written to */
	readonly totalFiles: number
}

/** what goes to the console is printed, not written over */
const ConsoleStreams: ReadonlySet<string> = new Set(['stdout', 'stderr']);

/** `append = TRUE`, or a connection opened in an append mode like `file(p, "a")` */
function appends(id: NodeId, idMap: AstIdMap, opens: (id: NodeId) => boolean): boolean {
	const node = idMap.get(id);
	if(!RFunctionCall.is(node)) {
		return false;
	}
	const named = (a: typeof node.arguments[number], name: string) => a !== EmptyArgument && a.name !== undefined && Identifier.getName(a.name.content) === name;
	const mode = node.arguments.find(a => named(a, 'open')) ?? (opens(id) ? node.arguments[1] : undefined);
	return node.arguments.some(a => named(a, 'append') && a !== EmptyArgument && RLogical.is(a.value) && a.value.content)
		|| (mode !== undefined && mode !== EmptyArgument && (mode.name === undefined || named(mode, 'open')) && RString.is(mode.value) && /^a[tb+]*$/.test(mode.value.content.str));
}

/** one write starting a file anew: a call, and if it writes through a function of the program, the write in that body */
interface Write {
	readonly at:      NodeId
	readonly within?: NodeId
}

/**
 * The writes that each start the file anew, per file. A call of a function of the program stands for the write in its
 * body when it names the same file, and the writes into a connection belong to the call opening it.
 */
function writesPerFile(writes: readonly DependencyInfo[], idMap: AstIdMap, opens: (id: NodeId) => boolean): Map<string, Write[]> {
	const named = writes.filter((w): w is DependencyInfo & { nodeId: NodeId, value: string } =>
		w.nodeId !== undefined && typeof w.value === 'string' && w.value !== Unknown && !ConsoleStreams.has(w.value));
	const viaCalls = new Set(named.filter(w => w.via !== undefined).map(w => `${String(w.via)}\0${w.value}`));
	const opened = new Set(named.filter(w => opens(w.nodeId)).map(w => w.value));
	const perFile = new Map<string, Write[]>();
	for(const w of named) {
		const stream = opened.has(w.value) && !opens(w.nodeId);
		if(stream || viaCalls.has(`${String(w.nodeId)}\0${w.value}`) || appends(w.nodeId, idMap, opens)) {
			continue;
		}
		const found = perFile.get(w.value) ?? [];
		if(!found.some(f => f.at === w.nodeId && f.within === w.via)) {
			found.push({ at: w.nodeId, within: w.via });
		}
		perFile.set(w.value, found);
	}
	return perFile;
}

export const OVERWRITTEN_FILE = {
	createSearch: config => Q.fromQuery({
		type:              'dependencies',
		enabledCategories: ['write'],
		writeFunctions:    config.additionalWriteFunctions
	}).with(Enrichment.CfgInformation),
	processSearchResult: async(elements, _config, data): Promise<{ results: OverwrittenFileResult[], '.meta': OverwrittenFileMetadata }> => {
		const cfg = elements.enrichmentContent(Enrichment.CfgInformation).cfg.graph;
		const writes = elements.enrichmentContent(Enrichment.QueryData).queries['dependencies'].write ?? [];
		const df = await data.dataflow();
		const idMap = (await data.normalize()).idMap;
		const opens = (id: NodeId) => FunctionSemantics.call.props.hasAny(callFnProps(id, df), SemanticCallTag.Opens);
		const perFile = writesPerFile(writes, idMap, opens);
		const lineOf = (id: NodeId | undefined) => id === undefined ? undefined : SourceLocation.fromNode(idMap.get(id))?.[0];
		/* a call writing the file twice through the body of the function it calls is told by the writes in that body */
		const where = (w: Write, other: Write) => w.at === other.at && w.within !== undefined ? w.within : w.at;
		const results: OverwrittenFileResult[] = [];
		for(const [file, found] of perFile) {
			const ordered = found.toSorted((a, b) => (lineOf(a.at) ?? 0) - (lineOf(b.at) ?? 0) || (lineOf(a.within) ?? 0) - (lineOf(b.within) ?? 0));
			for(let i = 1; i < ordered.length; i++) {
				const [before, after] = [where(ordered[i - 1], ordered[i]), where(ordered[i], ordered[i - 1])];
				const loc = SourceLocation.fromNode(idMap.get(after));
				if(loc === undefined) {
					continue;
				}
				const surely = cfg.hasVertex(before) && cfg.hasVertex(after) && happensBefore(cfg, before, after) === Ternary.Always;
				results.push({
					certainty:  surely ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain,
					involvedId: after,
					loc,
					file,
					firstLine:  lineOf(before)
				});
			}
		}
		return { results, '.meta': { totalFiles: perFile.size } };
	},
	prettyPrint: prettyPrint(
		(result: OverwrittenFileResult) => `\`${result.file}\` is written again, replacing what line ${result.firstLine ?? '?'} wrote to it`
	),
	info: {
		name:          'Overwritten File',
		description:   'Finds files the script writes more than once, so the later write replaces what the earlier one wrote, as two figures saved under the same name.',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Reproducibility],
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: () => ({
			additionalWriteFunctions: []
		})
	}
} as const satisfies LintingRule<OverwrittenFileResult, OverwrittenFileMetadata, OverwrittenFileConfig>;
