import { valueSetGuard } from '../../eval/values/general';
import { Resolve } from '../../environments/resolve-helper';
import { isValue, type Value } from '../../eval/values/r-value';
import { Identifier, type BrandedIdentifier } from '../../environments/identifier';
import { Dataflow } from '../../graph/df-helper';
import { OriginType } from '../../origin/dfg-get-origin';
import { builtInLookup, fnEntry } from '../../environments/query-fn-props';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowGraph } from '../../graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { GuardTerm, type GuardBinding, type GuardConstant } from './guard-term';
import { parseGuardTerm } from './guard-term-syntax';
import { builtInClauses, builtInGuards, type GuardOrigin, type StatedGuards } from './built-in-guards';
import { atCall, callBinding, guardsOfFunctions, isParameter, readsViaParameter, type FunctionGuards } from './function-guards';
import { statedGuardsOf } from './stated-guards';
import { guardFactsOf } from './guard-knowledge';
import { readingOf } from './guard-claims';
import type { GuardFactsLookup } from '../../environments/guard-facts';
import { RConstant, RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { BuiltInProcName } from '../../environments/built-in-proc-name';
import { DfgVertex, VertexType, type DataflowGraphVertexFunctionCall } from '../../graph/vertex';
import { MatchArgs } from '../../graph/match-args';
import { isBaseRPackage } from '../../../util/r-base-packages';
import { RS3Generics } from '../../../data/r-s3-generics.generated';
import { uniqueArray } from '../../../util/collections/arrays';

/** What a function asks of its calls: the conditions of its guards over its formals, and the formals a call has to give. */
export interface FunctionContract {
	readonly formals:     readonly BrandedIdentifier[]
	readonly required:    readonly BrandedIdentifier[]
	readonly clauses:     readonly GuardTerm[]
	/** `program` if inferred from a definition of the analyzed code, else where the stated guards come from, see {@link GuardOrigin} */
	readonly source:      'program' | GuardOrigin['source']
	/** the definition the contract is inferred from, for a `program` contract */
	readonly definition?: NodeId
	/** the guards inferred for {@link FunctionContract.definition} */
	readonly guards?:     FunctionGuards
	/** the guards stated without a program, for any other contract */
	readonly stated?:     StatedGuards
}

/** What a call breaks of a contract: a formal it does not give, or a condition that fails for every value the arguments may hold. */
export type ContractBreach =
	| { readonly kind: 'missing', readonly formal: BrandedIdentifier }
	| { readonly kind: 'fails', readonly condition: string, readonly values: readonly (readonly [formal: BrandedIdentifier, shown: string])[] };

/** What the contracts of one program are worked out against, see {@link CallContracts.of}. */
export interface ContractScope {
	readonly graph:           DataflowGraph
	readonly idMap:           AstIdMap
	readonly ctx:             ReadOnlyFlowrAnalyzerContext
	readonly facts:           GuardFactsLookup
	/** whether code other than the program may bring S3 methods of the given generic */
	readonly mayAddMethods:   (generic: BrandedIdentifier) => boolean
	/** whether the program rewrites a function (`formals(f) <- ...`), after which the contract of its definition no longer holds */
	readonly rewritesFormals: boolean
	readonly definitions:     Map<NodeId, FunctionContract | undefined>
	readonly functions:       Map<string, FunctionContract | undefined>
}

/** the replacement functions that rewrite a function, after which its formals and checks are no longer those of its definition */
const FormalsRewriters: ReadonlySet<BrandedIdentifier> = new Set(['formals<-', 'body<-', 'args<-']);

/** How many combinations of the values the arguments may hold a condition is evaluated for. */
const MaxCombinations = 64;

/** How many nodes {@link readsParameter} looks at before it gives up. */
const MaxReads = 1024;

const LoadingCalls: ReadonlySet<BrandedIdentifier> = new Set(['loadNamespace', 'requireNamespace', 'attachNamespace', 'registerS3method', 'source', 'sys.source', 'attach']);

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
		if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Library) || (namespace !== undefined && !isBaseRPackage(namespace)) || LoadingCalls.has(Identifier.getName(vertex.name))) {
			return true;
		}
	}
	return false;
}

