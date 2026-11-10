/**
 * The `FunctionSemantics` facade wires these together, so a sibling here has to call the backing function directly; going through `FunctionSemantics` would make `src/dataflow/fn/function-semantics.ts` import its own importers.
 * @lintIgnore use-instead
 */
import type { DataflowGraph } from '../../graph/graph';
import { FunctionArgument } from '../../graph/graph';
import { Dataflow } from '../../graph/df-helper';
import { OriginType } from '../../origin/dfg-get-origin';
import type { CallRuledOut, DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../../graph/vertex';
import { DfgVertex } from '../../graph/vertex';
import { ArgProp, CallProp, CallProps, ImpureProps, SemanticCallTag, type ArgProps, type FnSig } from '../../environments/built-in-props';
import { Identifier, type BrandedIdentifier, type BrandedNamespace } from '../../environments/identifier';
import { BuiltInProcName } from '../../environments/built-in-proc-name';
import { builtInLookup } from '../../environments/query-fn-props';
import { MatchArgs } from '../../graph/match-args';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RConstant, RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { RFunctionCall, EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RIfThenElse } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import type { RWhileLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RParameter } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { bindsOutside, type BuiltInLookup } from '../frame-reflection';
import { definitionsBehind } from '../higher-order-function';
import { memoize } from '../../../util/collections/defaultmap';
import { GuardTerm, type GuardArgument, type GuardBinding, type GuardCall, type GuardConstant } from './guard-term';
import type { GuardFacts, GuardFactsLookup, RFailure } from '../../environments/guard-facts';
import { asksCallable, callable, composesName, defaultGuardFacts, getAsExists, guardFactsIn, ImplicitClasses, messageFor, onlyComputesBy, passes, succeeds } from './guard-knowledge';
import { s3GroupGenericOf } from '../../environments/group-generics';
import { s4CandidatesFor, s4MethodsOf, type S4Method } from '../dispatch';
import { linkedFunctionIds, MaxContextDepth } from '../../internal/dispatch-linking';
import { baseRExportOwner } from '../../../util/r-base-packages';
import { casesOf, claimsOf, conditionalClaimsOf, impliedBy, relationsOf, returnedFormalOf, returnsOf, type ClaimedName, type ClaimedRelation, type ConditionalClaim, type FormalCase, type FormalClaim, type ReturnedTerm } from './guard-claims';

/** One condition every normal return of a function has passed; if it does not hold, the call fails. */
export interface GuardClause {
	/** the condition, see {@link GuardTerm} */
	readonly requires: GuardTerm
	/** the condition in R syntax */
	readonly rendered: string
	/** what fails if the condition does not hold: a `stop`, a condition of a `stopifnot`, or the call that rejects its argument */
	readonly at:       NodeId
	/** `explicit` if the function checks this itself, or `implicit` if R fails on it, as `"a" + 1` does */
	readonly kind:     'explicit' | 'implicit'
	/** the failure comes before anything else the function does beyond computing a value, so nothing is left to undo */
	readonly pure:     boolean
	/** the calls this was inherited through, outermost first, if the condition is that of a function called */
	readonly via?:     readonly NodeId[]
	/** what the failure says: the literal message of a `stop`, or what R typically says when it rejects a value */
	readonly message?: string
	/** what held on the way to the condition, outermost first, which {@link FunctionGuards.requires} only has as alternatives */
	readonly under?:   readonly GuardTerm[]
}

/** What a function asks for of the calls it can return from, see {@link guardsOfFunctions}. */
export interface FunctionGuards {
	/** every condition found */
	readonly clauses:     readonly GuardClause[]
	/** per formal, what the conditions say about it */
	readonly formals:     Readonly<Record<BrandedIdentifier, FormalClaim>>
	/** what the conditions say of formals relative to each other, like `length(x) >= m` */
	readonly relations:   readonly ClaimedRelation[]
	/** what the conditions say of a formal unless something else lets the call through */
	readonly conditional: readonly ConditionalClaim[]
	/** per formal, the conditions the function checks itself that read it (from `stopifnot`, `if` and `stop`, ...), in R syntax: what {@link FunctionGuards.formals} has no words for, like `x %% 2 == 0`, is here as well */
	readonly conditions:  Readonly<Record<BrandedIdentifier, readonly string[]>>
	/** the formals a call has to supply, as it fails otherwise */
	readonly required:    readonly BrandedIdentifier[]
	/** all conditions in R syntax, an empty string if there are none */
	readonly requires:    string
	/** the conditions that fail before any side effect in R syntax, an empty string if there are none: the tightest precondition that guarantees a clean failure */
	readonly pure:        string
	/** what holds of the value a call returns normally, said as of a formal */
	readonly returns?:    FormalClaim
	/** the formal every normal return hands back unchanged */
	readonly passes?:     BrandedIdentifier
}

/** One condition on the way to some code, with what is known either way about whether it held. */
interface PathStep {
	/** implied by the condition */
	readonly holds: GuardTerm
	/** implied by the code not being reached on account of this condition */
	readonly fails: GuardTerm
}

/** Nothing is known about why the code was reached, as with a loop body. */
const UnknownStep: PathStep = { holds: GuardTerm.True, fails: GuardTerm.True };

type Path = readonly PathStep[];

/** A way out of the code before its end. */
interface Exit {
	/** the conditions that lead to it */
	readonly path: Path
	/** whether it raises an error, returns from the function, or only leaves a loop iteration */
	readonly kind: 'error' | 'return' | 'loop'
}

/** What one definition is known to do, kept while one run is underway. */
interface Contract {
	readonly clauses:  readonly GuardClause[]
	/** the formals read on every way through, which a call therefore has to supply */
	readonly required: readonly BrandedIdentifier[]
	/** whether anything else may have happened than computing a result */
	readonly effects:  boolean
	/** whether it may have written to the frame of its caller */
	readonly opens:    boolean
	/** every way it returns normally, none if flowR does not know them all */
	readonly returned: readonly ReturnedTerm[]
	/** how many of the calls running the function, the innermost first, a dispatch within may decide more for, see {@link contractOf} */
	readonly reach:    number
	/** whether a dispatch within decides more for any known call of the program running the function, whichever that is */
	readonly called:   boolean
}

const NoContract: Contract = { clauses: [], required: [], effects: true, opens: false, returned: [], reach: 0, called: false };

/** What to ask for beyond the definitions, see {@link guardsOfFunctions}. */
export interface FunctionGuardsOptions {
	/** how to ask what a built-in states, so a configured or overwritten one answers, in the R version analyzed for */
	readonly ctx?: ReadOnlyFlowrAnalyzerContext
}

/** What one run shares between the definitions it answers. */
interface GuardState {
	readonly graph:         DataflowGraph
	readonly info:          BuiltInLookup
	readonly facts:         GuardFactsLookup
	/** per definition and the calls it runs for, see {@link contractOf} */
	readonly contracts:     Map<string, Contract>
	/** every name the program binds with where it does so */
	readonly bindings:      ReturnType<typeof Dataflow.definitionsByName>
	/** whether the program binds the name to a function, which lets a call of a name other than a formal succeed */
	readonly bindsFunction: (name: BrandedIdentifier) => boolean
	/** how many contracts are being worked out right now */
	depth:                  number
	/** the terms of the expressions, see {@link termOf} */
	readonly terms:         Map<string, GuardTerm | undefined>
	/** the classes the program binds a function `<generic>.<class>` for */
	readonly methodClasses: (generic: BrandedIdentifier) => readonly string[]
	/** the S4 methods of the program, see {@link s4MethodsIn} */
	s4?:                    ReadonlyMap<BrandedIdentifier, readonly S4Method[]>
}

/** Whether the call runs the given built-in behavior for sure, rather than maybe a function of the program with the same name. */
function runsBuiltIn(this: void, vertex: DataflowGraphVertexFunctionCall | undefined, proc: BuiltInProcName): boolean {
	return DfgVertex.hasOrigin(vertex, proc) && !DfgVertex.hasOrigin(vertex, BuiltInProcName.Function);
}

/** The function currently walked. */
interface Scope {
	readonly definition: RFunctionDefinition<ParentInformation>
	readonly vertex:     DataflowGraphVertexFunctionDefinition
	readonly formals:    ReadonlyMap<NodeId, BrandedIdentifier>
	/** something got hold of the frame of the function, or could write to it as far as flowR can tell, so what a formal holds is not known from here on */
	frameIsOpen:         boolean
	/** the definitions known not to have run on the path walked, see {@link walkUnlessRebound} */
	readonly skips:      Set<NodeId>
}

/** The one walk through the body of a function. */
interface Run {
	readonly scope:    Scope
	readonly state:    GuardState
	readonly clauses:  Map<string, GuardClause>
	/** the formals read without any condition */
	readonly read:     Set<BrandedIdentifier>
	/** the nodes writing to the frame behind the back of the dataflow, see {@link frameOpeners} */
	readonly openers:  ReadonlySet<NodeId>
	/** the nodes whose value the function returns, see {@link markTails} */
	readonly tails:    ReadonlyMap<NodeId, Tail>
	readonly returned: ReturnedTerm[]
	/** the calls the function is walked for, the innermost first, see {@link contractOf} */
	readonly via:      readonly NodeId[]
	/** see {@link Contract.reach} */
	reach:             number
	/** see {@link Contract.called} */
	called:            boolean
	/** whether anything but computing a value may have happened by now */
	effects:           boolean
	/** while walking on as if a branch rebinding these formals was not taken, and the steps of the path from there on, see {@link walkUnlessRebound} */
	rebound?:          { readonly formals: ReadonlySet<BrandedIdentifier>, readonly from: number, readonly depth: number }
}

/** How many branches rebinding a formal are seen past one after the other, see {@link walkUnlessRebound}. */
const MaxReboundDepth = 2;
/** How deep local definitions and predicates are followed. */
const MaxTermDepth = 8;
/** How deep calls are followed, far beyond what code does and well before the stack ends. */
const MaxCalleeDepth = 256;

/** The packages whose functions flowR knows the semantics of when they come with their name. */
const BaseNamespaces: ReadonlySet<BrandedNamespace> = new Set(['base', 'stats', 'utils', 'methods']);

function nodeOf(this: void, id: NodeId, state: GuardState): RNodeWithParent | undefined {
	return state.graph.idMap?.get(id);
}

function callVertexOf(this: void, id: NodeId, state: GuardState): DataflowGraphVertexFunctionCall | undefined {
	const vertex = state.graph.getVertex(id);
	return DfgVertex.isFunctionCall(vertex) ? vertex : undefined;
}

function isParameter(this: void, id: NodeId, state: GuardState): boolean {
	const node = nodeOf(id, state);
	return node !== undefined && RParameter.is(RNode.directParent(node, state.graph.idMap as AstIdMap));
}

/** The definition a call runs for sure, if there is exactly one and nothing else it could be. */
function soleCallee(this: void, id: NodeId, state: GuardState): NodeId | undefined {
	const origins = Dataflow.origin(state.graph, id) ?? [];
	const callees = origins.filter(o => o.type === OriginType.FunctionCallOrigin);
	/* what a parameter holds depends on the call, the calls flowR happens to see say nothing about the others, also when it went through a local first */
	const viaParameter = origins.some(o => o.type === OriginType.ReadVariableOrigin && (Dataflow.valueSources(o.id, state.graph)?.some(v => isParameter(v, state)) ?? true));
	return callees.length === 1 && !viaParameter && !origins.some(o => o.type === OriginType.BuiltInFunctionOrigin) ? callees[0].id : undefined;
}

/** The package providing the function flowR knows about, none for what R ships with. */
function packageOf(this: void, facts: GuardFacts | undefined): BrandedNamespace | undefined {
	return facts?.pkg;
}

/** Whether the call may run a function of the program, an operator linked to the `Ops` methods of the program still being the operator. */
function mayRunOwn(this: void, id: NodeId, vertex: DataflowGraphVertexFunctionCall, state: GuardState): boolean {
	return DfgVertex.hasOrigin(vertex, BuiltInProcName.Function) && Dataflow.origin(state.graph, id)?.some(o => o.type !== OriginType.BuiltInFunctionOrigin) === true;
}

/** The name of the function a call runs, if it is what R or the named package ships with rather than something the program defines. */
function knownNameOf(this: void, id: NodeId, vertex: DataflowGraphVertexFunctionCall, state: GuardState): BrandedIdentifier | undefined {
	if(mayRunOwn(id, vertex, state)) {
		return undefined;
	}
	const qualified = Dataflow.qualify(id, state.graph, false) ?? vertex.name;
	const namespace = Identifier.getNamespace(qualified) ?? Identifier.getNamespace(vertex.name);
	const name = Identifier.getName(vertex.name);
	const pkg = packageOf(state.facts(name));
	return (pkg === undefined ? namespace === undefined || BaseNamespaces.has(namespace) : namespace === pkg) ? name : undefined;
}

/** Whether the call can only compute a value, with what it runs being known. */
function onlyComputes(this: void, id: NodeId, vertex: DataflowGraphVertexFunctionCall, state: GuardState): boolean {
	if(runsBuiltIn(vertex, BuiltInProcName.ExpressionList)) {
		return true;
	}
	const name = knownNameOf(id, vertex, state);
	if(name === undefined) {
		return false;
	}
	const info = state.info(vertex.name);
	if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Assignment)) {
		return !bindsOutside(vertex, info);
	}
	return onlyComputesBy(state.facts(name)) || CallProps.hasAny(info, CallProp.Pure);
}

