import { type LintingResult, type LintingRule, LintingPrettyPrintContext, LintingRuleCertainty, LintingResultCertainty } from '../linter-format';
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
function defaultConsider(index: BuiltInIndex): readonly ConsiderSpec[] {
	const evaluates = index.with(SemanticCallTag.Eval).filter(n => ((index.propsOf(n) ?? 0) & CallProp.Pure) === 0 && !index.get(n)?.sig?.some(([, p]) => (p & ArgProp.Callee) !== 0));
	const constants = [InputType.Constant, InputType.DerivedConstant];
	return [
		...index.with(SemanticCallTag.Process).map(n => ({ pattern: `^${escapeRegex(Identifier.getName(n))}$` })),
		/* evaluating a known value (`source("a.R")`) is harmless, only `eval` additionally has its code argument inspected */
		...evaluates.map(n => {
			const name = Identifier.getName(n);
			return { pattern: `^${escapeRegex(name)}$`, allowedInputTypes: constants, ...name === 'eval' ? { resolveSourceArgs: true } : {} };
		})
	].concat({ pattern: '^fread$' });
}

const defaultPipeCommandFunctions: readonly PipeCommandFunctionSpec[] = [
	{ pattern: /^pdf$/,        argIdx: 0, argName: 'file' },
	{ pattern: /^postscript$/, argIdx: 0, argName: 'file' },
	{ pattern: /^bitmap$/,     argIdx: 0, argName: 'file' }
];

export interface PipeCommandFunctionSpec {
	pattern:           string | RegExp
	argIdx:            number
	argName:           string
	allowedValues?:    string | RegExp
	disallowedValues?: string | RegExp
}

export interface ConsiderSpec {
	pattern:            string | RegExp
	allowedInputTypes?: InputType[]
	allowedValues?:     string | RegExp
	disallowedValues?:  string | RegExp
	resolveSourceArgs?: boolean
}

function normalizePatternList(cfg: string | string[] | ConsiderSpec | ConsiderSpec[] | undefined): { pattern: RegExp, allowedInputTypes?: InputType[], allowedValues?: RegExp, disallowedValues?: RegExp, resolveSourceArgs?: boolean }[] {
	const raw = (Array.isArray(cfg) ? cfg : cfg !== undefined ? [cfg] : []).map(s => typeof s === 'string' ? { pattern: s } : s);
	return raw.map(s => ({
		pattern:           typeof s.pattern === 'string' ? new RegExp(s.pattern) : s.pattern,
		allowedInputTypes: s.allowedInputTypes,
		allowedValues:     typeof s.allowedValues === 'string' ? new RegExp(s.allowedValues) : s.allowedValues,
		disallowedValues:  typeof s.disallowedValues === 'string' ? new RegExp(s.disallowedValues) : s.disallowedValues,
		resolveSourceArgs: s.resolveSourceArgs
	}));
}

function normalizePipeSpecs(cfg: PipeCommandFunctionSpec | PipeCommandFunctionSpec[] | undefined): Array<{ pattern: RegExp, argIdx: number, argName: string, allowedValues?: RegExp, disallowedValues?: RegExp }> {
	const raw = cfg === undefined ? defaultPipeCommandFunctions
		: Array.isArray(cfg) ? (cfg.length === 0 ? defaultPipeCommandFunctions : cfg)
			: [cfg];
	return raw.map(s => ({
		pattern:          typeof s.pattern === 'string' ? new RegExp(s.pattern) : s.pattern,
		argIdx:           s.argIdx,
		argName:          s.argName,
		allowedValues:    typeof s.allowedValues === 'string' ? new RegExp(s.allowedValues) : s.allowedValues,
		disallowedValues: typeof s.disallowedValues === 'string' ? new RegExp(s.disallowedValues) : s.disallowedValues
	}));
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

function isProblematicForAllowed(sources: InputSources, evalValues: string[], allowedTypes: InputType[], allowedValues?: RegExp, disallowedValues?: RegExp): boolean {
	if(sources.some(s => s.types.some(t => !allowedTypes.includes(t)))) {
		return true;
	}
	const values = sources.map(s => s.value).concat(evalValues);
	if(allowedValues !== undefined && values.every(v => v === undefined || !allowedValues.test(String(v)))) {
		return true;
	}
	if(disallowedValues !== undefined && values.some(v => v !== undefined && disallowedValues.test(String(v)))) {
		return true;
	}
	return false;
}

/** A path starting with `|` runs a command, so anything but a constant path, user input included, may start one. */
function getPipeCommandValue(sources: InputSources, allowedValues?: RegExp, disallowedValues?: RegExp): string | undefined {
	for(const s of sources) {
		if(typeof s.value !== 'string' || !s.value.startsWith('|')) {
			continue;
		}
		if(allowedValues !== undefined && allowedValues.test(s.value)) {
			continue;
		}
		if(disallowedValues !== undefined && !disallowedValues.test(s.value)) {
			continue;
		}
		return s.value;
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
	consider?:             string | string[] | ConsiderSpec | ConsiderSpec[]
	inputFns?:             InputClassifierConfig
	pipeCommandFunctions?: PipeCommandFunctionSpec | PipeCommandFunctionSpec[]
}

export const PROBLEMATIC_INPUTS = {
	createSearch:        () => Q.all().filter(VertexType.FunctionCall).with(Enrichment.CallTargets),
	processSearchResult: async(elements, config, data) => {
		const df = await data.dataflow();
		const results: ProblematicInputsResult[] = [];
		const seen          = new Set<NodeId>();
		const tempFileAccept = [InputType.Constant, InputType.DerivedConstant, InputType.TempFile];
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
			const name = names.find(n => pipePats.some(s => s.pattern.test(n)) || considerPats.some(p => p.pattern.test(n))) ?? '';
			const pipeSpec = pipePats.find(s => s.pattern.test(name));
			const consider = pipeSpec === undefined ? considerPats.find(s => s.pattern.test(name)) : undefined;
			/* a pipe spec checks the file argument of the call, a considered call the call itself */
			let target: NodeId | undefined;
			if(pipeSpec !== undefined) {
				target = resolveFileArgId(df.graph, df.graph.getVertex(nid), pipeSpec.argIdx, pipeSpec.argName, data.inspectContext());
			} else if(consider !== undefined) {
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
			const pipeCommand = pipeSpec === undefined ? undefined : getPipeCommandValue(sources, pipeSpec.allowedValues, pipeSpec.disallowedValues);
			const evalValues: string[] = [];
			if(consider?.resolveSourceArgs) {
				for(const source of sources) {
					const arg = source.value === undefined ? df.graph.idMap?.get(source.id)?.info?.fullLexeme : undefined;
					if(arg !== undefined) {
						evalValues.push(arg);
					}
				}
			}
			if(pipeCommand !== undefined || isProblematicForAllowed(sources, evalValues, consider?.allowedInputTypes ?? (pipeSpec !== undefined || sources.some(s => s.types.includes(InputType.TempFile)) ? tempFileAccept : []), consider?.allowedValues, consider?.disallowedValues)) {
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