/** The scope to work out the contracts of the calls of the analyzed program in, sharing what they have in common. */
function of(this: void, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, idMap: AstIdMap = graph.idMap as AstIdMap): ContractScope {
	const bindings = Dataflow.definitionsByName(graph);
	let loads: boolean | undefined;
	return {
		graph, idMap, ctx, facts:           guardFactsOf(ctx),
		mayAddMethods:   generic => [...bindings.keys()].some(name => name.startsWith(`${generic}.`)) || (loads ??= loadsPackages(graph, ctx)),
		rewritesFormals: [...graph.verticesOfType(VertexType.FunctionCall)].some(([, v]) => FormalsRewriters.has(Identifier.getName(v.name))),
		definitions:     new Map(),
		functions:       new Map()
	};
}

/** Whether `a` and `b` name the same release of R, as what the closures of R check only changes between those. */
function sameRelease(this: void, a: string, b: string): boolean {
	return a.split('.').slice(0, 2).join('.') === b.split('.').slice(0, 2).join('.');
}

/** The conditions of the guards stated without a program, read back into terms over the formals. */
function statedClauses(this: void, name: BrandedIdentifier, stated: StatedGuards, formals: readonly BrandedIdentifier[], scope: ContractScope): GuardTerm[] {
	const texts = stated.because?.map(b => b.requires) ?? [stated.requires];
	const terms = texts.flatMap(text => {
		const term = text === '' ? undefined : parseGuardTerm(text, formals, scope.facts);
		return term === undefined ? [] : GuardTerm.conjuncts(term);
	});
	/* a value without a class attribute may still run a method another package registers for its implicit class */
	const open = (stated.dispatches !== undefined || RS3Generics.genericFormals[String(name)] !== undefined) && scope.mayAddMethods(name);
	return terms.filter(t => !open || !GuardTerm.mentions(t, 'is.object'));
}

/** What is stated of a function by name: what the signature database answers (given a context to ask it in), or else flowR's table of the base packages. */
function statedOf(this: void, name: Identifier, ctx?: ReadOnlyFlowrAnalyzerContext): StatedGuards | undefined {
	return (ctx === undefined ? undefined : fnEntry(name, ctx).entry?.guards) ?? builtInGuards(Identifier.getName(name), Identifier.getNamespace(name));
}

/** The contract of a function by name: what its closure checks as the base table or the signature database states it, or else what R checks of the function written in C. */
function ofFunction(this: void, name: Identifier, scope: ContractScope): FunctionContract | undefined {
	const key = Identifier.toString(name);
	if(!scope.functions.has(key)) {
		scope.functions.set(key, contractOfFunction(name, scope));
	}
	return scope.functions.get(key);
}

function contractOfFunction(this: void, name: Identifier, scope: ContractScope): FunctionContract | undefined {
	const { ctx, facts } = scope;
	const [bare, namespace] = [Identifier.getName(name), Identifier.getNamespace(name)];
	const formals = builtInLookup(ctx)(name)?.sig?.map(([formal]) => formal) ?? fnEntry(name, ctx).entry?.signature.map(p => p.name);
	if(formals === undefined) {
		return undefined;
	}
	const stated = statedOf(name, ctx);
	const version = ctx.rVersionKnown ? ctx.resolvedRVersion : undefined;
	const ofC = namespace === undefined || isBaseRPackage(namespace) ? builtInClauses(bare, facts) : undefined;
	const origin = stated?.origin;
	let clauses: readonly GuardTerm[] = [];
	if(stated !== undefined && origin !== undefined && origin.source !== 'builtin') {
		clauses = origin.source === 'base-table' && version !== undefined && !sameRelease(origin.r, version) ? [] : statedClauses(bare, stated, formals, scope);
	} else if(ofC !== undefined) {
		clauses = ofC.map(c => c.requires);
	} else if(stated !== undefined) {
		clauses = statedClauses(bare, stated, formals, scope);
	}
	const required = stated?.required ?? [];
	return clauses.length === 0 && required.length === 0 ? undefined : { formals, required, clauses, source: origin?.source ?? 'builtin', stated };
}