/** Whether every call within the term is one flowR knows computes nothing but its value, so it may stand in where a variable was read. */
function isPureTerm(this: void, term: GuardTerm, state: GuardState): boolean {
	if(!GuardTerm.isCall(term)) {
		return true;
	}
	const pure = term.known === true && (onlyComputesBy(state.facts(GuardTerm.bareName(term.fn))) || CallProps.hasAny(state.info(term.fn), CallProp.Pure));
	return pure && term.args.every(a => isPureTerm(a.value, state));
}

const NotEvaluated: ReadonlySet<BrandedIdentifier> = new Set(['NA', 'NULL', 'NaN', 'Inf', 'NA_integer_', 'NA_real_', 'NA_character_', 'NA_complex_']);

/** Whether a formal goes by the name, in which case reading it as something from outside means flowR lost track of it. */
function isFormalName(this: void, name: BrandedIdentifier, scope: Scope): boolean {
	return scope.formals.values().some(formal => formal === name);
}

/** The literal a name is bound to, if the program binds it once and for all, which holds whether or not a read of it is linked to that. */
function onceBoundLiteral(this: void, name: BrandedIdentifier, scope: Scope, state: GuardState, depth: number): GuardConstant | undefined {
	const bound = state.bindings.get(name);
	const value = bound.length === 1 && depth < MaxTermDepth ? Dataflow.assignedValueOf(bound[0], state.graph) : undefined;
	const held = value === undefined ? undefined : nodeOf(value, state);
	const term = held === undefined ? undefined : termOf(held, scope, state, depth + 1);
	return term?.kind === 'constant' ? term : undefined;
}

/** What the symbol stands for in terms of the function it is read in: a formal, a value that was bound to a local, or a name from outside. */
function symbolTerm(this: void, node: RNodeWithParent, scope: Scope, state: GuardState, depth: number): GuardTerm | undefined {
	const name = NodeId.recoverBareName(node.info.id, state.graph.idMap);
	if(name === undefined) {
		return undefined;
	} else if(NotEvaluated.has(name)) {
		return { kind: 'constant', lexeme: name };
	} else if(scope.frameIsOpen) {
		return undefined;
	}
	const origins = Dataflow.origin(state.graph, node.info.id)?.filter(o => !scope.skips.has(o.id));
	if(origins === undefined || origins.length === 0) {
		/* no call links the read yet */
		return onceBoundLiteral(name, scope, state, depth) ?? { kind: 'free', name };
	} else if(origins.length > 1) {
		/* what a call binds a formal to, as a dispatch links it, is the formal still */
		const inside = origins.filter(o => scope.formals.has(o.id) || scope.vertex.subflow.graph.has(o.id));
		const formal = inside.length === 1 ? scope.formals.get(inside[0].id) : undefined;
		if(formal !== undefined) {
			return GuardTerm.formal(formal);
		}
		return isFormalName(name, scope) || inside.length > 0 ? undefined : { kind: 'free', name };
	}
	const [{ id }] = origins;
	const free: GuardTerm = { kind: 'free', name, origin: id };
	const formal = scope.formals.get(id);
	if(formal !== undefined) {
		return GuardTerm.formal(formal);
	} else if(NodeId.isBuiltIn(id)) {
		return name === 'T' ? GuardTerm.True : name === 'F' ? GuardTerm.False : free;
	}
	const local = scope.vertex.subflow.graph.has(id);
	const value = depth < MaxTermDepth ? Dataflow.assignedValueOf(id, state.graph) : undefined;
	const held = value === undefined ? undefined : nodeOf(value, state);
	const term = held === undefined ? undefined : termOf(held, scope, state, depth + 1);
	if(local) {
		return term !== undefined && isPureTerm(term, state) ? term : undefined;
	}
	/* what is read from outside can only be stated by its value if that value cannot change: a constant bound once */
	return term?.kind === 'constant' ? term : isFormalName(name, scope) ? undefined : free;
}

/** The arguments of the call as terms, `undefined` if one cannot be stated. */
function argumentTerms(this: void, args: RFunctionCall<ParentInformation>['arguments'], scope: Scope, state: GuardState, depth: number): GuardArgument[] | undefined {
	const terms: GuardArgument[] = [];
	for(const arg of args) {
		if(arg === EmptyArgument || arg.value === undefined) {
			return undefined;
		}
		const value = termOf(arg.value, scope, state, depth);
		if(value === undefined) {
			return undefined;
		}
		terms.push(arg.name === undefined ? { value } : { name: arg.name.content, value });
	}
	return terms;
}

/** The single expression a definition is made of, the `return` around it removed. */
function singleExpression(this: void, definition: RFunctionDefinition<ParentInformation>, state: GuardState): RNodeWithParent | undefined {
	let body: RNodeWithParent = definition.body;
	while(RExpressionList.is(body)) {
		if(body.children.length !== 1) {
			return undefined;
		}
		body = body.children[0];
	}
	if(RFunctionCall.is(body) && runsBuiltIn(callVertexOf(body.info.id, state), BuiltInProcName.Return)) {
		const [only] = body.arguments;
		return body.arguments.length === 1 && only !== EmptyArgument ? only.value : undefined;
	}
	return body;
}

function scopeOf(this: void, id: NodeId, state: GuardState): Scope | undefined {
	const definition = nodeOf(id, state);
	const vertex = state.graph.getVertex(id);
	if(!RFunctionDefinition.is(definition) || !DfgVertex.isFunctionDefinition(vertex)) {
		return undefined;
	}
	return { definition, vertex, formals: new Map(definition.parameters.filter(p => !p.special).map(p => [p.name.info.id, p.name.content])), frameIsOpen: false, skips: new Set() };
}

/** The formals of a function by name, `...` among them. */
function formalNamesOf(this: void, { definition }: Scope): BrandedIdentifier[] {
	return definition.parameters.map(p => p.name.content);
}

/** Whether the argument states the formal it is for, by the name of the formal in full. */
function namesFormal(this: void, argument: DataflowGraphVertexFunctionCall['args'][number], names: readonly BrandedIdentifier[]): boolean {
	return FunctionArgument.isNamed(argument) && names.includes(argument.name);
}

/** What the given arguments of the call bind the formals of the callee to, seen from the caller, with whether that leaves no formal unbound. */
function bindingOfArguments(this: void, vertex: DataflowGraphVertexFunctionCall, args: DataflowGraphVertexFunctionCall['args'], callee: Scope, scope: Scope, state: GuardState, depth: number): { readonly binding: GuardBinding, readonly complete: boolean } {
	const binding = new Map<BrandedIdentifier, GuardTerm>();
	const names = formalNamesOf(callee);
	const matched = MatchArgs.toSpec<BrandedIdentifier>(args, Object.fromEntries(names.map(n => [n, n])));
	for(const [formal, ids] of matched) {
		const value = formal === '...' || ids.length !== 1 ? undefined : valueOfArgument(ids[0], vertex, state);
		const term = value === undefined ? undefined : termOf(value, scope, state, depth);
		if(term !== undefined) {
			binding.set(formal, term);
		}
	}
	return { binding, complete: names.every(n => n !== '...' && (matched.get(n)?.length ?? 0) > 0) };
}

/** What the arguments of the call bind the formals of the callee to for sure: what the dots hand on may name any formal, which moves the arguments given by position, so only the ones given by their full name stay. */
function bindingOf(this: void, vertex: DataflowGraphVertexFunctionCall, callee: Scope, scope: Scope, state: GuardState, depth: number): GuardBinding {
	const names = formalNamesOf(callee);
	const args = MatchArgs.handsOnDots(vertex.args, state.graph) ? vertex.args.filter(a => namesFormal(a, names)) : vertex.args;
	return bindingOfArguments(vertex, args, callee, scope, state, depth).binding;
}

/** What the arguments of a call handing on dots bind if the dots name nothing, which only keeps the arguments in front of the dots in place. */
function bindingBesidesDots(this: void, vertex: DataflowGraphVertexFunctionCall, callee: Scope, scope: Scope, state: GuardState): ReturnType<typeof bindingOfArguments> | undefined {
	const dots = vertex.args.findIndex(a => MatchArgs.handsOnDots([a], state.graph));
	if(dots < 0) {
		return undefined;
	}
	const names = formalNamesOf(callee);
	return bindingOfArguments(vertex, vertex.args.filter((a, at) => at < dots || namesFormal(a, names)), callee, scope, state, 0);
}

