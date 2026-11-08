import { prettyPrint, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { Identifier } from '../../dataflow/environments/identifier';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';
import { DfgVertex } from '../../dataflow/graph/vertex';
import { EdgeType } from '../../dataflow/graph/edge';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { callFnProps } from '../../dataflow/environments/query-fn-props';
import { SemanticCallTag } from '../../dataflow/environments/built-in-props';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation, AstIdMap  } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { getFunctionArgument, getVertexArguments } from '../../abstract-interpretation/data-frame/arguments';
import type { ResolveInfo } from '../../dataflow/eval/resolve/alias-tracking';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { InputType } from '../../queries/catalog/input-sources-query/input-types';
import { SlicingCriterion } from '../../slicing/criterion/parse';
import { Resolve } from '../../dataflow/environments/resolve-helper';
import { VariableResolve } from '../../config';
import { TaintMapper, type TaintParameterLocation } from '../../taint-analysis/taint-mapping';
import { taintCallName } from '../../taint-analysis/taint-visitor';
import { createSecretAnalysis, Credential, CredentialNamePattern, DefaultSecretSinks, FileContent, FileTrust, Response, Secret, type SecretSink, SecretSinkClass } from '../../taint-analysis/predefined/secret-analysis';
import { defaultCredentialValuePattern } from './no-leaked-credentials';
import { FileInput, NetworkInput, securityAnalysis, UserInput } from '../../taint-analysis/predefined/security-analysis';

/** How a secret leaves the process, see {@link Leaks} */
export enum SecretLeak { Exfiltration = 'exfiltration', Leakage = 'leakage', Url = 'url', Files = 'files', Process = 'process', Llm = 'llm' }

export type SecretLeakSeverity = 'high' | 'medium' | 'low';

export interface SecretExfiltrationResult extends LintingResult {
	readonly function: string
	readonly sink:     SecretSinkClass
	readonly leak:     SecretLeak
	readonly severity: SecretLeakSeverity
}

export interface SecretExfiltrationConfig extends MergeableRecord {
	/** environment variable names that hold credentials (case-insensitive) */
	readonly credentialNamePattern:  string
	/** literals that are credentials, as in `no-leaked-credentials` */
	readonly credentialValuePattern: string
	/** extra functions returning secrets */
	readonly sources:                readonly Identifier[]
	/** extra functions whose result is never secret */
	readonly declassifiers:          readonly Identifier[]
	/** where secrets leave the process */
	readonly sinks:                  readonly SecretSink[]
	/** low-severity leaks to report */
	readonly optIn:                  readonly SecretLeak[]
	/** input types that make a destination untrusted, including files (see `fileTrust` for what they hold) */
	readonly controlledInputs:       readonly InputType[]
	/** how far the content of files is trusted not to hold secrets; untrusted content gives uncertain results */
	readonly fileTrust:              FileTrust
	/** paths of files holding secrets, in addition to credential files like `.Renviron` */
	readonly secretFiles:            string
	/** paths of files trusted to hold no secrets, an empty pattern trusts none */
	readonly trustedFiles:           string
}

export interface SecretExfiltrationMetadata extends MergeableRecord {
	/** sink calls a secret reaches */
	readonly secretSinkCalls: number
}

/** severity and message per leak, low ones need opt-in */
const Leaks: Readonly<Record<SecretLeak, { readonly severity: SecretLeakSeverity, readonly does: string }>> = {
	[SecretLeak.Exfiltration]: { severity: 'high',   does: 'sends a secret to a destination others control' },
	[SecretLeak.Leakage]:      { severity: 'medium', does: 'shows a secret' },
	[SecretLeak.Url]:          { severity: 'low',    does: 'puts a secret into a url' },
	[SecretLeak.Files]:        { severity: 'low',    does: 'writes a secret to a file' },
	[SecretLeak.Process]:      { severity: 'low',    does: 'passes a secret to another process' },
	[SecretLeak.Llm]:          { severity: 'low',    does: 'sends a secret to a language model' }
};

/** request builders passing their destination on */
const RequestBuilder = /^(?:request|req_\w+)$/;
const MaxDestinationHops = 5;

type Info = ResolveInfo & { readonly graph: DataflowGraph, readonly idMap: AstIdMap };