/** The contract inferred for a definition of the program, none once the program rewrites functions. */
function ofDefinition(this: void, definition: NodeId, scope: ContractScope): FunctionContract | undefined {
	if(scope.rewritesFormals) {
		return undefined;
	}
	if(!scope.definitions.has(definition)) {
		const node = scope.idMap.get(definition);
		// eslint-disable-next-line flowr/use-instead -- FunctionSemantics exposes this module, so it cannot be imported here
		const guards = RFunctionDefinition.is(node) ? guardsOfFunctions([definition], scope.graph, { ctx: scope.ctx })[definition] : undefined;
		/* a definition that asks nothing of its calls has no contract to check them against */
		scope.definitions.set(definition, guards === undefined || !RFunctionDefinition.is(node) || (guards.clauses.length === 0 && guards.required.length === 0) ? undefined : {
			formals:  node.parameters.map(p => p.name.content),
			required: guards.required,
			clauses:  guards.clauses.map(c => c.requires),
			source:   'program',
			definition,
			guards
		});
	}
	return scope.definitions.get(definition);
}

/** The contract of what the call reaches: the one definition of the program it calls, or a function of R flowR knows the guards of. */
function ofCall(this: void, call: NodeId, scope: ContractScope): FunctionContract | undefined {
	const { graph } = scope;
	const origins = Dataflow.origin(graph, call) ?? [];
	if(origins.length === 1 && origins[0].type === OriginType.BuiltInFunctionOrigin) {
		return ofFunction(origins[0].fn.name, scope);
	}
	const definitions = Dataflow.calleeDefinitionsOf(graph, call);
	return definitions.length !== 1 || readsViaParameter(origins, graph) || origins.some(o => o.type === OriginType.BuiltInFunctionOrigin) ? undefined : ofDefinition(definitions[0].info.id, scope);
}

/** The contract in the form the signature database stores and the browsers show, see {@link StatedGuards}. */
function stated(this: void, contract: FunctionContract, idMap: AstIdMap): StatedGuards | undefined {
	return contract.stated ?? (contract.guards === undefined ? undefined : statedGuardsOf(contract.guards, idMap));
}