/** Whether something the dots hand on bears a name, which only the function holding the dots can tell. */
const DotsBearNames = GuardTerm.known('!', GuardTerm.known('is.null', GuardTerm.known('...names')));
const DotsBearNamesText = GuardTerm.render(DotsBearNames);

/** Whether the dots of the callee are its own and a call leaves them without a name, as nothing it hands on could bear one: a name not spelled out in full may still end up in them. */
function leavesDotsUnnamed(this: void, vertex: DataflowGraphVertexFunctionCall, callee: Scope, state: GuardState): boolean {
	const names = formalNamesOf(callee);
	return names.includes('...') && !MatchArgs.handsOnDots(vertex.args, state.graph) && vertex.args.every(a => !FunctionArgument.isNamed(a) || namesFormal(a, names));
}

/** The node of the value of an argument, a named argument being bound by the node that names it. */
function valueOfArgument(this: void, argument: NodeId, vertex: DataflowGraphVertexFunctionCall, state: GuardState): RNodeWithParent | undefined {
	const named = vertex.args.find(a => FunctionArgument.isNamed(a) && a.nodeId === argument);
	const node = nodeOf(named !== undefined && FunctionArgument.isNamed(named) && named.valueId !== undefined ? named.valueId : argument, state);
	/* `exists("x")` reads `x` through a symbol the dataflow made up, while the argument is what was written */
	const written = node?.info.parent === undefined ? undefined : nodeOf(node.info.parent, state);
	return written !== undefined && node !== undefined && !RNode.directChildren(written).includes(node) ? written : node;
}

/** A call of a program's own function as what its single expression says, which is how a predicate like `is_count(x)` is seen through. */
function inlined(this: void, id: NodeId, vertex: DataflowGraphVertexFunctionCall, scope: Scope, state: GuardState, depth: number): GuardTerm | undefined {
	const target = soleCallee(id, state);
	const callee = target === undefined || depth >= MaxTermDepth ? undefined : scopeOf(target, state);
	const body = callee === undefined ? undefined : singleExpression(callee.definition, state);
	const term = callee === undefined || body === undefined ? undefined : termOf(body, callee, state, depth + 1);
	return term === undefined || callee === undefined ? undefined : GuardTerm.substitute(term, bindingOf(vertex, callee, scope, state, depth + 1));
}

function callTerm(this: void, id: NodeId, fn: string, args: readonly GuardArgument[], state: GuardState): GuardCall | undefined {
	const vertex = callVertexOf(id, state);
	/* `!x` with a `!` of the program's own reads like the one of R, so it cannot be written down */
	if(vertex !== undefined && mayRunOwn(id, vertex, state) && state.info(vertex.name) !== undefined) {
		return undefined;
	}
	const known = vertex === undefined ? undefined : knownNameOf(id, vertex, state);
	/* the package is what the call resolves to, which a function of the program has none of */
	const pkg = vertex === undefined ? undefined : (known === undefined ? undefined : packageOf(state.facts(known))) ?? Identifier.getNamespace(Dataflow.qualify(id, state.graph) ?? vertex.name);
	const named = { kind: 'call', fn: pkg === undefined || vertex === undefined ? fn : Identifier.getName(vertex.name), args, ...(pkg === undefined ? {} : { pkg }) } as const;
	return known === undefined ? named : { ...named, known: true };
}

/** The expression as a term in the formals of the function it is written in, `undefined` if it depends on what cannot be stated in them, worked out once while nothing has changed what the formals hold. */
function termOf(this: void, node: RNodeWithParent, scope: Scope, state: GuardState, depth = 0): GuardTerm | undefined {
	if(scope.frameIsOpen || scope.skips.size > 0) {
		return termOfUncached(node, scope, state, depth);
	}
	const key = `${scope.vertex.id}:${node.info.id}`;
	if(!state.terms.has(key)) {
		state.terms.set(key, termOfUncached(node, scope, state, depth));
	}
	return state.terms.get(key);
}

function termOfUncached(this: void, node: RNodeWithParent, scope: Scope, state: GuardState, depth: number): GuardTerm | undefined {
	switch(node.type) {
		case RType.Number:
			return { kind: 'constant', lexeme: node.lexeme ?? String(node.content.num), value: node.content.num };
		case RType.Logical:
			return node.content ? GuardTerm.True : GuardTerm.False;
		case RType.String:
			return { kind: 'constant', lexeme: node.lexeme ?? JSON.stringify(node.content.str), value: node.content.str };
		case RType.Symbol:
			return symbolTerm(node, scope, state, depth);
		case RType.ExpressionList: {
			const vertex = callVertexOf(node.info.id, state);
			return node.children.length === 1 && (vertex === undefined || !mayRunOwn(node.info.id, vertex, state)) ? termOf(node.children[0], scope, state, depth) : undefined;
		}
		case RType.Argument:
			return node.value === undefined ? undefined : termOf(node.value, scope, state, depth);
		case RType.UnaryOp: {
			const operand = termOf(node.operand, scope, state, depth);
			if(operand === undefined || node.operator === '~') {
				return undefined;
			}
			/* only a numeric literal, as `-1` is a value */
			if(node.operator === '-' && operand.kind === 'constant' && typeof operand.value === 'number') {
				return { kind: 'constant', lexeme: `-${operand.lexeme}`, value: -operand.value };
			}
			return callTerm(node.info.id, node.operator, [{ value: operand }], state);
		}
		case RType.BinaryOp: {
			const [lhs, rhs] = [termOf(node.lhs, scope, state, depth), termOf(node.rhs, scope, state, depth)];
			const binding = DfgVertex.hasOrigin(callVertexOf(node.info.id, state), BuiltInProcName.Assignment);
			return lhs === undefined || rhs === undefined || binding || node.operator === '~' ? undefined : callTerm(node.info.id, node.operator, [{ value: lhs }, { value: rhs }], state);
		}
		case RType.Access: {
			const accessed = termOf(node.accessed, scope, state, depth);
			if(accessed === undefined) {
				return undefined;
			}
			if(node.operator === '$' || node.operator === '@') {
				const [field] = node.access;
				const lexeme = field.value?.lexeme;
				return lexeme === undefined ? undefined : callTerm(node.info.id, node.operator, [{ value: accessed }, { value: { kind: 'constant', lexeme } }], state);
			}
			const args = argumentTerms(node.access, scope, state, depth);
			return args === undefined ? undefined : callTerm(node.info.id, node.operator, [{ value: accessed }, ...args], state);
		}
		case RType.Pipe: {
			const [lhs, rhs] = [termOf(node.lhs, scope, state, depth), termOf(node.rhs, scope, state, depth)];
			return lhs === undefined || !GuardTerm.isCall(rhs) ? undefined : { ...rhs, args: [{ value: lhs }, ...rhs.args] };
		}
		case RType.FunctionCall: {
			if(!RFunctionCall.isNamed(node)) {
				return undefined;
			}
			const vertex = callVertexOf(node.info.id, state);
			const seen = vertex === undefined ? undefined : inlined(node.info.id, vertex, scope, state, depth);
			if(seen !== undefined) {
				return seen;
			}
			/* a function of the body's own has no name a caller could call it by */
			if(Dataflow.origin(state.graph, node.info.id)?.some(o => o.type === OriginType.FunctionCallOrigin && scope.vertex.subflow.graph.has(o.id))) {
				return undefined;
			}
			const args = vertex !== undefined && CallProps.hasAny(state.info(vertex.name), ImpureProps) ? undefined : argumentTerms(node.arguments, scope, state, depth);
			if(args === undefined) {
				return undefined;
			}
			return callTerm(node.info.id, Identifier.toString(node.functionName.content), args, state);
		}
		default:
			return undefined;
	}
}

/** Whether a condition only computes on constants, as `is.numeric(1)`: true or not, no call can change that. */
function asksNothingOfCalls(this: void, term: GuardTerm, state: GuardState): boolean {
	return !GuardTerm.isFalse(term) && GuardTerm.formalsOf(term).size === 0 && !GuardTerm.readsFree(term) && isPureTerm(term, state) && !GuardTerm.mentions(term, 'exists');
}

function addClause(this: void, run: Run, path: Path, condition: GuardTerm, at: NodeId, extra: Partial<Pick<GuardClause, 'via' | 'message' | 'pure'>> & Pick<GuardClause, 'kind'>): void {
	/* what R rejects on a path that has already made sure of it, like `x > 0` after `is.numeric(x) &&`, asks nothing */
	const reached = path.flatMap(step => GuardTerm.conjuncts(step.holds));
	const rebound = run.rebound;
	if(run.scope.frameIsOpen || (extra.kind === 'implicit' && impliedBy(condition, reached, [...run.scope.formals.values()], run.state.facts))) {
		return;
	}
	/* walking on as if a branch was not taken only adds what speaks of what that branch rebinds */
	const since = rebound === undefined ? [] : [...path.slice(rebound.from).map(step => step.fails), condition];
	if(rebound !== undefined && !since.some(term => GuardTerm.formalsOf(term).values().some(f => rebound.formals.has(f)))) {
		return;
	}
	const all = GuardTerm.any(...path.map(step => step.fails), condition);
	const under = path.map(step => step.holds).filter(holds => !GuardTerm.isTrue(holds));
	for(const requires of GuardTerm.conjuncts(all)) {
		if(GuardTerm.isTrue(requires) || asksNothingOfCalls(requires, run.state)) {
			continue;
		}
		const rendered = GuardTerm.render(requires);
		const known = run.clauses.get(rendered);
		const pure = (extra.pure ?? true) && !run.effects;
		/* the same condition may come up again in a place that is purer than where it was seen first */
		if(known === undefined || (!known.pure && pure)) {
			run.clauses.set(rendered, { requires, rendered, at, ...extra, pure, ...(under.length > 0 ? { under } : {}) });
		}
	}
}

/** What continues after `exits` from code reached on `path`: `undefined` if nothing does. */
function afterExits(this: void, path: Path, exits: readonly Exit[]): Path | undefined {
	let next = path;
	for(const exit of exits) {
		const own = exit.path.slice(path.length);
		if(own.length === 0) {
			return undefined;
		} else if(exit.kind !== 'error') {
			/* a failure does not end in a normal return, so whoever asks about one knows it did not happen anyway */
			next = [...next, { holds: GuardTerm.any(...own.map(s => s.fails)), fails: GuardTerm.all(...own.map(s => s.holds)) }];
		}
	}
	return next;
}

/** Evaluates the nodes one after the other. */
function walkSequence(this: void, nodes: readonly RNodeWithParent[], path: Path, run: Run): Exit[] {
	const exits: Exit[] = [];
	let current = path;
	for(const [at, node] of nodes.entries()) {
		const here = walk(node, current, run);
		exits.push(...here);
		const next = afterExits(current, here);
		if(next === undefined) {
			break;
		}
		walkUnlessRebound(node, nodes.slice(at + 1), next, run);
		current = next;
	}
	return exits;
}

