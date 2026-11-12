import { prettyPrint, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { DfgVertex, VertexType, type DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { valueSetGuard } from '../../dataflow/eval/values/general';
import { Resolve } from '../../dataflow/environments/resolve-helper';
import { isValue, type Value } from '../../dataflow/eval/values/r-value';
import { type BrandedIdentifier, Identifier } from '../../dataflow/environments/identifier';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { OriginType } from '../../dataflow/origin/dfg-get-origin';
import { builtInLookup, fnEntry } from '../../dataflow/environments/query-fn-props';
import { calledDefinitions, FormalsRewriters, formalNames, isQuoted } from './cmd-check/cmd-check-util';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap, ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { GuardTerm, type GuardBinding, type GuardConstant } from '../../dataflow/fn/guards/guard-term';
import { parseGuardTerm } from '../../dataflow/fn/guards/guard-term-syntax';
import { builtInClauses, type StatedGuards } from '../../dataflow/fn/guards/built-in-guards';
import { atCall, callBinding, isParameter, readsViaParameter } from '../../dataflow/fn/guards/function-guards';
import { guardFactsOf } from '../../dataflow/fn/guards/guard-knowledge';
import { readingOf } from '../../dataflow/fn/guards/guard-claims';
import type { GuardFactsLookup } from '../../dataflow/environments/guard-facts';
import { RConstant, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { DefaultCfgSimplificationOrder } from '../../control-flow/cfg-simplification';
import { isBaseRPackage } from '../../util/r-base-packages';
import { RS3Generics } from '../../data/r-s3-generics.generated';
import { uniqueArray } from '../../util/collections/arrays';

export interface CallContractsResult extends LintingResult {
	/** the function called */
	readonly function: Identifier
	/** what the call breaks of what the function asks for, each condition in R syntax with the values the call hands over */
	readonly broken:   readonly string[]
}

export type CallContractsConfig = MergeableRecord;

export interface CallContractsMetadata extends MergeableRecord {
	/** calls of a function flowR knows a contract of */
	readonly checkedCalls: number
}

/** What a function asks of its calls: the conditions of its guards over its formals. */
interface Contract {
	readonly formals:  readonly BrandedIdentifier[]
	readonly required: readonly BrandedIdentifier[]
	readonly clauses:  readonly GuardTerm[]
}

/** How many combinations of the values the arguments may hold a condition is evaluated for. */
const MaxCombinations = 64;

/** How many nodes {@link readsParameter} looks at before it gives up. */
const MaxReads = 1024;

interface Analysis {
	readonly graph:         DataflowGraph
	readonly idMap:         AstIdMap
	readonly ctx:           ReadOnlyFlowrAnalyzerContext
	readonly facts:         GuardFactsLookup
	/** whether code other than the program may bring S3 methods of the given generic */
	readonly mayAddMethods: (generic: BrandedIdentifier) => boolean
}

/** Whether `a` and `b` name the same release of R, as what the closures of R check only changes between those. */
function sameRelease(this: void, a: string, b: string): boolean {
	return a.split('.').slice(0, 2).join('.') === b.split('.').slice(0, 2).join('.');
}

/** The conditions of the guards stated without a program, read back into terms over the formals. */
function statedClauses(this: void, name: BrandedIdentifier, stated: StatedGuards, formals: readonly BrandedIdentifier[], data: Analysis): GuardTerm[] {
	const texts = stated.because?.map(b => b.requires) ?? [stated.requires];
	const terms = texts.flatMap(text => {
		const term = text === '' ? undefined : parseGuardTerm(text, formals, data.facts);
		return term === undefined ? [] : GuardTerm.conjuncts(term);
	});
	/* a value without a class attribute may still run a method another package registers for its implicit class */
	const open = (stated.dispatches !== undefined || RS3Generics.genericFormals[String(name)] !== undefined) && data.mayAddMethods(name);
	return terms.filter(t => !open || !GuardTerm.mentions(t, 'is.object'));
}

/** The contract of a function of R: what its closure checks as the base table or the signature database states it, or else what R checks of the function written in C. */
function builtInContract(this: void, name: Identifier, data: Analysis): Contract | undefined {
	const { ctx, facts } = data;
	const [bare, namespace] = [Identifier.getName(name), Identifier.getNamespace(name)];
	const entry = fnEntry(name, ctx);
	const formals = builtInLookup(ctx)(name)?.sig?.map(([formal]) => formal) ?? entry.entry?.signature.map(p => p.name);
	if(formals === undefined) {
		return undefined;
	}
	const stated = entry.entry?.guards ?? FunctionSemantics.builtInGuards(bare, namespace);
	const version = ctx.rVersionKnown ? ctx.resolvedRVersion : undefined;
	const ofC = namespace === undefined || isBaseRPackage(namespace) ? builtInClauses(bare, facts) : undefined;
	const origin = stated?.origin;
	let clauses: readonly GuardTerm[] = [];
	if(stated !== undefined && origin !== undefined && origin.source !== 'builtin') {
		clauses = origin.source === 'base-table' && version !== undefined && !sameRelease(origin.r, version) ? [] : statedClauses(bare, stated, formals, data);
	} else if(ofC !== undefined) {
		clauses = ofC.map(c => c.requires);
	} else if(stated !== undefined) {
		clauses = statedClauses(bare, stated, formals, data);
	}
	return clauses.length === 0 && (stated?.required ?? []).length === 0 ? undefined : { formals, required: stated?.required ?? [], clauses };
}

/** The contract of what the call reaches: the one definition of the program it calls, or a function of R flowR knows the guards of. */
function contractOf(this: void, id: NodeId, data: Analysis, ofDefinition: (definition: RFunctionDefinition<ParentInformation>) => Contract | undefined): Contract | undefined {
	const { graph, idMap } = data;
	const origins = Dataflow.origin(graph, id) ?? [];
	if(origins.length === 1 && origins[0].type === OriginType.BuiltInFunctionOrigin) {
		return builtInContract(origins[0].fn.name, data);
	}
	const definitions = calledDefinitions(graph, id, idMap);
	return definitions.length !== 1 || readsViaParameter(origins, graph) || origins.some(o => o.type === OriginType.BuiltInFunctionOrigin) ? undefined : ofDefinition(definitions[0]);
}

/** Whether what the expression holds may depend on a parameter of a function, which value resolution answers with what the calls flowR sees hand over, and not for every call. */
function readsParameter(this: void, node: RNodeWithParent, data: Analysis, seen: Set<NodeId> = new Set()): boolean {
	const todo: RNodeWithParent[] = [node];
	for(let at = todo.pop(); at !== undefined; at = todo.pop()) {
		if(seen.has(at.info.id)) {
			continue;
		} else if(seen.size >= MaxReads) {
			return true;
		}
		seen.add(at.info.id);
		if(RSymbol.is(at)) {
			const sources = Dataflow.valueSources(at.info.id, data.graph);
			if(sources === undefined || sources.some(s => isParameter(s, data.idMap))) {
				return true;
			}
			todo.push(...sources.flatMap(s => s === at.info.id ? [] : [data.idMap.get(s)].filter(n => n !== undefined)));
		}
		todo.push(...RNode.directChildren(at).filter(c => c !== EmptyArgument));
	}
	return false;
}

/** A number as literals of the types it may have, as the value domain does not tell `1` from `1L`. */
function numberLiterals(this: void, num: number, complex: boolean): GuardConstant[] | undefined {
	if(complex || Number.isNaN(num)) {
		return undefined;
	} else if(!Number.isFinite(num)) {
		return [{ kind: 'constant', lexeme: num > 0 ? 'Inf' : '-Inf', value: num }];
	}
	const double: GuardConstant = { kind: 'constant', lexeme: String(num), value: num };
	return Number.isInteger(num) && Math.abs(num) <= 2147483647 ? [{ kind: 'constant', lexeme: `${num}L`, value: num }, double] : [double];
}

/** The literals a single value may be written as, `undefined` if it is none. */
function scalarLiterals(this: void, value: Value): GuardConstant[] | undefined {
	if(typeof value !== 'object' || value === null) {
		return undefined;
	}
	switch(value.type) {
		case 'string':
			return isValue(value.value) ? [GuardTerm.string(value.value.str)] : undefined;
		case 'logical':
			return typeof value.value === 'boolean' ? [value.value ? GuardTerm.True : GuardTerm.False] : undefined;
		case 'number':
			return isValue(value.value) ? numberLiterals(value.value.num, value.value.complexNumber) : undefined;
		case 'interval': {
			const [start, end] = [scalarLiterals(value.start), scalarLiterals(value.end)];
			return value.startInclusive && value.endInclusive && start !== undefined && start[0]?.value === end?.[0]?.value ? start : undefined;
		}
		default:
			return undefined;
	}
}

/** The terms a value may be written as without attributes: a literal, `NULL`, or a `c(...)` of literals of one type, `undefined` if it is none of those. */
function literalsOf(this: void, value: Value): GuardTerm[] | undefined {
	if(typeof value === 'object' && value !== null && value.type === 'null') {
		return [{ kind: 'constant', lexeme: 'NULL' }];
	} else if(typeof value !== 'object' || value === null || value.type !== 'vector') {
		return scalarLiterals(value);
	} else if(!Array.isArray(value.elements)) {
		return undefined;
	}
	const elements = (value.elements as readonly Value[]).map(scalarLiterals);
	if(elements.length === 0) {
		return [{ kind: 'constant', lexeme: 'NULL' }];
	} else if(elements.includes(undefined) || new Set(elements.map(e => e?.length)).size !== 1 || new Set(elements.map(e => typeof e?.[0].value)).size !== 1) {
		return undefined;
	}
	/* the elements have one type: all integers or all doubles for numbers */
	const variants = (elements as GuardConstant[][])[0].map((_, at) => (elements as GuardConstant[][]).map(e => e[at]));
	return variants.map(v => GuardTerm.known('c', ...v));
}

/** The literals the argument may hold, `undefined` if not all of them are known. */
function argumentLiterals(this: void, node: RNodeWithParent, vertex: DataflowGraphVertexFunctionCall, data: Analysis): GuardTerm[] | undefined {
	if(readsParameter(node, data)) {
		return undefined;
	}
	const values = valueSetGuard(Resolve.toValue(node, { graph: data.graph, environment: vertex.environment, ctx: data.ctx }));
	if(values?.type !== 'set' || values.elements.length === 0) {
		return undefined;
	}
	const literals = values.elements.map(literalsOf);
	return literals.includes(undefined) ? undefined : (literals as GuardTerm[][]).flat();
}

/** Every way of choosing one of the literals per placeholder, `undefined` if there are too many. */
function combinations(this: void, of: ReadonlyMap<BrandedIdentifier, readonly GuardTerm[]>): GuardBinding[] | undefined {
	let result = [new Map<BrandedIdentifier, GuardTerm>()];
	for(const [name, literals] of of) {
		result = result.flatMap(binding => literals.map(l => new Map<BrandedIdentifier, GuardTerm>([...binding, [name, l]])));
		if(result.length > MaxCombinations) {
			return undefined;
		}
	}
	return result;
}

/** The placeholder an argument stands as in the conditions of the callee, until its values are filled in. */
function placeholderOf(this: void, node: RNodeWithParent): BrandedIdentifier {
	return `#${String(node.info.id)}`;
}

/** The literals as R prints them, a number once, rather than as each of the types it may have. */
function shown(this: void, literals: readonly GuardTerm[]): string[] {
	const written = literals.map(l => GuardTerm.render(l));
	const asDouble = (text: string) => text.replace(/(?<=[0-9])L\b/g, '');
	return uniqueArray(written.map(asDouble));
}

/** What of the contract the call breaks for sure, each condition with the values it fails for. */
function brokenBy(this: void, vertex: DataflowGraphVertexFunctionCall, contract: Contract, data: Analysis): string[] {
	const { graph, facts } = data;
	const spreads = FunctionSemantics.call.match.handsOnDots(vertex.args, graph);
	const given = FunctionSemantics.call.match.toSpec(vertex.args, Object.fromEntries(contract.formals.map(f => [f, f])));
	const failures = spreads ? [] : contract.required.filter(f => f !== '...' && (given.get(f)?.length ?? 0) === 0).map(f => `${f} is not given`);
	const arguments_ = new Map<BrandedIdentifier, { readonly node: RNodeWithParent, literals?: readonly GuardTerm[] }>();
	const call = callBinding(vertex, contract.formals, graph, node => {
		const placeholder = placeholderOf(node);
		arguments_.set(placeholder, { node });
		return GuardTerm.formal(placeholder);
	});
	const literalsOf = (placeholder: BrandedIdentifier) => {
		const argument = arguments_.get(placeholder);
		if(argument !== undefined && argument.literals === undefined) {
			/* what no value is known for is still given, so it is no longer missing */
			argument.literals = argumentLiterals(argument.node, vertex, data) ?? [{ kind: 'free', name: placeholder }];
		}
		return argument?.literals ?? [];
	};
	for(const clause of contract.clauses) {
		const { requires } = atCall(clause, call, undefined, facts);
		const placeholders = [...GuardTerm.formalsOf(requires)];
		const bindings = combinations(new Map(placeholders.map(p => [p, literalsOf(p)])));
		if(bindings === undefined || !bindings.every(binding => GuardTerm.isFalse(GuardTerm.substituteCondition(requires, binding, undefined, facts)))) {
			continue;
		}
		const values = contract.formals.flatMap(formal => {
			const bound = call.binding.get(formal);
			const literals = bound?.kind === 'formal' && placeholders.includes(bound.name) ? literalsOf(bound.name) : [];
			const node = bound?.kind === 'formal' ? arguments_.get(bound.name)?.node : undefined;
			const written = RConstant.is(node) ? node.lexeme : undefined;
			return literals.length === 0 ? [] : [`${formal} = ${written ?? shown(literals).join(' or ')}`];
		});
		failures.push(`${readingOf(clause, facts) ?? GuardTerm.render(clause)} fails for ${values.join(', ')}`);
	}
	return failures;
}

/** Whether something besides the program may register S3 methods: a package it loads, attaches, or reaches into. */
function loadsPackages(this: void, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	if(ctx.deps.getDependencies().length > 0) {
		return true;
	}
	for(const [, vertex] of graph.vertices(true)) {
		if(!DfgVertex.isFunctionCall(vertex)) {
			continue;
		}
		const namespace = Identifier.getNamespace(vertex.name);
		if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Library) || (namespace !== undefined && !isBaseRPackage(namespace))
			|| ['loadNamespace', 'requireNamespace', 'attachNamespace', 'registerS3method', 'source', 'sys.source', 'attach'].includes(Identifier.getName(vertex.name))) {
			return true;
		}
	}
	return false;
}

/**
 * Finds calls that hand a function a value its contract rules out, like `combn(4, -1)` for `m >= 0`, or that leave out an
 * argument it needs: such a call fails whenever it runs. The conditions of the guards of the callee are taken to the call
 * as the guard analysis takes them to a caller, and are only reported if they fail for every value the arguments may hold.
 */
export const CALL_CONTRACTS = {
	createSearch: () => Q.all().filter(VertexType.FunctionCall).with(Enrichment.CfgInformation, {
		checkReachable:       true,
		simplificationPasses: [...DefaultCfgSimplificationOrder, 'analyze-dead-code']
	}),
	processSearchResult: async(elements, _config, data) => {
		const dataflow = await data.dataflow();
		const { graph } = dataflow;
		const ctx = data.inspectContext();
		const idMap = graph.idMap ?? (await data.normalize()).idMap;
		const bindings = Dataflow.definitionsByName(graph);
		let loads: boolean | undefined;
		const analysis: Analysis = {
			graph, idMap, ctx, facts:         guardFactsOf(ctx),
			mayAddMethods: generic => [...bindings.keys()].some(name => name.startsWith(`${generic}.`)) || (loads ??= loadsPackages(graph, ctx))
		};
		/* once the program rewrites a function (`formals(f) <- ...`), the contract of its definition no longer holds for the calls reaching it */
		const rewritesFormals = [...graph.verticesOfType(VertexType.FunctionCall)].some(([, v]) => FormalsRewriters.has(Identifier.getName(v.name)));
		const ofDefinitions = new Map<NodeId, Contract | undefined>();
		const ofDefinition = (definition: RFunctionDefinition<ParentInformation>) => {
			const id = definition.info.id;
			if(rewritesFormals) {
				return undefined;
			}
			if(!ofDefinitions.has(id)) {
				const guards = FunctionSemantics.guards([id], graph, { ctx })[id];
				ofDefinitions.set(id, guards === undefined ? undefined : { formals: formalNames(definition), required: guards.required, clauses: guards.clauses.map(c => c.requires) });
			}
			return ofDefinitions.get(id);
		};
		let checkedCalls = 0;
		const results: CallContractsResult[] = [];
		for(const element of elements.getElements()) {
			const id = element.node.info.id;
			const vertex = graph.getVertex(id);
			if(!DfgVertex.isFunctionCall(vertex) || enrichmentContent(element, Enrichment.CfgInformation)?.isReachable === false || isQuoted(graph, id, idMap)) {
				continue;
			}
			const contract = contractOf(id, analysis, ofDefinition);
			if(contract === undefined) {
				continue;
			}
			checkedCalls++;
			const failures = brokenBy(vertex, contract, analysis);
			const loc = SourceLocation.fromNode(element.node);
			if(failures.length > 0 && loc !== undefined) {
				results.push({ certainty: LintingResultCertainty.Uncertain, involvedId: id, loc, function: vertex.name, broken: failures });
			}
		}
		return { results, '.meta': { checkedCalls } };
	},
	prettyPrint: prettyPrint(
		result => `call of \`${Identifier.toString(result.function)}\` fails its contract at ${SourceLocation.format(result.loc)}`,
		result => `The call of \`${Identifier.toString(result.function)}\` at ${SourceLocation.format(result.loc)} fails whenever it runs: ${result.broken.join('; ')}.`
	),
	info: {
		name:          'Call Contracts',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds calls that hand a function a value its contract rules out, or leave out an argument it needs, so they fail whenever they run.',
		defaultConfig: () => ({})
	}
} as const satisfies LintingRule<CallContractsResult, CallContractsMetadata, CallContractsConfig>;