interface SecretSinkCall {
	readonly call:   DataflowGraphVertexFunctionCall
	readonly sink:   SecretSink
	/** argument value ids holding a secret, by their taint */
	readonly secret: ReadonlyMap<NodeId, symbol>
}

const argumentAt = (call: DataflowGraphVertexFunctionCall, at: TaintParameterLocation | undefined, info: Info): NodeId | undefined =>
	at === undefined ? undefined : RArgument.valueOf(getFunctionArgument(getVertexArguments(call, info.idMap), at, info))?.info.id;

function requestBuilder(vertex: DataflowGraphVertexInfo | undefined): DataflowGraphVertexFunctionCall | undefined {
	return DfgVertex.isFunctionCall(vertex) && RequestBuilder.test(Identifier.getName(vertex.name)) ? vertex : undefined;
}

/** the expression naming the destination of a sink call, through request builders and the variables holding them */
function destinationOf(call: DataflowGraphVertexFunctionCall, sink: SecretSink, info: Info): NodeId | undefined {
	const { graph, idMap } = info;
	let id = argumentAt(call, sink.destination, info);
	for(let i = 0; i < MaxDestinationHops && id !== undefined; i++) {
		const first = requestBuilder(graph.getVertex(id))?.args.find(FunctionArgument.isNotEmpty);
		const next = RSymbol.is(idMap.get(id))
			? Dataflow.targetsOf(graph, id, EdgeType.Reads).map(def => Dataflow.assignedValueOf(def, graph)).find(v => v !== undefined && requestBuilder(graph.getVertex(v)) !== undefined)
			: first && FunctionArgument.getReference(first);
		if(next === undefined) {
			break;
		}
		id = next;
	}
	return id;
}

/** whether a destination is controlled by others, uncertain as it stems from a parameter, or trusted */
async function classifyDestination(data: ReadonlyFlowrAnalysisProvider, id: NodeId, controlled: readonly InputType[]): Promise<'controlled' | 'parameter' | 'trusted'> {
	const criterion = SlicingCriterion.fromId(id);
	const types = new Set((await data.query([{ type: 'input-sources', criterion }]))['input-sources']?.results[criterion]?.flatMap(s => s.types));
	if(controlled.some(t => t !== InputType.Parameter && types.has(t))) {
		return 'controlled';
	}
	return types.has(InputType.Parameter) && controlled.includes(InputType.Parameter) ? 'parameter' : 'trusted';
}

/** whether the destination `file` is the console, `""` or a call flowR states {@link SemanticCallTag.Console} of */
function namesConsole(file: RNode<ParentInformation>, info: Info): boolean {
	return file.lexeme === '""' || FunctionSemantics.call.props.hasAll(callFnProps(file.info.id, { graph: info.graph, environment: info.environment ?? info.ctx.env.cleanEnv() }), [SemanticCallTag.Console]);
}

async function leakOf(data: ReadonlyFlowrAnalysisProvider, call: SecretSinkCall, untrusted: boolean, info: Info, config: SecretExfiltrationConfig): Promise<{ leak: SecretLeak, certain: boolean } | undefined> {
	const fixed = call.sink.class === SecretSinkClass.Browser ? SecretLeak.Leakage : [SecretLeak.Files, SecretLeak.Process, SecretLeak.Llm].find(l => l === call.sink.class as string);
	const file = info.idMap.get(argumentAt(call.call, call.sink.file, info) ?? '');
	if(fixed !== undefined || call.sink.class === SecretSinkClass.Logs) {
		return { leak: fixed ?? (file !== undefined && !namesConsole(file, info) ? SecretLeak.Files : SecretLeak.Leakage), certain: true };
	}
	const destination = destinationOf(call.call, call.sink, info);
	const trust = untrusted ? 'controlled' : destination === undefined ? 'trusted' : await classifyDestination(data, destination, config.controlledInputs);
	if(trust !== 'trusted') {
		return { leak: SecretLeak.Exfiltration, certain: trust === 'controlled' };
	}
	const urlArgs = [argumentAt(call.call, call.sink.destination, info), argumentAt(call.call, { pos: -1, name: 'query' }, info)];
	const inUrl = [...call.secret].some(([id, kind]) => kind !== Credential && (call.sink.inUrl || urlArgs.includes(id)));
	return call.sink.class === SecretSinkClass.Network && inUrl ? { leak: SecretLeak.Url, certain: true } : undefined;
}