/**
 * After `if(c) x <- seq_len(x)` a read of `x` may see either value, so what follows says nothing of the formal `x`.
 * Unless `c` held, it still is the formal, so the rest is walked once more on that path, keeping only what speaks of the rebound formals.
 */
function walkUnlessRebound(this: void, node: RNodeWithParent, rest: readonly RNodeWithParent[], path: Path, run: Run): void {
	if((run.rebound?.depth ?? 0) >= MaxReboundDepth || rest.length === 0 || !RIfThenElse.is(node) || node.otherwise !== undefined) {
		return;
	}
	const { scope, state } = run;
	const definitions = RNode.collectAllIds(node.then).values().filter(id => DfgVertex.isVariableDefinition(state.graph.getVertex(id))).toArray();
	const formals = new Set(definitions.flatMap(id => {
		const name = NodeId.recoverBareName(id, state.graph.idMap);
		return name !== undefined && isFormalName(name, scope) ? [name] : [];
	}));
	const condition = termOf(node.condition, scope, state);
	if(formals.size === 0 || condition === undefined) {
		return;
	}
	const [, unless] = stepsOf(condition, state.facts);
	const { effects, rebound } = run;
	const added = definitions.filter(id => !scope.skips.has(id));
	added.forEach(id => scope.skips.add(id));
	run.rebound = rebound === undefined ? { formals, from: path.length + 1, depth: 1 } : { formals: rebound.formals.union(formals), from: rebound.from, depth: rebound.depth + 1 };
	walkSequence(rest, [...path, unless], run);
	run.rebound = rebound;
	added.forEach(id => scope.skips.delete(id));
	run.effects = effects;
}

/**
 * What may write to the frame of the function without that showing up as a definition once it runs or is defined: `e <- environment()`, `rm(x)`, or a closure with `x <<- v`.
 * A `<<-` right in the frame writes to the frames around it instead.
 */
function frameOpeners(this: void, definition: RFunctionDefinition<ParentInformation>, state: GuardState): Set<NodeId> {
	const openers = new Set<NodeId>();
	RNode.visitAst(definition.body, node => {
		const id = node.info.id;
		const vertex = callVertexOf(id, state);
		if(RFunctionDefinition.is(node)) {
			if(RNode.collectAllIds(node.body).values().some(inner => DfgVertex.hasOrigin(callVertexOf(inner, state), BuiltInProcName.SuperAssignment))) {
				openers.add(id);
			}
		} else if(vertex !== undefined && !RSymbol.is(node)) {
			const name = Identifier.getName(vertex.name);
			if(state.facts(name)?.opensFrame || CallProps.hasAny(state.info(vertex.name), SemanticCallTag.Frames) || assignsComputedName(name, vertex, state)) {
				openers.add(id);
			}
		}
	});
	return openers;
}

/** Whether an error may still end in a normal return, as `on.exit(return(1))` turns it into one, and `do.call(on.exit, .)` may. */
function mayReturnOnExit(this: void, definition: RFunctionDefinition<ParentInformation>): boolean {
	const callees = new Set<NodeId>();
	let found = false;
	RNode.visitAst(definition.body, node => {
		if(RFunctionCall.isNamed(node, 'on.exit')) {
			callees.add(node.functionName.info.id);
			found ||= node.arguments.some(a => a !== EmptyArgument && a.value !== undefined && hasSymbol(a.value, 'return'));
		} else if((RSymbol.is(node) && !callees.has(node.info.id) && Identifier.getName(node.content) === 'on.exit') || (RString.is(node) && node.content.str === 'on.exit')) {
			found = true;
		}
	});
	return found;
}

function hasSymbol(this: void, node: RNodeWithParent, name: string): boolean {
	let found = false;
	RNode.visitAst(node, n => {
		found ||= RSymbol.is(n) && Identifier.getName(n.content) === name;
	});
	return found;
}

/** `assign(paste0("a", i), v)` may bind any name at all. */
function assignsComputedName(this: void, name: BrandedIdentifier, vertex: DataflowGraphVertexFunctionCall, state: GuardState): boolean {
	if(name !== 'assign') {
		return false;
	}
	const [first] = vertex.args;
	return !FunctionArgument.isNotEmpty(first) || !RString.is(nodeOf(FunctionArgument.isNamed(first) && first.valueId !== undefined ? first.valueId : first.nodeId, state));
}

/** Code flowR does not follow, as it may run or not: all that is left is whether it can leave the function and what it may do. */
function skipped(this: void, node: RNodeWithParent, path: Path, run: Run): Exit[] {
	const { state } = run;
	const exits: Exit[] = [];
	const inner = RNode.collectAllIdsWithStop(node, n => RFunctionDefinition.is(n));
	for(const id of RNode.collectAllIds(node)) {
		run.scope.frameIsOpen ||= run.openers.has(id);
	}
	for(const id of inner) {
		const vertex = callVertexOf(id, state);
		/* a symbol handed to what applies it is only a call of what that does, which is its own concern */
		if(vertex === undefined || RSymbol.is(nodeOf(id, state))) {
			continue;
		}
		if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Return) || Identifier.getName(vertex.name) === 'return_from') {
			exits.push({ path: [...path, UnknownStep], kind: 'return' });
			returnsValue(undefined, path, run);
		}
		run.effects ||= !onlyComputes(id, vertex, state);
	}
	return exits;
}

/** Evaluates each branch from the state before the construct, as only one of them runs. */
function branches(this: void, run: Run, ...walks: readonly (() => Exit[])[]): Exit[] {
	const before = run.effects;
	let after = before;
	const exits = walks.flatMap(w => {
		run.effects = before;
		const found = w();
		after ||= run.effects;
		return found;
	});
	run.effects = after;
	return exits;
}

function stepsOf(this: void, term: GuardTerm | undefined, facts: GuardFactsLookup): readonly [PathStep, PathStep] {
	if(term === undefined) {
		return [UnknownStep, UnknownStep];
	}
	const [holds, fails] = [GuardTerm.truth(term, true, facts), GuardTerm.truth(term, false, facts)];
	return [{ holds, fails }, { holds: fails, fails: holds }];
}

/** The formal the given expression holds, directly or through a local. */
function formalOfNode(this: void, node: RNodeWithParent, run: Run): GuardTerm | undefined {
	const term = RType.Symbol === node.type ? termOf(node, run.scope, run.state) : undefined;
	return term?.kind === 'formal' ? term : undefined;
}

function walkIf(this: void, condNode: RNodeWithParent, then: RNodeWithParent, otherwise: RNodeWithParent | undefined, path: Path, run: Run, returnsNull: boolean): Exit[] {
	const before = walk(condNode, path, run);
	const atCondition = afterExits(path, before);
	if(atCondition === undefined) {
		return before;
	}
	const term = termOf(condNode, run.scope, run.state);
	conditionRequirement('if', condNode, atCondition, run);
	const [yes, no] = stepsOf(term, run.state.facts);
	if(returnsNull) {
		returnsValue(NullValue, [...atCondition, no], run);
	}
	return [
		...before,
		...branches(run,
			() => walk(then, [...atCondition, yes], run),
			() => otherwise === undefined ? [] : walk(otherwise, [...atCondition, no], run)
		)
	];
}

/** Each alternative of `switch(expr, a = ., b = .)`, reached if `expr` names it, or by position if it is a number, or as the default by a string naming none. */
function walkSwitch(this: void, node: RFunctionCall<ParentInformation>, path: Path, run: Run): Exit[] {
	const [selector, ...alternatives] = node.arguments;
	if(selector === EmptyArgument || selector?.value === undefined) {
		return skipped(node, path, run);
	}
	const before = walk(selector.value, path, run);
	const atSwitch = afterExits(path, before);
	if(atSwitch === undefined) {
		return before;
	}
	const term = termOf(selector.value, run.scope, run.state);
	const names = alternatives.flatMap(a => a === EmptyArgument || a.name === undefined ? [] : [GuardTerm.string(String(a.name.content))]);
	const notString = term === undefined ? GuardTerm.True : GuardTerm.known('!', GuardTerm.known('is.character', term));
	const isAny = (of: readonly GuardTerm[]) => term === undefined ? GuardTerm.True : GuardTerm.known('%in%', term, of.length === 1 ? of[0] : GuardTerm.known('c', ...of));
	let falling: GuardTerm[] = [];
	const walks = alternatives.map(alternative => () => {
		if(alternative === EmptyArgument) {
			return [];
		}
		const name = alternative.name === undefined ? undefined : GuardTerm.string(String(alternative.name.content));
		if(alternative.value === undefined) {
			falling = name === undefined ? falling : [...falling, name];
			return [];
		}
		const reachedBy = name === undefined ? undefined : [...falling, name];
		falling = [];
		const fails = reachedBy === undefined ? GuardTerm.any(notString, isAny(names))
			: GuardTerm.any(notString, GuardTerm.known('!', isAny(reachedBy)));
		return walk(alternative.value, [...atSwitch, { holds: GuardTerm.True, fails: names.length === 0 ? GuardTerm.True : fails }], run);
	});
	return [...before, ...branches(run, ...walks)];
}

/** The literal message a call like `stop("...")` raises. */
export function messageOf(this: void, node: RNodeWithParent | undefined): string | undefined {
	if(!RFunctionCall.is(node)) {
		return undefined;
	}
	const [first] = node.arguments;
	return first !== undefined && first !== EmptyArgument && first.name === undefined && RString.is(first.value) ? first.value.content.str : undefined;
}

/** A call of `stopifnot` or what is like it: every argument has to hold in turn. */
function walkConditions(this: void, conditions: readonly RNodeWithParent[], vector: boolean, path: Path, run: Run): Exit[] {
	const exits: Exit[] = [];
	let current = path;
	for(const expression of conditions) {
		const here = walk(expression, current, run);
		exits.push(...here);
		const next = afterExits(current, here);
		if(next === undefined) {
			return exits;
		}
		current = next;
		const term = termOf(expression, run.scope, run.state);
		if(term !== undefined) {
			/* `stopifnot("x must be positive" = x > 0)` */
			const named = vector ? RNode.directParent(expression, run.state.graph.idMap as AstIdMap) : undefined;
			const message = RArgument.is(named) ? named.name?.content : undefined;
			addClause(run, current, GuardTerm.truth(term, true, run.state.facts, vector), expression.info.id, { kind: 'explicit', ...(message === undefined ? {} : { message: String(message) }) });
		}
	}
	return exits;
}

function stopIfNotConditions(this: void, node: RFunctionCall<ParentInformation>): readonly RNodeWithParent[] | undefined {
	const conditions: RNodeWithParent[] = [];
	for(const arg of node.arguments) {
		if(arg === EmptyArgument || arg.value === undefined) {
			continue;
		}
		const name = arg.name?.content;
		if(name === 'exprs') {
			conditions.push(...(RExpressionList.is(arg.value) ? arg.value.children : [arg.value]));
		} else if(name === 'local' || name === 'exprObject') {
			return undefined;
		} else {
			conditions.push(arg.value);
		}
	}
	return conditions;
}

