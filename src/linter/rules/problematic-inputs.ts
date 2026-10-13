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
import { type DataflowGraphVertexInfo, DfgVertex } from '../../dataflow/graph/vertex';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { Identifier } from '../../dataflow/environments/identifier';
import type { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import { boundArgumentIndex } from '../../dataflow/eval/resolve/resolve-argument';

function defaultConsider(index: BuiltInIndex): readonly string[] {
	return ['^eval$', ...index.with(SemanticCallTag.Process).map(n => `^${Identifier.quote(Identifier.getName(n))}$`)];
}

export interface PipeCommandFunctionSpec {
	pattern: string
	argIdx:  number
	argName: string
}

const defaultPipeCommandFunctions: readonly PipeCommandFunctionSpec[] = [
	{ pattern: '^pdf$',        argIdx: 0, argName: 'file' },
	{ pattern: '^postscript$', argIdx: 0, argName: 'file' }
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
	createSearch: config => {
		const toQ = (name: RegExp, subkind: string) => ({ type: 'call-context', callName: name, callNameExact: false, subkind } as const);
		return Q.fromQuery([
			...normalizePatternList(config.consider).map((n, i) => toQ(n, `fn-${i}`)),
			...normalizePipeSpecs(config.pipeCommandFunctions).map((s, i) => toQ(s.pattern, `pipe-${i}`))
		]);
	},
	processSearchResult: async(elements, config, data) => {
		const df = await data.dataflow();
		const results: ProblematicInputsResult[] = [];
		const seen          = new Set<NodeId>();
		const defaultAccept = [InputType.Constant, InputType.DerivedConstant];
		const considerPats  = normalizePatternList(config.consider);
		const pipePats      = normalizePipeSpecs(config.pipeCommandFunctions);
		for(const element of elements.getElements()) {
			const nid  = element.node.info.id;
			if(seen.has(nid)) {
				continue;
			}
			const name = element.node.lexeme ?? '';
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
			const criterion = SlicingCriterion.fromId(target);
			const all = await data.query([{ type: 'input-sources', criterion, config: config.inputFns }]);
			const sources = all['input-sources']?.results?.[criterion] ?? [];
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
			const src = formatInputSources(result.sources ?? [], true).join('; ');
			return 'Use of configured dynamic call at ' + SourceLocation.format(result.loc) + (src ? '; inputs: ' + src : '');
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
		name:          'Problematic inputs',
		description:   'Detects uses of dynamic calls (e.g. eval, system) with non-constant inputs, and graphics-device calls (pdf, postscript) where a filename starts with \'|\' indicating a pipe command injection.',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Smell, LintingRuleTag.Readability, LintingRuleTag.Performance],
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: ctx => ({
			consider:             ctx.env.deriveFromIndex(defaultConsider),
			pipeCommandFunctions: defaultPipeCommandFunctions
		})
	}
} as const satisfies LintingRule<ProblematicInputsResult, never, ProblematicInputsConfig>;