export const SECRET_EXFILTRATION = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data) => {
		const literal = new RegExp(config.credentialValuePattern);
		const info: Info = { graph: (await data.dataflow()).graph, idMap: (await data.normalize()).idMap, full: true, resolve: VariableResolve.Alias, ctx: data.inspectContext() };
		const calls = new Map<NodeId, SecretSinkCall>();
		const untrusted = new Set<NodeId>();
		const analysis = createSecretAnalysis({
			credentialNamePattern: new RegExp(config.credentialNamePattern, 'i'),
			sources:               config.sources,
			declassifiers:         config.declassifiers,
			sinks:                 config.sinks,
			fileTrust:             config.fileTrust,
			secretFiles:           config.secretFiles === '' ? undefined : new RegExp(config.secretFiles),
			trustedFiles:          config.trustedFiles === '' ? undefined : new RegExp(config.trustedFiles)
		});
		await data.taint().add(analysis).addPredefined('security').withHook(({ name, call, node, projectArg }) => {
			const called = taintCallName(call, node);
			const sink = config.sinks.find(s => s.fns.some(fn => TaintMapper.matches(fn, called)));
			if(sink === undefined) {
				return;
			}
			if(name === securityAnalysis.name) {
				const destination = destinationOf(call, sink, info);
				const taint = destination === undefined ? undefined : projectArg(destination)?.value;
				if(taint === UserInput || taint === NetworkInput || taint === FileInput) {
					untrusted.add(call.id);
				}
				return;
			}
			const secret = new Map<NodeId, symbol>();
			for(const id of call.args.map(FunctionArgument.getReference)) {
				if(id === undefined) {
					continue;
				}
				const taint = projectArg(id)?.value;
				if(taint === Secret || taint === Credential || taint === FileContent || (taint === Response && sink.serializes)) {
					secret.set(id, taint);
				} else if(literal.test(Resolve.toSingleString(id, info) ?? '')) {
					secret.set(id, Secret);
				}
			}
			if(secret.size > 0) {
				calls.set(call.id, { call, sink, secret });
			} else {
				calls.delete(call.id);
			}
		}).run();

		const results: SecretExfiltrationResult[] = [];
		for(const call of calls.values()) {
			const leak = await leakOf(data, call, untrusted.has(call.call.id), info, config);
			if(leak === undefined || (Leaks[leak.leak].severity === 'low' && !config.optIn.includes(leak.leak))) {
				continue;
			}
			const node = info.idMap.get(call.call.id);
			const severity = call.sink.class === SecretSinkClass.Browser ? 'high' : Leaks[leak.leak].severity;
			results.push({
				involvedId: call.call.id,
				loc:        SourceLocation.fromNode(node) ?? SourceLocation.invalid(),
				certainty:  leak.certain && [...call.secret.values()].some(k => k !== FileContent) ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain,
				function:   Identifier.toString(taintCallName(call.call, node)),
				sink:       call.sink.class,
				leak:       leak.leak,
				severity
			});
		}
		return { results, '.meta': { secretSinkCalls: calls.size } };
	},
	prettyPrint: prettyPrint(
		result => `${result.function} ${Leaks[result.leak].does} (${result.severity}) at ${SourceLocation.format(result.loc)}`,
		result => `${result.function} ${Leaks[result.leak].does} (${result.leak} via ${result.sink}, severity ${result.severity}) at ${SourceLocation.format(result.loc)}`
	),
	info: {
		name:          'Secret Exfiltration',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Security, LintingRuleTag.Shiny],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds secrets (environment, keyrings, config, credential files) sent to untrusted hosts, the browser, or logs, and optionally into urls, files, other processes, or language models.',
		defaultConfig: () => ({
			credentialNamePattern:  CredentialNamePattern.source,
			credentialValuePattern: defaultCredentialValuePattern,
			sources:                [],
			declassifiers:          [],
			sinks:                  DefaultSecretSinks,
			optIn:                  [],
			controlledInputs:       [InputType.User, InputType.Network, InputType.File, InputType.CommandLine, InputType.Parameter],
			fileTrust:              FileTrust.None,
			secretFiles:            '',
			trustedFiles:           ''
		})
	}
} as const satisfies LintingRule<SecretExfiltrationResult, SecretExfiltrationMetadata, SecretExfiltrationConfig>;