/** The arguments of a call, in order, each bound to the formal it fills. */
function boundArguments(this: void, vertex: DataflowGraphVertexFunctionCall, sig: FnSig | readonly BrandedIdentifier[], state: GuardState): Map<BrandedIdentifier, RNodeWithParent[]> {
	const names = sig.map(s => typeof s === 'string' ? s : s[0]);
	const bound = new Map<BrandedIdentifier, RNodeWithParent[]>();
	for(const [formal, ids] of MatchArgs.toSpec<BrandedIdentifier>(vertex.args, Object.fromEntries(names.map(n => [n, n])))) {
		bound.set(formal, ids.map(id => valueOfArgument(id, vertex, state)).filter(n => n !== undefined));
	}
	return bound;
}

/** The arguments handed over which R evaluates for sure, in the order they are written, and those it may not. */
function evaluatedAndNot(this: void, vertex: DataflowGraphVertexFunctionCall, state: GuardState): { readonly forced: RNodeWithParent[], readonly lazy: RNodeWithParent[] } {
	const sig = knownNameOf(vertex.id, vertex, state) === undefined ? undefined : state.info(vertex.name)?.sig;
	const values = vertex.args.filter(FunctionArgument.isNotEmpty).map(a => valueOfArgument(a.nodeId, vertex, state)).filter(n => n !== undefined);
	if(sig === undefined) {
		return { forced: [], lazy: values };
	}
	const bound = boundArguments(vertex, sig, state);
	/* a special primitive matching its arguments itself takes a missing formal handed to some of its own as not given */
	const missingOk = state.facts(Identifier.getName(vertex.name))?.missingOk ?? [];
	const forcedIds = new Set(sig.filter(([, props]) => (props & ArgProp.Forced) !== 0).flatMap(([formal]) => (bound.get(formal) ?? []).filter(v => !missingOk.includes(formal) || !RSymbol.is(v))));
	return { forced: values.filter(v => forcedIds.has(v)), lazy: values.filter(v => !forcedIds.has(v)) };
}

/** Notes that `of` has to pass each of the failures R raises by itself, `other` being the second operand of an operator. */
function addFailures(this: void, failures: readonly RFailure[], of: GuardTerm, at: NodeId, path: Path, run: Run, other?: GuardTerm): void {
	for(const failure of failures) {
		addClause(run, path, passes(failure, of, n => isDefined(n, run.state), other), at, { kind: 'implicit', message: messageFor(failure, of) });
	}
}

/** What `if` or `while` asks of a condition that is a formal. */
function conditionRequirement(this: void, construct: BrandedIdentifier, condNode: RNodeWithParent, path: Path, run: Run): void {
	const formal = formalOfNode(condNode, run);
	if(formal !== undefined) {
		addFailures(run.state.facts(construct)?.asks?.cond ?? [], formal, condNode.info.id, path, run);
	}
}

/** What the call of a built-in asks of what it was handed, on top of evaluating it. */
function builtInRequirements(this: void, name: BrandedIdentifier, vertex: DataflowGraphVertexFunctionCall, path: Path, run: Run): void {
	const { state, scope } = run;
	const asks = state.facts(name)?.asks;
	if(asks === undefined) {
		return;
	}
	const bound = boundArguments(vertex, state.info(vertex.name)?.sig?.map(([formal]) => formal) ?? Object.keys(asks), state);
	const termOfNode = (n: RNodeWithParent) => termOf(n, scope, state);
	/* an operator also dispatches on its other operand, which has to be stated to be ruled out */
	const operands = Object.keys(asks).length === 2 ? [...bound.values()].flat() : [];
	for(const [formal, failures] of Object.entries(asks)) {
		for(const value of bound.get(formal) ?? []) {
			const term = termOfNode(value);
			const otherNode = operands.find(o => o !== value);
			const other = otherNode === undefined ? undefined : termOfNode(otherNode);
			const stated = failures.filter(f => term !== undefined && (term.kind === 'formal' || asksCallable(f)) && (!f.dispatches || otherNode === undefined || other !== undefined));
			if(term !== undefined) {
				addFailures(stated, term, vertex.id, path, run, other);
			}
		}
	}
}

/** Whether a function of this name is around, no matter what a formal of that name holds. */
function isDefined(this: void, name: BrandedIdentifier, state: GuardState): boolean {
	return state.bindsFunction(name) || state.info(name) !== undefined;
}

/** A `get` of a name that is spelled out at run time: what it takes is for the name to exist. */
function getRequirement(this: void, node: RNodeWithParent, path: Path, run: Run): void {
	const term = termOf(node, run.scope, run.state);
	if(GuardTerm.isCall(term) && term.args.length > 0 && (composesName(term.args[0].value) || term.args[0].value.kind === 'formal')) {
		addClause(run, path, getAsExists({ ...term, fn: 'get' }), node.info.id, { kind: 'implicit' });
	}
}

/** A call flowR knows the failing of: `succeeds(check(x))`, with the choices `match.arg` takes from the default of the formal spelled out. */
function checkRequirement(this: void, name: BrandedIdentifier, node: RNodeWithParent, vertex: DataflowGraphVertexFunctionCall, path: Path, run: Run): void {
	const term = termOf(node, run.scope, run.state);
	const check = run.state.facts(name)?.check;
	if(check === undefined || !GuardTerm.isCall(term) || check.defers?.some(d => term.args.some(a => a.name === d))) {
		return;
	}
	const [first] = term.args;
	if(first === undefined) {
		return;
	}
	let call: GuardCall = term;
	if(check.choicesFromDefault && term.args.length === 1 && first.value.kind === 'formal') {
		const { name: formal } = first.value;
		const parameter = run.scope.definition.parameters.find(p => p.name.content === formal);
		const choices = parameter?.defaultValue === undefined ? undefined : termOf(parameter.defaultValue, run.scope, run.state);
		if(choices !== undefined) {
			call = { ...term, args: [first, { value: choices }] };
		}
	}
	addClause(run, path, succeeds(call), vertex.id, { kind: 'explicit' });
}

/** The contract of the callee turned into the words of the caller. */
function inherit(this: void, target: NodeId, vertex: DataflowGraphVertexFunctionCall, path: Path, run: Run): void {
	const { state, scope } = run;
	const contract = contractOf(target, state, viaCall(vertex.id, run));
	run.reach = Math.max(run.reach, contract.reach - 1);
	const callee = scopeOf(target, state);
	if(callee === undefined) {
		run.effects = true;
		return;
	}
	const besides = bindingBesidesDots(vertex, callee, scope, state);
	/* with every formal bound and no dots to take more, anything further the dots hand on is an error, so nothing can move */
	const binding = besides?.complete ? besides.binding : bindingOf(vertex, callee, scope, state, 0);
	/* a closure reads the formals of the function it is called from as well */
	const outer = (origin: NodeId) => {
		const name = scope.formals.get(origin);
		return name === undefined ? undefined : GuardTerm.formal(name);
	};
	const dotsUnnamed = leavesDotsUnnamed(vertex, callee, state);
	for(const clause of contract.clauses) {
		const inherited = { kind: clause.kind, pure: clause.pure, via: [vertex.id, ...clause.via ?? []], ...(clause.message === undefined ? {} : { message: clause.message }) };
		const asked = dotsUnnamed ? GuardTerm.any(...GuardTerm.disjuncts(clause.requires).filter(d => GuardTerm.render(d) !== DotsBearNamesText)) : clause.requires;
		const requires = GuardTerm.substituteCondition(asked, binding, outer, state.facts);
		if(GuardTerm.formalsOf(requires).size > 0 || GuardTerm.isFalse(requires)) {
			addClause(run, path, requires, clause.at, inherited);
		}
		if(besides !== undefined && !besides.complete) {
			const unlessNamed = GuardTerm.substituteCondition(asked, besides.binding, outer, state.facts);
			if(GuardTerm.formalsOf(unlessNamed).size > 0 && GuardTerm.render(unlessNamed) !== GuardTerm.render(requires)) {
				addClause(run, path, GuardTerm.any(DotsBearNames, unlessNamed), clause.at, inherited);
			}
		}
	}
	if(path.length === 0) {
		for(const formal of contract.required) {
			const bound = binding.get(formal);
			if(bound?.kind === 'formal') {
				run.read.add(bound.name);
			}
		}
	}
	run.effects ||= contract.effects;
	scope.frameIsOpen ||= contract.opens;
}

/** The function definitions the program binds the name to, `undefined` if it may bind it to anything else. */
function definitionsNamed(this: void, name: BrandedIdentifier, state: GuardState): NodeId[] | undefined {
	const found: NodeId[] = [];
	for(const id of state.bindings.get(name)) {
		const behind = definitionsBehind(id, state.graph);
		if(behind.size === 0) {
			return undefined;
		}
		found.push(...behind);
	}
	return found;
}

/** The methods of the generic a value without a class attribute may run, found by their names, `undefined` if one of them may come from outside the program. */
function unclassedMethods(this: void, generic: string, state: GuardState): NodeId[] | undefined {
	const methods: NodeId[] = [];
	for(const cls of [...ImplicitClasses, 'default']) {
		const name = `${generic}.${cls}`;
		const own = definitionsNamed(name, state);
		if(own === undefined || (own.length === 0 && (state.info(name) !== undefined || baseRExportOwner(name) !== undefined))) {
			return undefined;
		}
		methods.push(...own);
	}
	return methods;
}

/** Whether the dispatch rules out methods for the classes every call of the program hands it, which it only knows if it knows those classes. */
function knowsClasses(this: void, dispatch: DataflowGraphVertexFunctionCall | undefined): boolean {
	return dispatch?.ruledOut !== undefined && (DfgVertex.hasOrigin(dispatch, BuiltInProcName.S3Dispatch) || DfgVertex.hasOrigin(dispatch, BuiltInProcName.S3DispatchNext));
}

/** How many calls deep the narrowing of the dispatch per call goes, see {@link Contract.reach}: one for a `NextMethod`, which the dispatch running its method may decide. */
function reachOf(this: void, dispatch: DataflowGraphVertexFunctionCall): number {
	const depth = (perCall: readonly CallRuledOut[] | undefined): number => perCall === undefined ? 0 : 1 + Math.max(0, ...perCall.map(p => depth(p.within)));
	return Math.max(depth(dispatch.ruledOutAt), DfgVertex.hasOrigin(dispatch, BuiltInProcName.S3DispatchNext) ? 1 : 0);
}

/**
 * The methods a dispatch runs when the calls `via` ran the function holding it, if that is decided: by its narrowing per call (see {@link DataflowGraphVertexFunctionCall.ruledOutAt}),
 * or as a known call of the program reaches it while the dispatch, or the one that ran the method holding a `NextMethod`, knows the classes of every call.
 */
