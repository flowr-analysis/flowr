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
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { InputType } from '../../queries/catalog/input-sources-query/input-types';
import { SlicingCriterion } from '../../slicing/criterion/parse';
import { Resolve } from '../../dataflow/environments/resolve-helper';
import { VariableResolve } from '../../config';
import { TaintMapper, type TaintParameterLocation } from '../../taint-analysis/taint-mapping';
import { taintCallName } from '../../taint-analysis/taint-visitor';
import {
	createSecretAnalysis,
	Credential,
	CredentialNamePattern,
	DefaultSecretSinks,
	FileContent,
	FileTrust,
	Response,
	Secret,
	type SecretSink,
	SecretSinkClass
} from '../../taint-analysis/predefined/secret-analysis';
import { defaultCredentialValuePattern } from './no-leaked-credentials';
import { FileInput, NetworkInput, securityAnalysis, UserInput } from '../../taint-analysis/predefined/security-analysis';

/** How a secret leaves the process */
export enum SecretLeak {
	/** sent to a host someone else controls */
	Exfiltration = 'exfiltration',
	/** shown in the browser or logs */
	Leakage = 'leakage',
	/** in the url of a trusted host, so server logs keep it */
	Url = 'url',
	/** written to a file */
	Files = 'files',
	/** passed to another process, visible in `ps` */
	Process = 'process',
	/** sent to a large language model */
	Llm = 'llm'
}

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

/** leak per sink class, unless it depends on the call */
const FixedLeaks: Readonly<Partial<Record<SecretSinkClass, SecretLeak>>> = {
	[SecretSinkClass.Browser]: SecretLeak.Leakage,
	[SecretSinkClass.Files]:   SecretLeak.Files,
	[SecretSinkClass.Process]: SecretLeak.Process,
	[SecretSinkClass.Llm]:     SecretLeak.Llm
};

/** request builders passing their destination on */
const RequestBuilder = /^(?:request|req_\w+)$/;
const StandardStreams: ReadonlySet<string> = new Set(['stdout', 'stderr']);
const MaxDestinationHops = 5;

type Destination = 'controlled' | 'parameter' | 'trusted';

/** a raw secret, one in an authentication channel, or file content that may hold one */
type SecretKind = 'secret' | 'credential' | 'file';

interface SecretSinkCall {
	readonly call:   DataflowGraphVertexFunctionCall
	readonly sink:   SecretSink
	/** argument value ids holding a secret, by what they hold */
	readonly secret: ReadonlyMap<NodeId, SecretKind>
}

function argumentAt(call: DataflowGraphVertexFunctionCall, at: TaintParameterLocation): NodeId | undefined {
	const named = call.args.find(a => at.name !== undefined && FunctionArgument.hasName(a, at.name));
	const arg = named ?? (at.pos >= 0 ? call.args.filter(FunctionArgument.isUnnamed)[at.pos] : undefined);
	return arg === undefined ? undefined : FunctionArgument.getReference(arg);
}

function requestBuilder(vertex: DataflowGraphVertexInfo | undefined): DataflowGraphVertexFunctionCall | undefined {
	return DfgVertex.isFunctionCall(vertex) && RequestBuilder.test(Identifier.getName(vertex.name)) ? vertex : undefined;
}

/** the expression naming the destination, through request builders and variables */
function destinationExpression(id: NodeId, graph: DataflowGraph, idMap: AstIdMap): NodeId {
	for(let i = 0; i < MaxDestinationHops; i++) {
		const first = requestBuilder(graph.getVertex(id))?.args.find(FunctionArgument.isNotEmpty);
		const next = RSymbol.is(idMap.get(id))
			? Dataflow.targetsOf(graph, id, EdgeType.Reads).flatMap(def => Dataflow.targetsOf(graph, def, EdgeType.DefinedBy)).find(v => requestBuilder(graph.getVertex(v)) !== undefined)
			: first && FunctionArgument.getReference(first);
		if(next === undefined) {
			return id;
		}
		id = next;
	}
	return id;
}

const destinationOf = (call: DataflowGraphVertexFunctionCall, sink: SecretSink, graph: DataflowGraph): NodeId | undefined => {
	const at = sink.destination === undefined ? undefined : argumentAt(call, sink.destination);
	return at === undefined || graph.idMap === undefined ? undefined : destinationExpression(at, graph, graph.idMap);
};

