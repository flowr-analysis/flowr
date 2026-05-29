import { type LintingResult, type LintingRule, LintingPrettyPrintContext, LintingRuleCertainty, LintingResultCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import type { InputClassifierConfig, InputSource, InputSources } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { InputType } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import type { InputSourcesQuery } from '../../queries/catalog/input-sources-query/input-sources-query-format';
import { SlicingCriterion } from '../../slicing/criterion/parse';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';

const defaultConsider = ['^eval$', '^system$', '^system2$', '^shell$'] as const;

export interface PipeCommandFunctionSpec {
	pattern: string
	argIdx:  number
	argName: string
}

const defaultPipeCommandFunctions: readonly PipeCommandFunctionSpec[] = [
	{ pattern: '^pdf$',        argIdx: 0, argName: 'file' },
	{ pattern: '^postscript$', argIdx: 0, argName: 'file' }
];

function normalizePatternList(cfg: string | string[] | undefined, defaults: readonly string[]): RegExp[] {
	if(cfg === undefined) {
		return Array.from(defaults, s => new RegExp(s));
	}
	if(Array.isArray(cfg)) {
		const arr = cfg.length === 0 ? Array.from(defaults) : cfg;
		return Array.from(new Set(arr), s => new RegExp(s));
	}
	return [new RegExp(cfg)];
}

function normalizePipeSpecs(cfg: PipeCommandFunctionSpec | PipeCommandFunctionSpec[] | undefined): Array<{ pattern: RegExp, argIdx: number, argName: string }> {
	const raw = cfg === undefined ? defaultPipeCommandFunctions
		: Array.isArray(cfg) ? (cfg.length === 0 ? defaultPipeCommandFunctions : cfg)
			: [cfg];
	return raw.map(s => ({ pattern: new RegExp(s.pattern), argIdx: s.argIdx, argName: s.argName }));
}

function formatInputSources(inputs: InputSources, inline = true): string | string[] {
	if(!inputs || inputs.length === 0) {
		return inline ? '' : [];
	}
	const fmt = (s: InputSource) => {
		const t = '[' + s.types.join(',') + ']';
		const c = s.cds ? ', cds: [' + s.cds.join(',') + ']' : '';
		return inline
			? `${s.id} (type: ${t}, trace: ${s.trace}${c})`
			: `- ${s.id}: type=${t}, trace=${s.trace}${c}`;
	};
	return inline ? inputs.map(fmt).join('; ') : inputs.map(fmt);
}

function hasUnknownSource(sources: InputSources): boolean {
	return sources.some(s => s.types.includes(InputType.Unknown));
}

function isProblematicForAllowed(sources: InputSources, allowed: InputType[]): boolean {
	return sources.some(s => s.types.some(t => !allowed.includes(t)));
}

function getPipeCommandValue(sources: InputSources): string | undefined {
	for(const s of sources) {
		if(typeof s.value === 'string' && s.value.startsWith('|')) {
			return s.value;
		}
	}
	return undefined;
}

function resolveFileArgId(vertex: DataflowGraphVertexFunctionCall | undefined, argIdx: number, argName: string): NodeId | undefined {
	const args = vertex?.args;
	if(!args) {
		return undefined;
	}
	let idx = args.findIndex(a => FunctionArgument.isNamed(a) && a.name === argName);
	if(idx < 0) {
		idx = argIdx;
	}
	if(idx >= args.length) {
		return undefined;
	}
	const arg = args[idx];
	return FunctionArgument.isEmpty(arg) ? undefined : FunctionArgument.getReference(arg);
}

function checkPipeInjection(nid: NodeId, loc: SourceLocation, name: string, sources: InputSources): ProblematicInputsResult | undefined {
	const pipeCmd = getPipeCommandValue(sources);
	if(pipeCmd !== undefined) {
		return { involvedId: nid, certainty: LintingResultCertainty.Certain, loc, name, sources, pipeCommand: pipeCmd };
	}
	if(hasUnknownSource(sources)) {
		return { involvedId: nid, certainty: LintingResultCertainty.Uncertain, loc, name, sources };
	}
	return undefined;
}

export interface ProblematicInputsResult extends LintingResult {
	name:         string
	loc:          SourceLocation
	sources:      InputSources
	pipeCommand?: string
}

export interface ProblematicInputsConfig extends MergeableRecord {
	consider?:             string | string[]
	inputFns?:             InputClassifierConfig
	pipeCommandFunctions?: PipeCommandFunctionSpec | PipeCommandFunctionSpec[]
}

export type ProblematicInputsMetadata = MergeableRecord;

export const PROBLEMATIC_INPUTS = {
	createSearch: config => {
		const toQ = (name: RegExp, subkind: string) => ({ type: 'call-context', callName: name, callNameExact: false, subkind } as const);
		return Q.fromQuery(
			...normalizePatternList(config?.consider, defaultConsider).map((n, i) => toQ(n, `fn-${i}`)),
			...normalizePipeSpecs(config?.pipeCommandFunctions).map((s, i) => toQ(s.pattern, `pipe-${i}`))
		);
	},
	processSearchResult: async(elements, config, data) => {
		const results: ProblematicInputsResult[] = [];
		const seen          = new Set<NodeId>();
		const defaultAccept = [InputType.Constant, InputType.DerivedConstant];
		const considerPats  = normalizePatternList(config?.consider, defaultConsider);
		const pipePats      = normalizePipeSpecs(config?.pipeCommandFunctions);

		for(const element of elements.getElements()) {
			const nid  = element.node.info.id;
			if(seen.has(nid)) {
				continue;
			}
			const name       = element.node.lexeme ?? '';
			const pipeSpec   = pipePats.find(s => s.pattern.test(name));
			const isConsider = pipeSpec === undefined && considerPats.some(p => p.test(name));
			if(pipeSpec === undefined && !isConsider) {
				continue;
			}

			const loc = SourceLocation.fromNode(element.node) ?? SourceLocation.invalid();

			if(pipeSpec !== undefined) {
				const vertex    = data.dataflow.graph.getVertex(nid) as DataflowGraphVertexFunctionCall | undefined;
				const fileArgId = resolveFileArgId(vertex, pipeSpec.argIdx, pipeSpec.argName);
				if(fileArgId !== undefined) {
					const criterion = SlicingCriterion.fromId(fileArgId);
					const all       = await data.analyzer.query([{ type: 'input-sources', criterion, config: config.inputFns } as InputSourcesQuery]);
					const sources   = all['input-sources']?.results?.[criterion] ?? [];
					const r         = checkPipeInjection(nid, loc, name, sources);
					if(r !== undefined) {
						seen.add(nid);
						results.push(r);
					}
				}
			} else {
				const criterion = SlicingCriterion.fromId(nid);
				const all       = await data.analyzer.query([{ type: 'input-sources', criterion, config: config.inputFns } as InputSourcesQuery]);
				const sources   = all['input-sources']?.results?.[criterion] ?? [];
				if(isProblematicForAllowed(sources, defaultAccept)) {
					seen.add(nid);
					results.push({ involvedId: nid, certainty: hasUnknownSource(sources) ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain, loc, name, sources });
				}
			}
		}
		return { results, '.meta': {} };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => {
			if(result.pipeCommand !== undefined) {
				return `Pipe command injection via '${result.pipeCommand}' in call to ${result.name} at ${SourceLocation.format(result.loc)}`;
			}
			const src = formatInputSources(result.sources ?? [], true) as string;
			return 'Use of configured dynamic call at ' + SourceLocation.format(result.loc) + (src ? '; inputs: ' + src : '');
		},
		[LintingPrettyPrintContext.Full]: result => {
			const lines = formatInputSources(result.sources ?? [], false) as string[];
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
		defaultConfig: {
			consider:             defaultConsider,
			pipeCommandFunctions: defaultPipeCommandFunctions
		}
	}
} as const satisfies LintingRule<ProblematicInputsResult, ProblematicInputsMetadata, ProblematicInputsConfig>;