function decidedMethods(this: void, dispatch: DataflowGraphVertexFunctionCall, via: readonly NodeId[], state: GuardState): NodeId[] | undefined {
	const ruledOut = new Set<NodeId>();
	let decided = via.length > 0 && (knowsClasses(dispatch) || knowsClasses(callVertexOf(via[0], state)));
	let level = dispatch.ruledOutAt;
	for(const call of via) {
		const at = level?.find(p => p.call === call);
		if(at === undefined) {
			break;
		}
		at.methods.forEach(m => ruledOut.add(m));
		decided ||= at.within === undefined;
		level = at.within;
	}
	return decided ? (Dataflow.origin(state.graph, dispatch.id) ?? []).filter(o => o.type === OriginType.FunctionCallOrigin && !ruledOut.has(o.id)).map(o => o.id) : undefined;
}

/** The formals a function rebinds anywhere, which `NextMethod` hands on with the value they have by then. */
function reboundFormals(this: void, scope: Scope, state: GuardState): Set<BrandedIdentifier> {
	return new Set(scope.vertex.subflow.graph.values().flatMap(id => {
		const name = DfgVertex.isVariableDefinition(state.graph.getVertex(id)) && !scope.formals.has(id) ? NodeId.recoverBareName(id, state.graph.idMap) : undefined;
		return name !== undefined && isFormalName(name, scope) ? [name] : [];
	}));
}

/** What a method run by dispatch binds its formals to: the arguments are matched anew, so only the formals both share in front, by name and a literal default, stand for the same value, unless the dispatching function changed them. */
function dispatchBinding(this: void, from: Scope, to: Scope, changed: ReadonlySet<BrandedIdentifier>): GuardBinding {
	const binding = new Map<BrandedIdentifier, GuardTerm>();
	const [mine, theirs] = [from.definition.parameters, to.definition.parameters];
	for(let at = 0; at < Math.min(mine.length, theirs.length); at++) {
		const [a, b] = [mine[at], theirs[at]];
		const literal = a.defaultValue === undefined || RConstant.is(a.defaultValue);
		if(a.special || b.special || a.name.content !== b.name.content || !literal || RNode.lexeme(a.defaultValue) !== RNode.lexeme(b.defaultValue)) {
			break;
		} else if(!changed.has(a.name.content)) {
			binding.set(b.name.content, GuardTerm.formal(a.name.content));
		}
	}
	return binding;
}

/** How many alternatives {@link joined} spells out before it keeps only what all methods share. */
const MaxJoined = 64;

/** What holds whichever of the methods ran, given the clauses of each: one clause of each as alternatives, or, as those grow fast, the clauses all of them share. */
function joined(this: void, of: readonly (readonly GuardClause[])[]): GuardClause[] {
	if(of.reduce((n, clauses) => n * clauses.length, 1) <= MaxJoined) {
		return of.slice(1).reduce<GuardClause[]>((acc, clauses) => acc.flatMap(a => clauses.map(c => ({ ...a, requires: GuardTerm.any(a.requires, c.requires), pure: a.pure && c.pure }))), [...of[0]]);
	}
	const shared = of.slice(1).map(clauses => new Set(clauses.map(c => GuardTerm.render(c.requires))));
	return of[0].filter(c => shared.every(s => s.has(GuardTerm.render(c.requires))));
}

/** Adds what the given methods ask, run for the calls `via`, as their callee sees it through the bindings, unless `unless` holds. */
function addMethodContracts(this: void, methods: readonly NodeId[], bindingOfMethod: (callee: Scope) => GuardBinding, at: NodeId, via: readonly NodeId[], unless: readonly GuardTerm[], path: Path, run: Run): void {
	const { state } = run;
	const contracts = methods.map(method => {
		const callee = scopeOf(method, state);
		const binding = callee === undefined ? undefined : bindingOfMethod(callee);
		return binding === undefined ? [] : contractOf(method, state, via).clauses.map(clause => ({ ...clause, requires: GuardTerm.substituteCondition(clause.requires, binding, undefined, state.facts) }));
	});
	if(contracts.length === 0) {
		return;
	}
	for(const clause of joined(contracts)) {
		const requires = GuardTerm.any(...unless, clause.requires);
		if(GuardTerm.formalsOf(clause.requires).size > 0 || GuardTerm.isFalse(clause.requires)) {
			addClause(run, path, requires, clause.at, { kind: clause.kind, pure: clause.pure, via: [at, ...clause.via ?? []], ...(clause.message === undefined ? {} : { message: clause.message }) });
		}
	}
}

/** The calls through which a callee of the current function runs, the innermost first. */
function viaCall(this: void, call: NodeId, run: Run): NodeId[] {
	return [call, ...run.via].slice(0, MaxContextDepth);
}

/**
 * What the methods a `UseMethod` or `NextMethod` runs ask: the methods its narrowing decides for the calls the
 * function runs for, or else, for a `UseMethod` on the formal `object` without a class attribute, the methods found by name.
 */
function dispatchedContracts(this: void, node: RFunctionCall<ParentInformation>, dispatch: DataflowGraphVertexFunctionCall | undefined, unclassed: { readonly object: BrandedIdentifier, readonly generic: string } | undefined, path: Path, run: Run): void {
	const { state, scope } = run;
	run.reach = Math.max(run.reach, dispatch === undefined ? 0 : reachOf(dispatch));
	run.called ||= knowsClasses(dispatch);
	const decided = dispatch === undefined ? undefined : decidedMethods(dispatch, run.via, state);
	const methods = decided ?? (unclassed === undefined ? undefined : unclassedMethods(unclassed.generic, state));
	if(methods === undefined || methods.length === 0) {
		return;
	}
	const changed = unclassed === undefined ? reboundFormals(scope, state) : new Set<BrandedIdentifier>();
	const unless = decided !== undefined || unclassed === undefined ? [] : [GuardTerm.known('is.object', GuardTerm.formal(unclassed.object))];
	addMethodContracts(methods, callee => dispatchBinding(scope, callee, changed), node.info.id, dispatch === undefined ? [] : viaCall(dispatch.id, run), unless, path, run);
}

/** What flowR can say about the `UseMethod` of the function: it has to find a method, and what that asks. */
function dispatchRequirement(this: void, node: RFunctionCall<ParentInformation>, path: Path, run: Run): void {
	const { state, scope } = run;
	const [generic, object] = node.arguments;
	const value = generic === EmptyArgument ? undefined : generic?.value;
	/* flowR turns a name standing for the generic into the dispatching call itself, which leaves nothing to read */
	const named = RSymbol.is(value) ? onceBoundLiteral(Identifier.getName(value.content), scope, state, 0) : undefined;
	const name = value === undefined ? undefined : GuardTerm.constantString(named ?? termOf(value, scope, state));
	const [first] = scope.definition.parameters;
	const given = object === undefined || object === EmptyArgument || object.value === undefined ? undefined : termOf(object.value, scope, state);
	const dispatched = object === undefined ? (first === undefined || first.special ? undefined : first.name.content) : given?.kind === 'formal' ? given.name : undefined;
	const dispatch = value === undefined ? undefined : callVertexOf(value.info.id, state);
	dispatchedContracts(node, DfgVertex.hasOrigin(dispatch, BuiltInProcName.S3Dispatch) ? dispatch : undefined, name === undefined || dispatched === undefined ? undefined : { object: dispatched, generic: name }, path, run);
	if(name === undefined || first === undefined || first.special || state.bindsFunction(`${name}.default`) || state.info(`${name}.default`) !== undefined) {
		return;
	}
	const call: GuardCall = { kind: 'call', fn: 'UseMethod', known: true, args: [{ value: GuardTerm.string(name) }, { value: GuardTerm.formal(first.name.content) }] };
	addClause(run, path, succeeds(call), node.info.id, { kind: 'implicit' });
}

/** The S4 methods of the program by generic, found once per run. */
function s4MethodsIn(this: void, state: GuardState): ReadonlyMap<BrandedIdentifier, readonly S4Method[]> {
	return state.s4 ??= s4MethodsOf(state.graph, ids => linkedFunctionIds(ids, state.graph));
}

/**
 * What the methods of the program for an operator or a member of a group generic ask, each for the operands that run it for sure:
 * an S3 method of a class for an operand of exactly that class next to one without a class, the one S4 method for operands of its signature, one of them an S4 object.
 */
function operatorMethods(this: void, name: BrandedIdentifier, vertex: DataflowGraphVertexFunctionCall, path: Path, run: Run): void {
	const { state, scope } = run;
	const group = s3GroupGenericOf(name);
	const s4 = group === undefined ? undefined : s4CandidatesFor(name, s4MethodsIn(state));
	const operands = vertex.args.filter(FunctionArgument.isNotEmpty).map(a => valueOfArgument(a.nodeId, vertex, state)).map(n => n === undefined ? undefined : termOf(n, scope, state));
	if(group === undefined || s4 === undefined || operands.length === 0 || operands.length > 2 || operands.includes(undefined)) {
		return;
	}
	const terms = operands as GuardTerm[];
	const bound = (callee: Scope) => bindingOf(vertex, callee, scope, state, 0);
	const unclassed = (others: readonly GuardTerm[]) => others.filter(o => o.kind !== 'constant').map(o => GuardTerm.known('is.object', o));
	const classes = new Set([...state.methodClasses(name), ...state.methodClasses(group)]);
	if(s4.length === 0) {
		for(const cls of classes) {
			const own = definitionsNamed(`${name}.${cls}`, state);
			const methods = own === undefined || own.length > 0 ? own : definitionsNamed(`${group}.${cls}`, state);
			/* only the operators dispatch on both operands, the other groups on what comes first */
			for(const [at, operand] of (group === 'Ops' ? terms : terms.slice(0, 1)).entries()) {
				if(operand.kind === 'constant') {
					continue;
				}
				const notOfClass = GuardTerm.known('!', GuardTerm.known('identical', GuardTerm.known('oldClass', operand), GuardTerm.string(cls)));
				addMethodContracts(methods ?? [], bound, vertex.id, [], [notOfClass, ...group === 'Ops' ? unclassed(terms.filter((_, i) => i !== at)) : []], path, run);
			}
		}
	} else if(s4.length === 1 && classes.size === 0 && s4[0].signature !== undefined && s4[0].signature.length <= terms.length && s4[0].signature.every(e => e.name === undefined && e.cls !== 'missing')) {
		const notS4 = GuardTerm.all(...terms.map(t => GuardTerm.known('!', GuardTerm.known('isS4', t))));
		const notOf = s4[0].signature.flatMap((e, at) => e.cls === 'ANY' ? [] : [GuardTerm.known('!', GuardTerm.known('is', terms[at], GuardTerm.string(String(e.cls))))]);
		addMethodContracts(s4[0].functions, bound, vertex.id, [], [notS4, ...notOf], path, run);
	}
}

function skippedArgument(this: void, argument: NodeId, vertex: DataflowGraphVertexFunctionCall, path: Path, run: Run): Exit[] {
	const value = valueOfArgument(argument, vertex, run.state);
	return value === undefined ? [] : skipped(value, path, run);
}

