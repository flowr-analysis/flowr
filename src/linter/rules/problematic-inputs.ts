import { type LintingResult, type LintingRule, LintingPrettyPrintContext, LintingRuleCertainty, LintingResultCertainty } from '../linter-format';
import { isArray } from '../../util/collections/arrays';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import type { InputClassifierConfig, InputSources } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { InputType } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { SlicingCriterion } from '../../slicing/criterion/parse';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type DataflowGraph, FunctionArgument } from '../../dataflow/graph/graph';
import { type DataflowGraphVertexInfo, DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { ArgProp, CallProp, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { Identifier } from '../../dataflow/environments/identifier';
import { escapeRegex } from '../../util/text/strings';
import { type BuiltInIndex, quotedForWorker } from '../../dataflow/environments/query-fn-props';
import { boundArgumentIndex } from '../../dataflow/eval/resolve/resolve-argument';

/** what runs a command, and what evaluates code beyond looking up a name (`get`) or calling a function it is handed (`do.call`) */
function defaultConsider(index: BuiltInIndex): readonly string[] {
	const evaluates = index.with(SemanticCallTag.Eval).filter(n => ((index.propsOf(n) ?? 0) & CallProp.Pure) === 0 && !index.get(n)?.sig?.some(([, p]) => (p & ArgProp.Callee) !== 0));
	return [...index.with(SemanticCallTag.Process), ...evaluates].map(n => `^${escapeRegex(Identifier.getName(n))}$`).concat('^fread$');
}

export interface PipeCommandFunctionSpec {
	pattern: string
	argIdx:  number
	argName: string
}

const defaultPipeCommandFunctions: readonly PipeCommandFunctionSpec[] = [
	{ pattern: '^pdf$',        argIdx: 0, argName: 'file' },
	{ pattern: '^postscript$', argIdx: 0, argName: 'file' },
	{ pattern: '^bitmap$',     argIdx: 0, argName: 'file' }
];

function normalizePatternList(cfg: string | readonly string[] = []): RegExp[] {
	return isArray<string>(cfg) ? Array.from(new Set(cfg), s => new RegExp(s)) : [new RegExp(cfg)];
}

function normalizePipeSpecs(cfg: PipeCommandFunctionSpec | readonly PipeCommandFunctionSpec[] | undefined): Array<{ pattern: RegExp, argIdx: number, argName: string }> {
	const raw = cfg === undefined ? defaultPipeCommandFunctions
		: isArray<PipeCommandFunctionSpec>(cfg) ? (cfg.length === 0 ? defaultPipeCommandFunctions : cfg)
			: [cfg];
	return raw.map(s => ({ ...s, pattern: new RegExp(s.pattern) }));
}

function formatInputSources(inputs: InputSources, inline: boolean): string[] {
	return inputs.map(s => {
		const t = '[' + s.types.join(',') + ']';
		const c = s.cds ? ', cds: [' + s.cds.join(',') + ']' : '';
		return inline
			? `${s.id} (type: ${t}, trace: ${s.trace}${c})`
			: `- ${s.id}: type=${t}, trace=${s.trace}${c}`;
	});
}

function hasUnknownSource(sources: InputSources): boolean {
	return sources.some(s => s.types.includes(InputType.Unknown));
}

function isProblematicForAllowed(sources: InputSources, allowed: InputType[]): boolean {
	return sources.some(s => s.types.some(t => !allowed.includes(t)));
}

/** A path starting with `|` runs a command, so anything but a constant path, user input included, may start one. */
function getPipeCommandValue(sources: InputSources): string | undefined {
	for(const s of sources) {
		if(typeof s.value === 'string' && s.value.startsWith('|')) {
			return s.value;
		}
	}
	return undefined;
}

function resolveFileArgId(graph: DataflowGraph, vertex: DataflowGraphVertexInfo | undefined, argIdx: number, argName: string, ctx: ReadOnlyFlowrAnalyzerContext): NodeId | undefined {
	if(!DfgVertex.isFunctionCall(vertex)) {
		return undefined;
	}
	const arg = vertex.args[boundArgumentIndex(graph, vertex, argIdx, argName, ctx)];
	return arg === undefined ? undefined : FunctionArgument.getReference(arg);
}

export interface ProblematicInputsResult extends LintingResult {
	name:         string
	sources:      InputSources
	pipeCommand?: string
}

export interface ProblematicInputsConfig extends MergeableRecord {
	consider?:             string | readonly string[]
	inputFns?:             InputClassifierConfig
	pipeCommandFunctions?: PipeCommandFunctionSpec | readonly PipeCommandFunctionSpec[]
}

export const PROBLEMATIC_INPUTS = {
	createSearch:        () => Q.all().filter(VertexType.FunctionCall).with(Enrichment.CallTargets),
	processSearchResult: async(elements, config, data) => {
		const df = await data.dataflow();
		const results: ProblematicInputsResult[] = [];
		const seen          = new Set<NodeId>();
		const defaultAccept = [InputType.Constant, InputType.DerivedConstant, InputType.TempFile];
		const considerPats  = normalizePatternList(config.consider);
		const pipePats      = normalizePipeSpecs(config.pipeCommandFunctions);
		for(const element of elements.getElements()) {
			const nid  = element.node.info.id;
			if(seen.has(nid)) {
				continue;
			}
			if(Dataflow.isQuoted(nid, df.graph) && !quotedForWorker(nid, df.graph, data.inspectContext().env.builtInIndex)) {
				continue;
			}
			const names = enrichmentContent(element, Enrichment.CallTargets).targets.flatMap(t => typeof t === 'string' ? [Identifier.getName(Identifier.parse(t))] : []);
			const name = names.find(n => pipePats.some(s => s.pattern.test(n)) || considerPats.some(p => p.test(n))) ?? '';
			const pipeSpec = pipePats.find(s => s.pattern.test(name));
			/* a pipe spec checks the file argument of the call, a considered call the call itself */
			let target: NodeId | undefined;
			if(pipeSpec !== undefined) {
				target = resolveFileArgId(df.graph, df.graph.getVertex(nid), pipeSpec.argIdx, pipeSpec.argName, data.inspectContext());
			} else if(considerPats.some(p => p.test(name))) {
				target = nid;
			}
			if(target === undefined) {
				continue;
			}
			const [criterion, call] = [SlicingCriterion.fromId(target), SlicingCriterion.fromId(nid)];
			const res = (await data.query([{ type: 'input-sources', criterion: target === nid ? call : [criterion, call], config: config.inputFns }]))['input-sources']?.results;
			const own = res?.[criterion] ?? [];
			/* a file argument that is an input itself (`pdf(readline())`) only shows as a source of the call */
			const sources = target === nid || own.some(s => s.id === target) ? own : own.concat((res?.[call] ?? []).filter(s => s.id === target));
			const pipeCommand = pipeSpec === undefined ? undefined : getPipeCommandValue(sources);
			if(pipeCommand !== undefined || isProblematicForAllowed(sources, defaultAccept)) {
				seen.add(nid);
				const uncertain = pipeCommand === undefined && hasUnknownSource(sources);
				results.push({
					involvedId: nid,
					certainty:  uncertain ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain,
					loc:        SourceLocation.fromNode(element.node) ?? SourceLocation.invalid(),
					name,
					sources,
					...(pipeCommand === undefined ? {} : { pipeCommand })
				});
			}
		}
		return { results };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => {
			if(result.pipeCommand !== undefined) {
				return `Pipe command injection via '${result.pipeCommand}' in call to ${result.name} at ${SourceLocation.format(result.loc)}`;
			}
			const src = formatInputSources(result.sources ?? [], true).join(', ');
			return 'Use of configured dynamic call at ' + SourceLocation.format(result.loc) + (src ? ' with inputs ' + src : '');
		},
		[LintingPrettyPrintContext.Full]: result => {
			const lines = formatInputSources(result.sources ?? [], false);
			const tail  = lines.length ? '\nInputs:\n' + lines.join('\n') : '';
			return result.pipeCommand !== undefined
				? `Pipe command injection: '${result.pipeCommand}' passed as filename to ${result.name} at ${SourceLocation.format(result.loc)}${tail}`
				: 'Use of configured dynamic call at ' + SourceLocation.format(result.loc) + ' is potentially problematic' + tail;
		}
	},
	info: {
		name:          'Problematic Inputs',
		description:   'Finds dynamic calls (e.g. eval, system) with non-constant inputs, and graphics-device calls (pdf, postscript) where a filename starts with \'|\' indicating a pipe command injection.',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Smell, LintingRuleTag.Readability, LintingRuleTag.Performance],
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: ctx => ({
			consider:             ctx.env.deriveFromIndex(defaultConsider),
			pipeCommandFunctions: defaultPipeCommandFunctions
		})
	}
} as const satisfies LintingRule<ProblematicInputsResult, never, ProblematicInputsConfig>;