/** Whether what the expression holds may depend on a parameter of a function, which value resolution answers with what the calls flowR sees hand over, and not for every call. */
function readsParameter(this: void, node: RNodeWithParent, scope: ContractScope): boolean {
	const seen = new Set<NodeId>();
	const todo: RNodeWithParent[] = [node];
	for(let at = todo.pop(); at !== undefined; at = todo.pop()) {
		if(seen.has(at.info.id)) {
			continue;
		} else if(seen.size >= MaxReads) {
			return true;
		}
		seen.add(at.info.id);
		if(RSymbol.is(at)) {
			const sources = Dataflow.valueSources(at.info.id, scope.graph);
			if(sources === undefined || sources.some(s => isParameter(s, scope.idMap))) {
				return true;
			}
			todo.push(...sources.flatMap(s => s === at.info.id ? [] : [scope.idMap.get(s)].filter(n => n !== undefined)));
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
function argumentLiterals(this: void, node: RNodeWithParent, vertex: DataflowGraphVertexFunctionCall, scope: ContractScope): GuardTerm[] | undefined {
	if(readsParameter(node, scope)) {
		return undefined;
	}
	const values = valueSetGuard(Resolve.toValue(node, { graph: scope.graph, environment: vertex.environment, ctx: scope.ctx }));
	if(values?.type !== 'set' || values.elements.length === 0) {
		return undefined;
	}
	const literals = values.elements.map(literalsOf);
	return literals.includes(undefined) ? undefined : (literals as GuardTerm[][]).flat();
}

/** Every way of choosing one of the literals per placeholder, `undefined` if there are too many. */
function combinations(this: void, choices: ReadonlyMap<BrandedIdentifier, readonly GuardTerm[]>): GuardBinding[] | undefined {
	let result = [new Map<BrandedIdentifier, GuardTerm>()];
	for(const [name, literals] of choices) {
		result = result.flatMap(binding => literals.map(l => new Map<BrandedIdentifier, GuardTerm>([...binding, [name, l]])));
		if(result.length > MaxCombinations) {
			return undefined;
		}
	}
	return result;
}

/** The literals as R prints them, a number once, rather than as each of the types it may have. */
function shown(this: void, literals: readonly GuardTerm[]): string[] {
	const asDouble = (text: string) => text.replace(/(?<=[0-9])L\b/g, '');
	return uniqueArray(literals.map(l => asDouble(GuardTerm.render(l))));
}

/** What of the contract the call breaks for sure, each condition with the values it fails for. */
function breaches(this: void, call: NodeId, contract: FunctionContract, scope: ContractScope): ContractBreach[] {
	const { graph, facts } = scope;
	const vertex = graph.getVertex(call);
	if(!DfgVertex.isFunctionCall(vertex)) {
		return [];
	}
	const given = MatchArgs.toSpec(vertex.args, Object.fromEntries(contract.formals.map(f => [f, f])));
	const result: ContractBreach[] = MatchArgs.handsOnDots(vertex.args, graph) ? [] : contract.required.filter(f => f !== '...' && (given.get(f)?.length ?? 0) === 0).map(formal => ({ kind: 'missing', formal }));
	const args = new Map<BrandedIdentifier, { readonly node: RNodeWithParent, literals?: readonly GuardTerm[] }>();
	const binding = callBinding(vertex, contract.formals, graph, node => {
		const placeholder: BrandedIdentifier = `#${String(node.info.id)}`;
		args.set(placeholder, { node });
		return GuardTerm.formal(placeholder);
	});
	const literalsAt = (placeholder: BrandedIdentifier) => {
		const argument = args.get(placeholder);
		if(argument !== undefined && argument.literals === undefined) {
			/* what no value is known for is still given, so it is no longer missing */
			argument.literals = argumentLiterals(argument.node, vertex, scope) ?? [{ kind: 'free', name: placeholder }];
		}
		return argument?.literals ?? [];
	};
	for(const clause of contract.clauses) {
		const { requires } = atCall(clause, binding, undefined, facts);
		const placeholders = [...GuardTerm.formalsOf(requires)];
		const bindings = combinations(new Map(placeholders.map(p => [p, literalsAt(p)])));
		if(bindings === undefined || !bindings.every(b => GuardTerm.isFalse(GuardTerm.substituteCondition(requires, b, undefined, facts)))) {
			continue;
		}
		const values = contract.formals.flatMap(formal => {
			const bound = binding.binding.get(formal);
			const literals = bound?.kind === 'formal' && placeholders.includes(bound.name) ? literalsAt(bound.name) : [];
			const node = bound?.kind === 'formal' ? args.get(bound.name)?.node : undefined;
			return literals.length === 0 ? [] : [[formal, RConstant.is(node) ? node.lexeme : shown(literals).join(' or ')] as const];
		});
		result.push({ kind: 'fails', condition: readingOf(clause, facts) ?? GuardTerm.render(clause), values });
	}
	return result;
}

/** The breach in words, as `m >= 0 fails for m = -1`. */
function describe(this: void, breach: ContractBreach): string {
	return breach.kind === 'missing' ? `${breach.formal} is not given` : `${breach.condition} fails for ${breach.values.map(([formal, value]) => `${formal} = ${value}`).join(', ')}`;
}

/** The contract the call reaches and what of it the call breaks for sure, `undefined` if flowR knows no contract of what it calls. */
function check(this: void, call: NodeId, scope: ContractScope): { readonly contract: FunctionContract, readonly breaches: readonly ContractBreach[] } | undefined {
	const contract = ofCall(call, scope);
	return contract === undefined ? undefined : { contract, breaches: breaches(call, contract, scope) };
}

/**
 * The one layer to ask what a function asks of its calls, its *contract*, and whether a call keeps it: stated by the signature database or
 * flowR's tables for a function by name, or inferred from a definition of the program by the guards analysis, see {@link FunctionGuards}.
 * The conditions of the guards of the callee are taken to the call as the guard analysis takes them to a caller, and a call only breaks
 * a condition if it fails for every value the arguments may hold.
 * @helper api
 */
export const CallContracts = {
	name: 'CallContracts',
	/** The scope to ask for the contracts of one analyzed program in. */
	of,
	/** What is stated of a function by name, without a program. */
	statedOf,
	/** The contract of a function by name. */
	ofFunction,
	/** The contract inferred for a definition of the program. */
	ofDefinition,
	/** The contract of what a call reaches. */
	ofCall,
	/** The contract in the form the signature database stores and the browsers show. */
	stated,
	/** What of a contract a call breaks for sure. */
	breaches,
	/** The contract of what a call reaches and what of it the call breaks. */
	check,
	/** A breach in words. */
	describe,
	/** The replacement functions that rewrite a function, after which its contract no longer holds. */
	FormalsRewriters
} as const;