function walkCall(this: void, node: RNodeWithParent, path: Path, run: Run): Exit[] {
	const { state } = run;
	const id = node.info.id;
	const vertex = callVertexOf(id, state);
	if(vertex === undefined) {
		return skipped(node, path, run);
	}
	const call = RFunctionCall.is(node) ? node : undefined;
	if(call !== undefined && runsBuiltIn(vertex, BuiltInProcName.Stop)) {
		const before = walkSequence(evaluatedAndNot(vertex, state).forced, path, run);
		addClause(run, path, GuardTerm.False, id, { kind: 'explicit', ...(messageOf(node) === undefined ? {} : { message: messageOf(node) }) });
		return [...before, { path, kind: 'error' }];
	} else if(call !== undefined && runsBuiltIn(vertex, BuiltInProcName.StopIfNot)) {
		const asserting = state.facts(Identifier.getName(vertex.name))?.asserts;
		const conditions = asserting === undefined ? stopIfNotConditions(call) : call.arguments.flatMap(a => a === EmptyArgument || a.value === undefined || asserting.includes(a.name?.content ?? '') ? [] : [a.value]);
		return conditions === undefined ? skipped(node, path, run) : walkConditions(conditions, asserting === undefined, path, run);
	} else if(call !== undefined && runsBuiltIn(vertex, BuiltInProcName.Return)) {
		const [value] = call.arguments;
		const returned = value === undefined || value === EmptyArgument ? undefined : value.value;
		const before = returned === undefined ? [] : walk(returned, path, run);
		const after = afterExits(path, before);
		if(after !== undefined) {
			returnsValue(returned === undefined ? NullValue : termOf(returned, run.scope, run.state), after, run);
		}
		return [...before, { path, kind: 'return' }];
	} else if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Try) || DfgVertex.hasOrigin(vertex, BuiltInProcName.Return) || runsBuiltIn(vertex, BuiltInProcName.Local)) {
		/* a `return` that may be one of the program's own may still be the one of R */
		return skipped(node, path, run);
	}
	const name = knownNameOf(id, vertex, state);
	if(call !== undefined && name === 'switch') {
		return walkSwitch(call, path, run);
	} else if(call !== undefined && name === 'UseMethod') {
		dispatchRequirement(call, path, run);
		/* whichever method it finds, flowR does not know what that does */
		run.effects = true;
		returnsValue(undefined, path, run);
		return [{ path, kind: 'return' }];
	}
	if(call !== undefined && !RFunctionCall.isNamed(call)) {
		const before = walk(call.calledFunction, path, run);
		run.effects = true;
		return [...before, ...vertex.args.filter(FunctionArgument.isNotEmpty).flatMap(a => skippedArgument(a.nodeId, vertex, path, run))];
	}
	const target = soleCallee(id, state);
	const { forced, lazy } = target === undefined ? evaluatedAndNot(vertex, state) : { forced: [], lazy: vertex.args.filter(FunctionArgument.isNotEmpty).map(a => valueOfArgument(a.nodeId, vertex, state)).filter(n => n !== undefined) };
	const exits = [...lazy.flatMap(value => skipped(value, path, run)), ...walkSequence(forced, path, run)];
	const after = afterExits(path, exits);
	if(after === undefined) {
		return exits;
	}
	if(target !== undefined) {
		inherit(target, vertex, after, run);
		return exits;
	}
	if(call !== undefined && RFunctionCall.isNamed(call) && name === undefined) {
		calledFormal(call, after, run);
	}
	if(name !== undefined) {
		if(name === 'NextMethod' && call !== undefined) {
			dispatchedContracts(call, DfgVertex.hasOrigin(vertex, BuiltInProcName.S3DispatchNext) ? vertex : undefined, undefined, after, run);
		}
		operatorMethods(name, vertex, after, run);
		builtInRequirements(name, vertex, after, run);
		if(name === 'get') {
			getRequirement(node, after, run);
		} else if(state.facts(name)?.check !== undefined) {
			checkRequirement(name, node, vertex, after, run);
		}
	}
	run.effects ||= !onlyComputes(id, vertex, state);
	return exits;
}

/** `FUN(x)` for a formal `FUN`: a formal not holding a function makes R look for a function of the same name. */
function calledFormal(this: void, call: RFunctionCall<ParentInformation> & { readonly named: true }, path: Path, run: Run): void {
	const { state, scope } = run;
	const reads = Dataflow.origin(state.graph, call.info.id)?.filter(o => o.type === OriginType.ReadVariableOrigin) ?? [];
	const formal = reads.length === 1 ? scope.formals.get(reads[0].id) : undefined;
	if(formal !== undefined && formal === Identifier.getName(call.functionName.content)) {
		addClause(run, path, callable(GuardTerm.formal(formal), n => isDefined(n, state), false), call.info.id, { kind: 'implicit' });
	}
}

/** A body that may run any number of times, so nothing is known about what in there runs, and the `break`s and `next`s stay in there. */
function walkLoopBody(this: void, body: RNodeWithParent, path: Path, run: Run): Exit[] {
	return walk(body, [...path, UnknownStep], run).filter(e => e.kind !== 'loop');
}

/** Walks the node in the order R evaluates it, reports what it requires, and answers how it can be left early. */
function walk(this: void, node: RNodeWithParent, path: Path, run: Run): Exit[] {
	const exits = walkNode(node, path, run);
	const after = run.tails.get(node.info.id) === Tail.Value ? afterExits(path, exits) : undefined;
	if(after !== undefined) {
		returnsValue(termOf(node, run.scope, run.state), after, run);
	}
	return exits;
}

/** How a node at the end of the body gives the value of a normal return: as its own value, or as `NULL` for an `if` without an `else` that is not taken. */
const enum Tail {
	Value,
	Elseless
}

/** The nodes R returns the value of on reaching the end of the body, as far as {@link walk} goes into them. */
function markTails(this: void, node: RNodeWithParent, state: GuardState, tails: Map<NodeId, Tail>): void {
	const vertex = callVertexOf(node.info.id, state);
	if(RExpressionList.is(node) && node.children.length > 0 && (vertex === undefined || !mayRunOwn(node.info.id, vertex, state))) {
		markTails(node.children[node.children.length - 1], state, tails);
	} else if(RIfThenElse.is(node) && runsBuiltIn(vertex, BuiltInProcName.IfThenElse)) {
		markTails(node.then, state, tails);
		if(node.otherwise === undefined) {
			tails.set(node.info.id, Tail.Elseless);
		} else {
			markTails(node.otherwise, state, tails);
		}
	} else {
		tails.set(node.info.id, Tail.Value);
	}
}

const NullValue: GuardConstant = { kind: 'constant', lexeme: 'NULL' };

/** Notes a normal return with its value, which is `undefined` if flowR cannot state it. */
function returnsValue(this: void, value: GuardTerm | undefined, path: Path, run: Run): void {
	/* walking on as if a branch was not taken sees the same returns once more */
	if(run.rebound === undefined) {
		run.returned.push({ value, holds: path.map(step => step.holds) });
	}
}

function walkNode(this: void, node: RNodeWithParent, path: Path, run: Run): Exit[] {
	run.scope.frameIsOpen ||= run.openers.has(node.info.id);
	switch(node.type) {
		case RType.ExpressionList: {
			/* a `(` or `{` of the program's own may not evaluate what it holds */
			const vertex = callVertexOf(node.info.id, run.state);
			return vertex !== undefined && mayRunOwn(node.info.id, vertex, run.state) ? skipped(node, path, run) : walkSequence(node.children, path, run);
		}
		case RType.Argument:
			return node.value === undefined ? [] : walk(node.value, path, run);
		case RType.Symbol:
			if(path.length === 0) {
				const read = termOf(node, run.scope, run.state);
				if(read?.kind === 'formal') {
					run.read.add(read.name);
				}
			}
			return [];
		case RType.FunctionDefinition:
		case RType.Number:
		case RType.String:
		case RType.Logical:
		case RType.Comment:
		case RType.LineDirective:
			return [];
		case RType.IfThenElse:
			return runsBuiltIn(callVertexOf(node.info.id, run.state), BuiltInProcName.IfThenElse) ? walkIf(node.condition, node.then, node.otherwise, path, run, run.tails.get(node.info.id) === Tail.Elseless) : skipped(node, path, run);
		case RType.ForLoop:
			return [...walk(node.vector, path, run), ...walkLoopBody(node.body, path, run)];
		case RType.WhileLoop:
			return walkWhile(node, path, run);
		case RType.RepeatLoop:
			return walkLoopBody(node.body, path, run);
		case RType.Break:
		case RType.Next:
			return [{ path, kind: 'loop' }];
		case RType.BinaryOp:
			if((node.operator === '&&' || node.operator === '||') && knownNameOf(node.info.id, callVertexOf(node.info.id, run.state) as DataflowGraphVertexFunctionCall, run.state) !== undefined) {
				return walkShortCircuit(node.operator, node.lhs, node.rhs, path, run);
			}
			return walkCall(node, path, run);
		case RType.Pipe:
		case RType.FunctionCall:
		case RType.UnaryOp:
		case RType.Access:
			return walkCall(node, path, run);
		default:
			return skipped(node, path, run);
	}
}

function walkWhile(this: void, node: RWhileLoop<ParentInformation>, path: Path, run: Run): Exit[] {
	const before = walk(node.condition, path, run);
	const atCondition = afterExits(path, before);
	if(atCondition !== undefined && runsBuiltIn(callVertexOf(node.info.id, run.state), BuiltInProcName.WhileLoop)) {
		conditionRequirement('while', node.condition, atCondition, run);
	}
	return [...before, ...walkLoopBody(node.body, path, run)];
}

function walkShortCircuit(this: void, operator: '&&' | '||', lhs: RNodeWithParent, rhs: RNodeWithParent, path: Path, run: Run): Exit[] {
	const before = walk(lhs, path, run);
	const atRight = afterExits(path, before);
	if(atRight === undefined) {
		return before;
	}
	const left = termOf(lhs, run.scope, run.state);
	const operand = (formal: BrandedIdentifier) => run.state.facts(operator)?.asks?.[formal] ?? [];
	if(left?.kind === 'formal') {
		addFailures(operand('x'), left, lhs.info.id, atRight, run);
	}
	const [yes, no] = stepsOf(left, run.state.facts);
	const rightPath = [...atRight, operator === '&&' ? yes : no];
	const right = termOf(rhs, run.scope, run.state);
	const after = branches(run, () => walk(rhs, rightPath, run), () => []);
	if(right?.kind === 'formal') {
		addFailures(operand('y'), right, rhs.info.id, rightPath, run);
	}
	return [...before, ...after];
}