async function classifyDestination(data: ReadonlyFlowrAnalysisProvider, call: SecretSinkCall, controlled: readonly InputType[]): Promise<Destination> {
	const id = destinationOf(call.call, call.sink, (await data.dataflow()).graph);
	if(id === undefined) {
		return 'trusted';
	}
	const criterion = SlicingCriterion.fromId(id);
	const sources = (await data.query([{ type: 'input-sources', criterion }]))['input-sources']?.results[criterion] ?? [];
	const types = new Set(sources.flatMap(s => s.types));
	const outside = controlled.filter(t => t !== InputType.Parameter && types.has(t));
	return outside.length > 0 ? 'controlled' : types.has(InputType.Parameter) && controlled.includes(InputType.Parameter) ? 'parameter' : 'trusted';
}

/** whether the output goes to a file instead of the console */
function writesToFile(call: SecretSinkCall, idMap: AstIdMap): boolean {
	const at = call.sink.file === undefined ? undefined : argumentAt(call.call, call.sink.file);
	const node = at === undefined ? undefined : idMap.get(at);
	return node !== undefined && !RFunctionCall.isNamed(node, StandardStreams) && node.lexeme !== '""';
}

async function leakOf(data: ReadonlyFlowrAnalysisProvider, call: SecretSinkCall, untrusted: boolean, config: SecretExfiltrationConfig): Promise<{ leak: SecretLeak, certain: boolean } | undefined> {
	const fixed = FixedLeaks[call.sink.class];
	if(fixed !== undefined) {
		return { leak: fixed, certain: true };
	} else if(call.sink.class === SecretSinkClass.Logs) {
		return { leak: writesToFile(call, (await data.normalize()).idMap) ? SecretLeak.Files : SecretLeak.Leakage, certain: true };
	}
	const destination = untrusted ? 'controlled' : await classifyDestination(data, call, config.controlledInputs);
	if(destination !== 'trusted') {
		return { leak: SecretLeak.Exfiltration, certain: destination === 'controlled' };
	}
	const destId = call.sink.destination === undefined ? undefined : argumentAt(call.call, call.sink.destination);
	const inUrl = [...call.secret].some(([id, kind]) => kind !== 'credential' && (call.sink.inUrl || id === destId || id === argumentAt(call.call, { pos: -1, name: 'query' })));
	return call.sink.class === SecretSinkClass.Network && inUrl ? { leak: SecretLeak.Url, certain: true } : undefined;
}

export const SECRET_EXFILTRATION = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data) => {
		const literal = new RegExp(config.credentialValuePattern);
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
		await data.taint().add(analysis).addPredefined('security').withHook(({ name, call, node, projectArg, dfg, ctx }) => {
			const called = taintCallName(call, node);
			const sink = config.sinks.find(s => s.fns.some(fn => TaintMapper.matches(fn, called)));
			if(sink === undefined) {
				return;
			}
			if(name === securityAnalysis.name) {
				const destination = destinationOf(call, sink, dfg);
				const taint = destination === undefined ? undefined : projectArg(destination)?.value;
				if(taint === UserInput || taint === NetworkInput || taint === FileInput) {
					untrusted.add(call.id);
				}
				return;
			}
			const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx };
			const secret = new Map<NodeId, SecretKind>();
			for(const id of call.args.map(FunctionArgument.getReference)) {
				if(id === undefined) {
					continue;
				}
				const taint = projectArg(id)?.value;
				if(taint === Secret || taint === Credential || taint === FileContent || (taint === Response && sink.serializes)) {
					secret.set(id, taint === Secret ? 'secret' : taint === FileContent ? 'file' : 'credential');
				} else if(literal.test(Resolve.toSingleString(id, resolveInfo) ?? '')) {
					secret.set(id, 'secret');
				}
			}
			if(secret.size > 0) {
				calls.set(call.id, { call, sink, secret });
			} else {
				calls.delete(call.id);
			}
		}).run();

		const { idMap } = await data.normalize();
		const results: SecretExfiltrationResult[] = [];
		for(const call of calls.values()) {
			const leak = await leakOf(data, call, untrusted.has(call.call.id), config);
			if(leak === undefined || (Leaks[leak.leak].severity === 'low' && !config.optIn.includes(leak.leak))) {
				continue;
			}
			const node = idMap.get(call.call.id);
			const severity = call.sink.class === SecretSinkClass.Browser ? 'high' : Leaks[leak.leak].severity;
			results.push({
				involvedId: call.call.id,
				loc:        SourceLocation.fromNode(node) ?? SourceLocation.invalid(),
				certainty:  leak.certain && [...call.secret.values()].some(k => k !== 'file') ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain,
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