/** Takes out of a clause what another one rules out: `is.null(x) || is.numeric(x)` is `is.numeric(x)` once `!is.null(x)` holds, as code reads `if(is.null(x)) stop() else if(!is.numeric(x)) stop()`. */
function withUnitsApplied(this: void, clauses: readonly GuardClause[], facts: GuardFactsLookup): GuardClause[] {
	const isUnit = (term: GuardTerm) => !GuardTerm.isCall(term, '||');
	const units = new Set(clauses.filter(c => isUnit(c.requires)).map(c => GuardTerm.render(GuardTerm.truth(c.requires, false, facts))));
	const applied = clauses.map(clause => {
		if(isUnit(clause.requires)) {
			return clause;
		}
		const requires = GuardTerm.any(...GuardTerm.disjuncts(clause.requires).filter(d => !units.has(GuardTerm.render(d))));
		return { ...clause, requires, rendered: GuardTerm.render(requires) };
	});
	/* of `a` and `a || b`, the former says it all */
	const alternatives = applied.map(c => new Set(GuardTerm.disjuncts(c.requires).map(d => GuardTerm.render(d))));
	return applied.filter((_, at) => !alternatives.some((other, i) => i !== at && other.size < alternatives[at].size && other.isSubsetOf(alternatives[at])));
}

/** The clause that two give together, as {@link GuardTerm.resolved} found. */
function mergeClauses(this: void, a: GuardClause, b: GuardClause, requires: GuardTerm): GuardClause {
	return { ...a, requires, rendered: GuardTerm.render(requires), pure: a.pure && b.pure, kind: a.kind === 'explicit' || b.kind === 'explicit' ? 'explicit' : 'implicit' };
}

/** The clauses without what R asks for that the function checked already, which adds nothing: `x > 0` needs no function to be ruled out after `is.numeric(x)`. */
function withoutImplied(this: void, clauses: readonly GuardClause[], scope: Scope, facts: GuardFactsLookup): GuardClause[] {
	const explicit = clauses.filter(c => c.kind === 'explicit').map(c => c.requires);
	const formals = [...scope.formals.values()];
	return clauses.filter(c => c.kind === 'explicit' || !impliedBy(c.requires, explicit, formals, facts));
}

/** The formals the condition asks to be there, as `!missing(x)` does, whether or not they come with a default. */
function demandsPresenceOf(this: void, condition: GuardTerm, facts: GuardFactsLookup): BrandedIdentifier[] {
	if(!GuardTerm.isCall(condition) || !condition.known || (condition.fn !== '!' && condition.fn !== 'succeeds')) {
		return [];
	}
	const [{ value: inner }] = condition.args;
	const asked = GuardTerm.isCall(inner) && (condition.fn === '!' ? inner.fn === 'missing' : facts(GuardTerm.bareName(inner.fn))?.check?.present) ? inner.args[0]?.value : undefined;
	return asked?.kind === 'formal' ? [asked.name] : [];
}

/** What the given definition asks of its calls, for the calls `via` that run it if a dispatch within decides more for them, the innermost first. */
function contractOf(this: void, id: NodeId, state: GuardState, via: readonly NodeId[] = []): Contract {
	const free = via.length === 0 ? undefined : contractOf(id, state);
	if(free !== undefined && free.reach === 0 && !free.called) {
		return free;
	}
	/* what any known call decides alike is worked out once */
	const reach = free === undefined ? 0 : Math.max(free.reach, 1);
	const key = free === undefined ? String(id) : `${id}@${via.slice(0, free.reach).join(',')}`;
	const known = state.contracts.get(key);
	if(known !== undefined) {
		return known;
	}
	const scope = state.depth > MaxCalleeDepth ? undefined : scopeOf(id, state);
	if(scope === undefined || mayReturnOnExit(scope.definition)) {
		return NoContract;
	}
	/* a recursive call counts for nothing, which only ever leaves out what the recursion could have added */
	state.contracts.set(key, NoContract);
	state.depth++;
	const tails = new Map<NodeId, Tail>();
	markTails(scope.definition.body, state, tails);
	const run: Run = { scope, state, clauses: new Map(), read: new Set(), openers: frameOpeners(scope.definition, state), tails, returned: [], via: via.slice(0, reach), reach: 0, called: false, effects: false };
	/* a default is evaluated on first read, wherever that is: one with a side effect leaves nothing clean */
	for(const { defaultValue } of scope.definition.parameters) {
		if(defaultValue !== undefined) {
			skipped(defaultValue, [], run);
		}
	}
	walk(scope.definition.body, [], run);
	state.depth--;
	const demanded = new Set([...run.clauses.values()].flatMap(c => demandsPresenceOf(c.requires, state.facts)));
	const contract: Contract = {
		clauses:  withoutImplied(GuardTerm.resolved(withUnitsApplied([...run.clauses.values()], state.facts), c => c.requires, mergeClauses), scope, state.facts),
		required: scope.definition.parameters.filter(p => demanded.has(p.name.content) || (p.defaultValue === undefined && run.read.has(p.name.content))).map(p => p.name.content),
		effects:  run.effects,
		opens:    scope.frameIsOpen,
		returned: run.returned,
		reach:    run.reach,
		called:   run.called
	};
	state.contracts.set(key, contract);
	return contract;
}

function stateOf(this: void, graph: DataflowGraph, { ctx }: FunctionGuardsOptions): GuardState {
	const bindings = Dataflow.definitionsByName(graph);
	const bindsFunction = memoize((name: BrandedIdentifier) => bindings.get(name).some(id => definitionsBehind(id, graph).size > 0));
	const methodClasses = memoize((generic: BrandedIdentifier) => [...bindings.keys()].flatMap(fn => fn.startsWith(`${generic}.`) && bindsFunction(fn) ? [fn.slice(generic.length + 1)] : []));
	return { graph, info: builtInLookup(ctx), facts: ctx === undefined ? defaultGuardFacts() : guardFactsIn(ctx.env.builtInDefinitions, ctx.rVersionKnown ? ctx.resolvedRVersion : undefined), contracts: new Map(), terms: new Map(), bindings, bindsFunction, methodClasses, depth: 0 };
}

/** The claims with the cases of each formal. */
function withCases(this: void, claims: Readonly<Record<BrandedIdentifier, FormalClaim>>, cases: Readonly<Record<BrandedIdentifier, readonly FormalCase[]>>): Record<BrandedIdentifier, FormalClaim> {
	return { ...claims, ...Object.fromEntries(Object.entries(cases).map(([formal, of]) => [formal, { ...claims[formal], cases: of }])) };
}

/** The claims with what the program offers for the names they need. */
function withCandidates(this: void, claims: Readonly<Record<BrandedIdentifier, FormalClaim>>, state: GuardState): Record<BrandedIdentifier, FormalClaim> {
	const fill = (name: ClaimedName): ClaimedName => {
		const { prefix, suffix } = name;
		if(prefix === undefined && suffix === undefined) {
			return name;
		}
		const [start, end] = [prefix ?? '', suffix ?? ''];
		const candidates = [...state.bindings.keys()]
			.filter(fn => fn.length > start.length + end.length && fn.startsWith(start) && fn.endsWith(end) && state.bindsFunction(fn))
			.map(fn => fn.slice(start.length, fn.length - end.length));
		return candidates.length === 0 ? name : { ...name, candidates };
	};
	return Object.fromEntries(Object.entries(claims).map(([formal, claim]) => [formal, claim.resolves === undefined ? claim : { ...claim, resolves: claim.resolves.map(fill) }]));
}

/**
 * What each of the `definitions` asks of the calls it returns from, a *necessary* condition: a call that returns normally
 * has passed all of it, with the formals standing for the values they hold at the guard.
 * Whatever flowR cannot state with certainty is left out rather than guessed, so it only ever claims too little.
 * What is out of reach is what code flowR does not see does to the frame of the function (like `sys.function`-based writes), and an S3 method of `is.numeric` or `length` breaking their contract.
 * @useInstead {@link FunctionSemantics.guards}
 */
export function guardsOfFunctions(this: void, definitions: readonly NodeId[], graph: DataflowGraph, options: FunctionGuardsOptions = {}): Record<NodeId, FunctionGuards> {
	const state = stateOf(graph, options);
	const result: Record<NodeId, FunctionGuards> = {};
	for(const id of definitions) {
		const scope = scopeOf(id, state);
		if(scope === undefined) {
			continue;
		}
		const { clauses, required, returned } = contractOf(id, state);
		const returns = returnsOf(returned, clauses.map(c => c.requires), state.facts);
		const passes = returnedFormalOf(returned, state.facts);
		result[id] = {
			clauses,
			formals:     withCases(withCandidates(claimsOf(clauses.map(c => c.requires), [...scope.formals.values()], state.facts), state), casesOf(clauses, [...scope.formals.values()], state.facts)),
			conditions:  conditionsPerFormal(clauses),
			relations:   relationsOf(clauses.map(c => c.requires), state.facts),
			conditional: conditionalClaimsOf(clauses.map(c => c.requires), [...scope.formals.values()], state.facts),
			required,
			...summarizeClauses(clauses),
			...(returns === undefined ? {} : { returns }),
			...(passes === undefined ? {} : { passes })
		};
	}
	return result;
}

/** The clauses a function checks itself, per formal they read. */
export function conditionsPerFormal(this: void, clauses: readonly GuardClause[]): Record<BrandedIdentifier, string[]> {
	const conditions: Record<BrandedIdentifier, string[]> = {};
	for(const { kind, requires, rendered } of clauses) {
		if(kind === 'explicit') {
			for(const formal of GuardTerm.formalsOf(requires)) {
				(conditions[formal] ??= []).push(rendered);
			}
		}
	}
	return conditions;
}

/** All of the given clauses and those failing cleanly, in R syntax. */
export function summarizeClauses(this: void, clauses: readonly GuardClause[]): Pick<FunctionGuards, 'requires' | 'pure'> {
	const conjunction = (of: readonly GuardClause[]) => GuardTerm.render(GuardTerm.all(...of.map(c => c.requires)));
	return {
		requires: clauses.length === 0 ? '' : conjunction(clauses),
		pure:     clauses.some(c => c.pure) ? conjunction(clauses.filter(c => c.pure)) : ''
	};
}

/** What the guards of each of the definitions add to the {@link ArgProp}s of its formals, keyed by the id of each formal's name. */
export function guardRoles(this: void, definitions: readonly NodeId[], graph: DataflowGraph, options: FunctionGuardsOptions = {}): Record<NodeId, Record<NodeId, ArgProps>> {
	const roles: Record<NodeId, Record<NodeId, ArgProps>> = {};
	for(const [id, { clauses, required }] of Object.entries(guardsOfFunctions(definitions, graph, options))) {
		const definition = graph.idMap?.get(NodeId.normalize(id));
		if(!RFunctionDefinition.is(definition)) {
			continue;
		}
		const guarded = new Set(clauses.flatMap(c => [...GuardTerm.formalsOf(c.requires)]));
		const mine: Record<NodeId, ArgProps> = {};
		for(const { name, special } of definition.parameters) {
			const bits = special ? 0 : (required.includes(name.content) ? ArgProp.Required : 0) | (guarded.has(name.content) ? ArgProp.Guarded : 0);
			if(bits !== 0) {
				mine[name.info.id] = bits;
			}
		}
		if(Object.keys(mine).length > 0) {
			roles[id] = mine;
		}
	}
	return roles;
}
