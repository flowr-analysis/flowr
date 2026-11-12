/**
 * The `FunctionSemantics` facade wires these together, so a sibling here has to call the backing function directly; going through `FunctionSemantics` would make `src/dataflow/fn/function-semantics.ts` import its own importers.
 * @lintIgnore use-instead
 */
import type { DataflowGraph } from '../../graph/graph';
import { FunctionArgument } from '../../graph/graph';
import { Dataflow } from '../../graph/df-helper';
import { OriginType } from '../../origin/dfg-get-origin';
import type { CallRuledOut, DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexUse  } from '../../graph/vertex';
import { DfgVertex } from '../../graph/vertex';
import { DfEdge, EdgeType } from '../../graph/edge';
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
import { RWhileLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RForLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RParameter } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { bindsOutside, type BuiltInLookup } from '../frame-reflection';
import { definitionsBehind } from '../higher-order-function';
import { memoize } from '../../../util/collections/defaultmap';
import { GuardTerm, RConstantNames, type GuardArgument, type GuardBinding, type GuardCall, type GuardConstant, type GuardOuter } from './guard-term';
import type { GuardFacts, GuardFactsLookup, RFailure } from '../../environments/guard-facts';
import { type FormalTerms, asksCallable, callable, composesName, getAsExists, guardFactsOf, ImplicitClasses, messageFor, onlyComputesBy, passes, succeeds } from './guard-knowledge';
import { s3GroupGenericOf } from '../../environments/group-generics';
import { groupMethodConditions } from './group-method-guards';
import { s4CandidatesFor, s4MethodsOf, type S4Method } from '../dispatch';
import { linkedFunctionIds, MaxContextDepth } from '../../internal/dispatch-linking';
import { baseRExportOwner, isBasePrimitive } from '../../../util/r-base-packages';
import { RBaseGuards } from '../../../data/r-base-guards.generated';
import { BranchPaths, type BranchStep } from '../../../abstract-interpretation/branch-paths';
import { ControlFlowGraph } from '../../../control-flow/control-flow-graph';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RRepeatLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import { isNotUndefined } from '../../../util/assert';
import { contextFromInput } from '../../../project/context/flowr-analyzer-context';
import { DataflowAwareCfgGuidedVisitor } from '../../../control-flow/dfg-cfg-guided-visitor';
import { CfgVertex, type CfgBasicBlockVertex } from '../../../control-flow/control-flow-graph';
import { RUnaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RPipe } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { happensBeforeEach } from '../../../control-flow/happens-before';
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
	readonly ctx:           ReadOnlyFlowrAnalyzerContext
	/** the ways each node of every body is reached, see {@link pathsAt} */
	paths?:                 BranchPaths
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
	/** the formals whose default reads a name the body binds, as `scores = 1:n` with `n <- length(levs)`, which R evaluates once the body ran up to where the formal is read, so no claim from outside can tell what they hold */
	readonly drifting:   ReadonlySet<NodeId>
	/** something got hold of the frame of the function, or could write to it as far as flowR can tell, so what a formal holds is not known from here on */
	frameIsOpen:         boolean
	/** the definitions in branches the path at hand did not take, which a read there cannot see, see {@link eachPath} */
	skips:               ReadonlySet<NodeId>
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
	/** what may have happened before which node, see {@link orderOf} */
	order?:            RunOrder
}

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

/** Whether the read reads what a call of another function writes into this frame, rather than only a definition of the function itself. */
function readsCallWrite(this: void, id: NodeId, scope: Scope, state: GuardState): boolean {
	for(const [target, edge] of state.graph.edgesFrom(id)) {
		if(DfEdge.includesType(edge, EdgeType.Reads) && !scope.vertex.subflow.graph.has(target) && DfgVertex.isFunctionCall(state.graph.getVertex(target))) {
			return true;
		}
	}
	return false;
}

/** What the symbol stands for in terms of the function it is read in: a formal, a value that was bound to a local, or a name from outside. */
function symbolTerm(this: void, node: RNodeWithParent, scope: Scope, state: GuardState, depth: number): GuardTerm | undefined {
	const name = NodeId.recoverBareName(node.info.id, state.graph.idMap);
	if(name === undefined) {
		return undefined;
	} else if(RConstantNames.has(name)) {
		return { kind: 'constant', lexeme: name };
	} else if(scope.frameIsOpen) {
		return undefined;
	}
	const found = Dataflow.origin(state.graph, node.info.id)?.filter(o => !scope.skips.has(o.id));
	/* the target of `names(x) <- v` is defined there, while the replacement function reads what it held before */
	const origins = found !== undefined && found.length > 1 ? found.filter(o => o.id !== node.info.id) : found;
	if(origins === undefined || origins.length === 0) {
		/* no call links the read yet */
		return onceBoundLiteral(name, scope, state, depth) ?? { kind: 'free', name };
	} else if(origins.length > 1) {
		/* what a call binds a formal to, as a dispatch links it, is the formal still */
		const inside = origins.filter(o => scope.formals.has(o.id) || scope.vertex.subflow.graph.has(o.id));
		const formal = inside.length === 1 && !scope.drifting.has(inside[0].id) ? scope.formals.get(inside[0].id) : undefined;
		if(formal !== undefined) {
			return GuardTerm.formal(formal);
		}
		return isFormalName(name, scope) || inside.length > 0 ? undefined : { kind: 'free', name };
	}
	const [{ id }] = origins;
	/* a call writing the name into this frame, like `assign("y", v, envir = parent.frame())` in a callee, gives it another value */
	if(readsCallWrite(node.info.id, scope, state)) {
		return isFormalName(name, scope) || scope.vertex.subflow.graph.has(id) ? undefined : { kind: 'free', name };
	}
	const free: GuardTerm = { kind: 'free', name, origin: id };
	const formal = scope.formals.get(id);
	if(formal !== undefined) {
		return scope.drifting.has(id) ? undefined : GuardTerm.formal(formal);
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
	const bound = new Set<BrandedIdentifier | undefined>(RNode.collectAllIdsWithStop(definition.body, n => RFunctionDefinition.is(n)).values()
		.filter(n => DfgVertex.isVariableDefinition(state.graph.getVertex(n))).map(n => NodeId.recoverBareName(n, state.graph.idMap)));
	/* a default reading a formal that drifts drifts as well, as `levels = pretty(zlim)` with `zlim = range(z)` */
	const drifting = new Set<NodeId>();
	for(let grew = true; grew;) {
		grew = false;
		for(const p of definition.parameters) {
			if(!drifting.has(p.name.info.id) && p.defaultValue !== undefined && RNode.collectAllIds(p.defaultValue).values()
				.some(n => RSymbol.is(nodeOf(n, state)) && bound.has(NodeId.recoverBareName(n, state.graph.idMap)))) {
				drifting.add(p.name.info.id);
				bound.add(p.name.content);
				grew = true;
			}
		}
	}
	return { definition, vertex, formals: new Map(definition.parameters.filter(p => !p.special).map(p => [p.name.info.id, p.name.content])), drifting, frameIsOpen: false, skips: new Set() };
}

/** The formals of a function by name, `...` among them. */
function formalNamesOf(this: void, { definition }: Scope): BrandedIdentifier[] {
	return definition.parameters.map(p => p.name.content);
}

/** Whether the argument states the formal it is for, by the name of the formal in full. */
function namesFormal(this: void, argument: DataflowGraphVertexFunctionCall['args'][number], names: readonly BrandedIdentifier[]): boolean {
	return FunctionArgument.isNamed(argument) && names.includes(argument.name);
}

/** What the caller states the value of an argument as, `undefined` if it cannot. */
export type ArgumentTerm = (value: RNodeWithParent) => GuardTerm | undefined;

/** What the given arguments of the call bind the formals `names` of the callee to, seen from the caller, with whether that leaves no formal unbound. */
function bindingOfArguments(this: void, vertex: DataflowGraphVertexFunctionCall, args: DataflowGraphVertexFunctionCall['args'], names: readonly BrandedIdentifier[], graph: DataflowGraph, termOfArgument: ArgumentTerm): { readonly binding: GuardBinding, readonly complete: boolean } {
	const binding = new Map<BrandedIdentifier, GuardTerm>();
	const matched = MatchArgs.toSpec<BrandedIdentifier>(args, Object.fromEntries(names.map(n => [n, n])));
	for(const [formal, ids] of matched) {
		const value = formal === '...' || ids.length !== 1 ? undefined : valueOfArgument(ids[0], vertex, graph);
		const term = value === undefined ? undefined : termOfArgument(value);
		if(term !== undefined) {
			binding.set(formal, term);
		}
	}
	return { binding, complete: names.every(n => n !== '...' && (matched.get(n)?.length ?? 0) > 0) };
}

/** What the arguments of the call bind the formals of the callee to for sure: what the dots hand on may name any formal, which moves the arguments given by position, so only the ones given by their full name stay. */
function bindingOf(this: void, vertex: DataflowGraphVertexFunctionCall, names: readonly BrandedIdentifier[], graph: DataflowGraph, termOfArgument: ArgumentTerm): GuardBinding {
	const args = MatchArgs.handsOnDots(vertex.args, graph) ? vertex.args.filter(a => namesFormal(a, names)) : vertex.args;
	return bindingOfArguments(vertex, args, names, graph, termOfArgument).binding;
}

/** What the arguments of a call handing on dots bind if the dots name nothing, which only keeps the arguments in front of the dots in place. */
function bindingBesidesDots(this: void, vertex: DataflowGraphVertexFunctionCall, names: readonly BrandedIdentifier[], graph: DataflowGraph, termOfArgument: ArgumentTerm): ReturnType<typeof bindingOfArguments> | undefined {
	const dots = vertex.args.findIndex(a => MatchArgs.handsOnDots([a], graph));
	if(dots < 0) {
		return undefined;
	}
	return bindingOfArguments(vertex, vertex.args.filter((a, at) => at < dots || namesFormal(a, names)), names, graph, termOfArgument);
}

/** Whether something the dots hand on bears a name, which only the function holding the dots can tell. */
const DotsBearNames = GuardTerm.known('!', GuardTerm.known('is.null', GuardTerm.known('...names')));
const DotsBearNamesText = GuardTerm.render(DotsBearNames);

/** Whether the dots of the callee are its own and a call leaves them without a name, as nothing it hands on could bear one: a name not spelled out in full may still end up in them. */
function leavesDotsUnnamed(this: void, vertex: DataflowGraphVertexFunctionCall, names: readonly BrandedIdentifier[], graph: DataflowGraph): boolean {
	return names.includes('...') && !MatchArgs.handsOnDots(vertex.args, graph) && vertex.args.every(a => !FunctionArgument.isNamed(a) || namesFormal(a, names));
}

/** What a call binds the formals of its callee to, see {@link callBinding}. */
export interface CallBinding {
	/** what the formals stand for for sure */
	readonly binding:     GuardBinding
	/** if the call hands on dots, what they stand for if the dots name nothing */
	readonly besides?:    ReturnType<typeof bindingOfArguments>
	/** the call leaves the dots of the callee without a name */
	readonly dotsUnnamed: boolean
}

/**
 * What the call binds the formals `names` of its callee to, by R's argument matching, the way the contract of a callee is inherited:
 * `termOfArgument` states the value of an argument in the words of the caller.
 */
export function callBinding(this: void, vertex: DataflowGraphVertexFunctionCall, names: readonly BrandedIdentifier[], graph: DataflowGraph, termOfArgument: ArgumentTerm): CallBinding {
	const besides = bindingBesidesDots(vertex, names, graph, termOfArgument);
	/* with every formal bound and no dots to take more, anything further the dots hand on is an error, so nothing can move */
	const binding = besides?.complete ? besides.binding : bindingOf(vertex, names, graph, termOfArgument);
	return { binding, ...(besides === undefined ? {} : { besides }), dotsUnnamed: leavesDotsUnnamed(vertex, names, graph) };
}

/**
 * A condition of a callee in the words of a caller binding its formals by `call`, see {@link callBinding}, with `outer` stating what the callee reads from outside:
 * `requires` holds for sure, and `unlessNamed`, if the call hands on dots, holds as long as they name nothing.
 */
export function atCall(this: void, condition: GuardTerm, call: CallBinding, outer: GuardOuter | undefined, facts: GuardFactsLookup): { readonly requires: GuardTerm, readonly unlessNamed?: GuardTerm } {
	const asked = call.dotsUnnamed ? GuardTerm.any(...GuardTerm.disjuncts(condition).filter(d => GuardTerm.render(d) !== DotsBearNamesText)) : condition;
	const requires = GuardTerm.substituteCondition(asked, call.binding, outer, facts);
	if(call.besides === undefined || call.besides.complete) {
		return { requires };
	}
	const unlessNamed = GuardTerm.substituteCondition(asked, call.besides.binding, outer, facts);
	return GuardTerm.render(unlessNamed) === GuardTerm.render(requires) ? { requires } : { requires, unlessNamed: GuardTerm.any(DotsBearNames, unlessNamed) };
}

/** The node of the value of an argument, a named argument being bound by the node that names it. */
function valueOfArgument(this: void, argument: NodeId, vertex: DataflowGraphVertexFunctionCall, graph: DataflowGraph): RNodeWithParent | undefined {
	const named = vertex.args.find(a => FunctionArgument.isNamed(a) && a.nodeId === argument);
	const node = graph.idMap?.get(named !== undefined && FunctionArgument.isNamed(named) && named.valueId !== undefined ? named.valueId : argument);
	/* `exists("x")` reads `x` through a symbol the dataflow made up, while the argument is what was written */
	const written = node?.info.parent === undefined ? undefined : graph.idMap?.get(node.info.parent);
	return written !== undefined && node !== undefined && !RNode.directChildren(written).includes(node) ? written : node;
}

/** A call of a program's own function as what its single expression says, which is how a predicate like `is_count(x)` is seen through. */
function inlined(this: void, id: NodeId, vertex: DataflowGraphVertexFunctionCall, scope: Scope, state: GuardState, depth: number): GuardTerm | undefined {
	const target = soleCallee(id, state);
	const callee = target === undefined || depth >= MaxTermDepth ? undefined : scopeOf(target, state);
	const single = callee === undefined ? undefined : singleExpression(callee.definition, state);
	/* a generic hands over to whichever method it dispatches to, what it says itself is no value of the call */
	const body = single !== undefined && RFunctionCall.isNamed(single) && Identifier.getName(single.functionName.content) === 'UseMethod' ? undefined : single;
	const term = callee === undefined || body === undefined ? undefined : termOf(body, callee, state, depth + 1);
	return term === undefined || callee === undefined ? undefined : GuardTerm.substitute(term, bindingOf(vertex, formalNamesOf(callee), state.graph, v => termOf(v, scope, state, depth + 1)));
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
	if(run.scope.frameIsOpen || (extra.kind === 'implicit' && impliedBy(condition, reached, [...run.scope.formals.values()], run.state.facts))) {
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

/** The literal message a call like `stop("...")` raises. */
export function messageOf(this: void, node: RNodeWithParent | undefined): string | undefined {
	if(!RFunctionCall.is(node)) {
		return undefined;
	}
	const [first] = node.arguments;
	return first !== undefined && first !== EmptyArgument && first.name === undefined && RString.is(first.value) ? first.value.content.str : undefined;
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
		bound.set(formal, ids.map(id => valueOfArgument(id, vertex, state.graph)).filter(n => n !== undefined));
	}
	return bound;
}

/**
 * The formals of a function of base R written in R, not C, a missing formal of the caller may be handed to: R hands on a promise, and that only
 * fails once the function evaluates it, which its own contract says it does (`matpoints(x, y)` hands a missing `y` to `matplot`, which asks `missing(y)`).
 * Nothing for a function written in C, or one without a contract, which flowR's model describes as it is.
 */
function closureMissingOk(this: void, name: BrandedIdentifier, formals: readonly BrandedIdentifier[]): BrandedIdentifier[] {
	const owner = baseRExportOwner(name);
	if(owner === undefined || isBasePrimitive(name)) {
		return [];
	}
	const stored = RBaseGuards()[String(owner)]?.[String(name)];
	/* without a contract of its own, flowR's model of the function (a generic forcing what it dispatches on) is all there is */
	if(stored === undefined) {
		return [];
	}
	const required = [...stored.required ?? [], ...stored.dispatches === undefined ? [] : [stored.dispatches]];
	return formals.filter(f => !required.includes(f));
}

/** The arguments handed over which R evaluates for sure, in the order they are written, and those it may not. */
function evaluatedAndNot(this: void, vertex: DataflowGraphVertexFunctionCall, state: GuardState): { readonly forced: RNodeWithParent[], readonly lazy: RNodeWithParent[] } {
	const sig = knownNameOf(vertex.id, vertex, state) === undefined ? undefined : state.info(vertex.name)?.sig;
	const values = vertex.args.filter(FunctionArgument.isNotEmpty).map(a => valueOfArgument(a.nodeId, vertex, state.graph)).filter(n => n !== undefined);
	if(sig === undefined) {
		return { forced: [], lazy: values };
	}
	const bound = boundArguments(vertex, sig, state);
	/* a special primitive matching its arguments itself takes a missing formal handed to some of its own as not given */
	const name = Identifier.getName(vertex.name);
	const missingOk = [...state.facts(name)?.missingOk ?? [], ...closureMissingOk(name, sig.map(([formal]) => formal))];
	const forcedIds = new Set(sig.filter(([, props]) => (props & ArgProp.Forced) !== 0).flatMap(([formal]) => (bound.get(formal) ?? []).filter(v => !missingOk.includes(formal) || !RSymbol.is(v))));
	return { forced: values.filter(v => forcedIds.has(v)), lazy: values.filter(v => !forcedIds.has(v)) };
}

/** Notes that `of` has to pass each of the failures R raises by itself, `other` being the second operand of an operator. */
function addFailures(this: void, failures: readonly RFailure[], of: GuardTerm, at: NodeId, path: Path, run: Run, other?: GuardTerm, formals?: FormalTerms): void {
	for(const failure of failures) {
		addClause(run, path, passes(failure, of, n => isDefined(n, run.state), other, formals), at, { kind: 'implicit', message: messageFor(failure, of) });
	}
}

/** What `if`, `while`, `for`, or `switch` asks of what decides it, if that is a formal, `part` being the formal of the construct it fills. */
function conditionRequirement(this: void, construct: BrandedIdentifier, part: BrandedIdentifier, condNode: RNodeWithParent, path: Path, run: Run): void {
	const formal = formalOfNode(condNode, run);
	if(formal !== undefined) {
		addFailures(run.state.facts(construct)?.asks?.[part] ?? [], formal, condNode.info.id, path, run);
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
	/* what another formal was handed, as far as it is one of the caller's, as a literal would only spell out what is known of it */
	const formals: FormalTerms = formal => {
		const values = bound.get(formal) ?? [];
		const term = values.length === 1 ? termOfNode(values[0]) : undefined;
		return term?.kind === 'formal' ? term : undefined;
	};
	groupMethodRequirements(name, asks, bound, termOfNode, vertex, path, run);
	for(const [formal, failures] of Object.entries(asks)) {
		for(const value of bound.get(formal) ?? []) {
			const term = termOfNode(value);
			const otherNode = operands.find(o => o !== value);
			const other = otherNode === undefined ? undefined : termOfNode(otherNode);
			const stated = failures.filter(f => term !== undefined && (term.kind === 'formal' || asksCallable(f)) && (!f.dispatches || otherNode === undefined || other !== undefined));
			if(term !== undefined) {
				addFailures(stated, term, vertex.id, path, run, other, formals);
			}
		}
	}
}

/** What the methods of the base packages for the classes of R's own values ask on a call of a member of a group generic, but for classes the program has methods for. */
function groupMethodRequirements(this: void, name: BrandedIdentifier, asks: NonNullable<GuardFacts['asks']>, bound: ReadonlyMap<BrandedIdentifier, readonly RNodeWithParent[]>, termOfNode: (n: RNodeWithParent) => GuardTerm | undefined, vertex: DataflowGraphVertexFunctionCall, path: Path, run: Run): void {
	const group = s3GroupGenericOf(name);
	if(group === undefined) {
		return;
	}
	const operands = Object.keys(asks).filter(f => f !== '...').map(f => {
		const values = bound.get(f) ?? [];
		const term = values.length === 1 ? termOfNode(values[0]) : undefined;
		return term?.kind === 'formal' || term?.kind === 'constant' ? term : undefined;
	});
	const excluded = new Set([...run.state.methodClasses(name), ...run.state.methodClasses(group)]);
	for(const condition of groupMethodConditions(name, operands, excluded, run.state.facts)) {
		addClause(run, path, condition, vertex.id, { kind: 'implicit' });
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
	const call = callBinding(vertex, formalNamesOf(callee), state.graph, v => termOf(v, scope, state));
	/* a closure reads the formals of the function it is called from as well */
	const outer = (origin: NodeId) => {
		const name = scope.formals.get(origin);
		return name === undefined ? undefined : GuardTerm.formal(name);
	};
	for(const clause of contract.clauses) {
		const inherited = { kind: clause.kind, pure: clause.pure, via: [vertex.id, ...clause.via ?? []], ...(clause.message === undefined ? {} : { message: clause.message }) };
		const { requires, unlessNamed } = atCall(clause.requires, call, outer, state.facts);
		if(GuardTerm.formalsOf(requires).size > 0 || GuardTerm.isFalse(requires)) {
			addClause(run, path, requires, clause.at, inherited);
		}
		if(unlessNamed !== undefined && GuardTerm.formalsOf(unlessNamed).size > 0) {
			addClause(run, path, unlessNamed, clause.at, inherited);
		}
	}
	if(path.length === 0) {
		for(const formal of contract.required) {
			const bound = call.binding.get(formal);
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
	const operands = vertex.args.filter(FunctionArgument.isNotEmpty).map(a => valueOfArgument(a.nodeId, vertex, state.graph)).map(n => n === undefined ? undefined : termOf(n, scope, state));
	if(group === undefined || s4 === undefined || operands.length === 0 || operands.length > 2 || operands.includes(undefined)) {
		return;
	}
	const terms = operands as GuardTerm[];
	const bound = (callee: Scope) => bindingOf(vertex, formalNamesOf(callee), state.graph, v => termOf(v, scope, state));
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

/** `FUN(x)` for a formal `FUN`: a formal not holding a function makes R look for a function of the same name. */
function calledFormal(this: void, call: RFunctionCall<ParentInformation> & { readonly named: true }, path: Path, run: Run): void {
	const { state, scope } = run;
	const reads = Dataflow.origin(state.graph, call.info.id)?.filter(o => o.type === OriginType.ReadVariableOrigin) ?? [];
	const formal = reads.length === 1 ? scope.formals.get(reads[0].id) : undefined;
	if(formal !== undefined && formal === Identifier.getName(call.functionName.content)) {
		addClause(run, path, callable(GuardTerm.formal(formal), n => isDefined(n, state), false), call.info.id, { kind: 'implicit' });
	}
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
	run.returned.push({ value, holds: path.map(step => step.holds) });
}

/** What only steers where the body goes on, which does nothing of its own: the effects are what it runs. */
const Steering: readonly BuiltInProcName[] = [BuiltInProcName.Stop, BuiltInProcName.StopIfNot, BuiltInProcName.Return, BuiltInProcName.IfThenElse, BuiltInProcName.ForLoop,
	BuiltInProcName.WhileLoop, BuiltInProcName.RepeatLoop, BuiltInProcName.ExpressionList, BuiltInProcName.Break, BuiltInProcName.Switch];

/** What may have happened before which node of a body, read off the control flow, see {@link orderOf}. */
interface RunOrder {
	/** the calls that may do more than compute a value */
	readonly effects:           ReadonlySet<NodeId>
	/** the nodes that may write to the frame behind the back of the dataflow, see {@link frameOpeners} */
	readonly openers:           ReadonlySet<NodeId>
	/** a default of a formal may do more than compute a value, which it does on first read, wherever that is */
	readonly effectfulDefaults: boolean
	/** the ways out of the function the control flow does not tell, see {@link exitStep} */
	readonly exits:             ReadonlySet<NodeId>
	/** {@link exitStep} of an exit, worked out once */
	readonly exitStep:          (exit: NodeId) => PathStep
	/** those of the `candidates` that may run before `node`, see {@link happensBeforeEach} */
	readonly before:            (candidates: ReadonlySet<NodeId>, node: NodeId) => NodeId[]
}

/** The ways each node of every body of the graph is reached, worked out once per run, see {@link BranchPaths}. */
function branchPathsOf(this: void, state: GuardState): BranchPaths {
	if(state.paths === undefined) {
		const graph = state.graph;
		const controlFlow = { graph: new ControlFlowGraph(graph), entryPoints: [...graph.rootIds()], exitPoints: [], returns: [], breaks: [], nexts: [] };
		state.paths = BranchPaths.create({ controlFlow, dfg: graph, normalizedAst: { idMap: graph.idMap as AstIdMap }, ctx: state.ctx });
		state.paths.start();
	}
	return state.paths;
}

/** Whether the node runs in the body of a loop of the function. */
function inLoopOf(this: void, node: RNodeWithParent | undefined, { state, scope }: Run): boolean {
	const idMap = state.graph.idMap as AstIdMap;
	return node !== undefined && [node, ...RNode.iterateParents(node, idMap)].some(n => {
		const parent = RNode.directParent(n, idMap);
		return (RForLoop.is(parent) || RWhileLoop.is(parent) || RRepeatLoop.is(parent)) && parent.body === n && within(parent, scope.definition.body, state);
	});
}

/** Whether the code ends in a `stop`, so it never completes. */
function alwaysFails(this: void, node: RNodeWithParent, state: GuardState): boolean {
	let last = node;
	while(RExpressionList.is(last) && last.children.length > 0) {
		last = last.children[last.children.length - 1];
	}
	return runsBuiltIn(callVertexOf(last.info.id, state), BuiltInProcName.Stop);
}

/** Where the node starts in the code, to order the steps of a path outermost first. */
function positionOf(this: void, id: NodeId, state: GuardState): number {
	const location = nodeOf(id, state)?.location;
	return location === undefined ? 0 : location[0] * 100_000 + location[1];
}

/** Whether `node` lies within `around`. */
function within(this: void, node: RNodeWithParent, around: RNodeWithParent | undefined, state: GuardState): boolean {
	return around !== undefined && (node === around || RNode.iterateParents(node, state.graph.idMap as AstIdMap).some(p => p === around));
}

/** What a step of the {@link BranchPaths} says on the way to `node`, `undefined` if it says nothing there. */
function stepOf(this: void, { cause, when, target }: BranchStep, node: RNodeWithParent, run: Run): PathStep | undefined {
	const { state, scope } = run;
	const construct = nodeOf(cause, state);
	const pick = (term: GuardTerm | undefined) => stepsOf(term, state.facts)[when ? 0 : 1];
	if(RIfThenElse.is(construct)) {
		/* code after an `if` whose other branch always fails asks nothing more of it: the failure asks for the condition itself */
		const other = when ? construct.otherwise : construct.then;
		if(other !== undefined && !within(node, construct, state) && alwaysFails(other, state)) {
			return undefined;
		}
		return pick(termOf(construct.condition, scope, state));
	} else if(RForLoop.is(construct) || RWhileLoop.is(construct) || RRepeatLoop.is(construct)) {
		/* what comes after a loop is reached either way, what runs within it is known nothing of, and a `return` in it is an exit of its own, see {@link pathsAt} */
		return undefined;
	} else if(RBinaryOp.is(construct) && (construct.operator === '&&' || construct.operator === '||')) {
		/* the left operand decides whether the right one runs, and nothing after */
		return within(node, construct.rhs, state) ? pick(termOf(construct.lhs, scope, state)) : undefined;
	} else if(RFunctionCall.is(construct) && knownNameOf(cause, callVertexOf(cause, state) as DataflowGraphVertexFunctionCall, state) === 'switch') {
		/* what comes after it was reached through whichever alternative did not leave, of which nothing is known */
		return within(node, construct, state) ? switchStep(construct, when ? target : undefined, run) : UnknownStep;
	}
	return UnknownStep;
}

/**
 * The step into the alternative of a `switch(expr, a = ., b = .)` that `entered` lies in (none if no alternative was taken), reached if `expr` names it,
 * or by position if it is a number, or as the default by a string naming none.
 */
function switchStep(this: void, node: RFunctionCall<ParentInformation>, entered: NodeId | undefined, run: Run): PathStep {
	const { state, scope } = run;
	const [selector, ...alternatives] = node.arguments;
	const term = selector === undefined || selector === EmptyArgument || selector.value === undefined ? undefined : termOf(selector.value, scope, state);
	const names = alternatives.flatMap(a => a === EmptyArgument || a.name === undefined ? [] : [GuardTerm.string(String(a.name.content))]);
	const notString = term === undefined ? GuardTerm.True : GuardTerm.known('!', GuardTerm.known('is.character', term));
	const isAny = (of: readonly GuardTerm[]) => term === undefined ? GuardTerm.True : GuardTerm.known('%in%', term, of.length === 1 ? of[0] : GuardTerm.known('c', ...of));
	const selected = term?.kind === 'constant' && typeof term.value === 'string' ? term.value : undefined;
	const enteredNode = entered === undefined ? undefined : nodeOf(entered, state);
	let falling: GuardTerm[] = [];
	for(const alternative of alternatives) {
		if(alternative === EmptyArgument) {
			continue;
		}
		const name = alternative.name === undefined ? undefined : GuardTerm.string(String(alternative.name.content));
		if(alternative.value === undefined) {
			falling = name === undefined ? falling : [...falling, name];
			continue;
		}
		const reachedBy = name === undefined ? undefined : [...falling, name];
		falling = [];
		if(enteredNode === undefined || !within(enteredNode, alternative.value, state)) {
			continue;
		}
		/* a literal string selects the alternative right away, as in a method with `.Generic` spelled out */
		const fails = selected !== undefined ? ((reachedBy ?? names).some(n => GuardTerm.constantString(n) === selected) === (reachedBy !== undefined) ? GuardTerm.False : GuardTerm.True)
			: reachedBy === undefined ? GuardTerm.any(notString, isAny(names))
				: GuardTerm.any(notString, GuardTerm.known('!', isAny(reachedBy)));
		return { holds: GuardTerm.True, fails: names.length === 0 ? GuardTerm.True : fails };
	}
	/* no alternative was taken: the selector names none of them */
	return { holds: GuardTerm.True, fails: names.length === 0 ? GuardTerm.True : GuardTerm.any(notString, isAny(names)) };
}

/** The definitions in what a branch on the path did not take: the other branch of an `if`. */
function untaken(this: void, steps: readonly BranchStep[], state: GuardState): Set<NodeId> {
	const skips = new Set<NodeId>();
	for(const { cause, when } of steps) {
		const construct = nodeOf(cause, state);
		const other = RIfThenElse.is(construct) ? (when ? construct.otherwise : construct.then) : undefined;
		for(const id of other === undefined ? [] : RNode.collectAllIdsWithStop(other, n => RFunctionDefinition.is(n))) {
			if(DfgVertex.isVariableDefinition(state.graph.getVertex(id))) {
				skips.add(id);
			}
		}
	}
	return skips;
}

/**
 * The ways `node` is reached from the start of the body, as paths of the steps the guards read, each with the definitions it does not see
 * (see {@link untaken}), `undefined` if they are not known.
 */
function pathsAt(this: void, node: RNodeWithParent, run: Run): { readonly path: Path, readonly skips: ReadonlySet<NodeId> }[] | undefined {
	const { scope } = run;
	const order = run.order as RunOrder;
	/* what holds of the formals is gone once the frame may have been written behind the back of the dataflow */
	scope.frameIsOpen = order.openers.has(node.info.id) || order.before(order.openers, node.info.id).length > 0;
	run.effects = order.effectfulDefaults || order.before(order.effects, node.info.id).length > 0;
	const exits = order.before(order.exits, node.info.id).map(order.exitStep);
	return stepsTo(node, run)?.map(({ path, skips }) => ({ path: [...path, ...exits], skips }));
}

/**
 * What the control flow does not tell of a way out before `exit`: as it may have left the function there (a call of what may be
 * the `return` of R, a `return` in a loop), code after it is reached only if it did not, as the conditions on the way there say.
 */
function exitStep(this: void, exit: NodeId, run: Run): PathStep {
	const paths = stepsTo(nodeOf(exit, run.state) as RNodeWithParent, run);
	return paths?.length === 1 ? { holds: GuardTerm.True, fails: GuardTerm.all(...paths[0].path.map(step => step.holds)) } : UnknownStep;
}

/** Whether the condition the branch takes its way by can be stated, without which which way it went tells nothing apart. */
function statesCondition(this: void, cause: NodeId, run: Run): boolean {
	const construct = nodeOf(cause, run.state);
	return !RIfThenElse.is(construct) || termOf(construct.condition, run.scope, run.state) !== undefined;
}

/** {@link pathsAt} without the exits and what happened before, which does not change anything of the run. */
function stepsTo(this: void, node: RNodeWithParent, run: Run): { readonly path: Path, readonly skips: ReadonlySet<NodeId> }[] | undefined {
	const { state, scope } = run;
	/* a branch defining something is one a read after it may see either way, see {@link untaken} */
	const found = branchPathsOf(state).pathsTo(scope.vertex.id, node.info.id, cause => untaken([{ cause, when: true }, { cause, when: false }], state).size === 0 || !statesCondition(cause, run));
	/* what runs in the body of a loop runs any number of times, so nothing is known of how it is reached */
	const looped = inLoopOf(node, run);
	/* what flowR cannot tell how it is reached is reached in a way nothing is known of */
	return (found ?? [[]]).map(steps => {
		const sorted = [...steps].sort((a, b) => positionOf(a.cause, state) - positionOf(b.cause, state));
		const skips = untaken(sorted, state);
		scope.skips = skips;
		const path = [...sorted.map(step => stepOf(step, node, run)).filter(isNotUndefined), ...looped || found === undefined ? [UnknownStep] : []];
		scope.skips = new Set();
		return { path, skips };
	});
}

/** The calls of the body that may do more than compute a value, and those that may write to its frame, with how the body may run from one node to the next. */
function orderOf(this: void, run: Run): RunOrder {
	const { state, scope } = run;
	const effects = new Set<NodeId>();
	const openers = new Set(run.openers);
	const exits: NodeId[] = [];
	const inUseMethod = new Set<NodeId>();
	for(const id of RNode.collectAllIdsWithStop(scope.definition.body, n => RFunctionDefinition.is(n))) {
		const vertex = callVertexOf(id, state);
		const node = nodeOf(id, state);
		if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Return) && (!runsBuiltIn(vertex, BuiltInProcName.Return) || inLoopOf(node, run))) {
			exits.push(id);
		}
		/* what names the generic of a `UseMethod` is no call of its own, whatever the dataflow turns it into */
		if(vertex !== undefined && knownNameOf(id, vertex, state) === 'UseMethod' && RFunctionCall.is(node)) {
			node.arguments.forEach(a => a !== EmptyArgument && a.value !== undefined && RNode.collectAllIds(a.value).forEach(i => inUseMethod.add(i)));
		}
		/* a name standing for a call, as the generic `UseMethod` names stands for the dispatch, does nothing of its own */
		if(vertex === undefined || RSymbol.is(node) || RConstant.is(node) || inUseMethod.has(id)) {
			continue;
		}
		const target = RFunctionCall.isNamed(nodeOf(id, state)) ? soleCallee(id, state) : undefined;
		const contract = target === undefined ? undefined : contractOf(target, state, viaCall(id, run));
		if(contract !== undefined ? contract.effects : !Steering.some(proc => runsBuiltIn(vertex, proc)) && !onlyComputes(id, vertex, state)) {
			effects.add(id);
		}
		if(contract?.opens) {
			openers.add(id);
		}
	}
	const effectfulDefaults = scope.definition.parameters.some(({ defaultValue }) => defaultValue !== undefined
		&& RNode.collectAllIdsWithStop(defaultValue, n => RFunctionDefinition.is(n)).values().some(id => {
			const vertex = callVertexOf(id, state);
			return vertex !== undefined && !RSymbol.is(nodeOf(id, state)) && !onlyComputes(id, vertex, state);
		}));
	const cfg = branchPathsOf(state).controlFlow.graph;
	return { effects, openers, effectfulDefaults, exits: new Set(exits), exitStep: memoize((exit: NodeId) => exitStep(exit, run)), before: (candidates, node) => [...happensBeforeEach(cfg, candidates, node).keys()].filter(c => c !== node) };
}

/** Each path to the node, with what flowR cannot tell how the node is reached left without any. */
function eachPath(this: void, node: RNodeWithParent, run: Run, fn: (path: Path) => void): void {
	for(const { path, skips } of pathsAt(node, run) ?? []) {
		run.scope.skips = skips;
		fn(path);
	}
	run.scope.skips = new Set();
}

/**
 * Walks the body of the function in the order its control flow runs it, asking of each call what it requires on every way it is reached
 * (see {@link pathsAt}). Code that may not run at all (an argument R may not evaluate, what `tryCatch` or `local` runs) asks nothing.
 */
let GuardVisitor: (new (run: Run) => { walk(): void }) | undefined;

/** {@link GuardVisitor}, made on first use, as the visitor it extends sits in an import cycle with the guards. */
function guardVisitor(this: void): new (run: Run) => { walk(): void } {
	return GuardVisitor ??= class extends DataflowAwareCfgGuidedVisitor {
		private readonly run: Run;
		/** the nodes of the body, without those of the functions it defines */
		private readonly own: ReadonlySet<NodeId>;
		/** the nodes that may not run, see {@link GuardVisitor#skip} */
		private readonly skipped = new Set<NodeId>();
		/** what is asked once a node is evaluated, as the condition of an `if` is, which the control flow reaches before what the `if` runs */
		private readonly evaluated = new Map<NodeId, () => void>();

		constructor(run: Run) {
			super({ controlFlow: branchPathsOf(run.state).controlFlow, dfg: run.state.graph, defaultVisitingOrder: 'forward' });
			this.run = run;
			this.own = new Set(RNode.collectAllIdsWithStop(run.scope.definition.body, n => RFunctionDefinition.is(n)));
			for(const id of this.own) {
				if(!this.skipped.has(id)) {
					this.prepare(id);
				}
			}
		}

		/** Walks the body from its start. */
		public walk(): void {
			const { subflow } = this.run.scope.vertex;
			this.startVisitor([subflow.cfgEntry ?? subflow.entryPoint]);
		}

		/** Notes what of the node may not run (the arguments R may not evaluate, or all of it), and what its evaluated parts ask. */
		private prepare(id: NodeId): void {
			const { run } = this;
			const { state } = run;
			const node = nodeOf(id, state);
			const vertex = callVertexOf(id, state);
			if(node === undefined || vertex === undefined || RSymbol.is(node)) {
				return;
			}
			const inner = () => RNode.collectAllIds(node).forEach(n => n !== id && this.skip(n));
			/* a `(` or `{` or `if` of the program's own may not evaluate what it holds, `tryCatch` and `local` run it elsewhere, a `return` that may be one of the program's own may still be the one of R */
			if((RExpressionList.is(node) && mayRunOwn(id, vertex, state)) || (RIfThenElse.is(node) && !runsBuiltIn(vertex, BuiltInProcName.IfThenElse))
				|| DfgVertex.hasOrigin(vertex, BuiltInProcName.Try) || (DfgVertex.hasOrigin(vertex, BuiltInProcName.Return) && !runsBuiltIn(vertex, BuiltInProcName.Return)) || runsBuiltIn(vertex, BuiltInProcName.Local)) {
				inner();
				return;
			}
			const call = RFunctionCall.is(node) ? node : undefined;
			const name = knownNameOf(id, vertex, state);
			const condition = (construct: BrandedIdentifier, part: BrandedIdentifier, decides: RNodeWithParent) =>
				this.evaluated.set(decides.info.id, () => eachPath(decides, run, path => conditionRequirement(construct, part, decides, path, run)));
			if(RIfThenElse.is(node)) {
				condition('if', 'cond', node.condition);
				return;
			} else if(RForLoop.is(node) || RWhileLoop.is(node)) {
				if(RForLoop.is(node) && runsBuiltIn(vertex, BuiltInProcName.ForLoop)) {
					condition('for', 'seq', node.vector);
				} else if(RWhileLoop.is(node) && runsBuiltIn(vertex, BuiltInProcName.WhileLoop)) {
					condition('while', 'cond', node.condition);
				}
				return;
			} else if(RBinaryOp.is(node) && (node.operator === '&&' || node.operator === '||') && name !== undefined) {
				/* the path already states what makes R look at the right operand */
				const operand = (formal: BrandedIdentifier) => (state.facts(node.operator)?.asks?.[formal] ?? []).map(({ when: _, ...failure }) => failure);
				for(const [side, formal] of [[node.lhs, 'x'], [node.rhs, 'y']] as const) {
					this.evaluated.set(side.info.id, () => eachPath(side, run, path => {
						const term = termOf(side, run.scope, state);
						if(term?.kind === 'formal') {
							addFailures(operand(formal), term, side.info.id, path, run);
						}
					}));
				}
				return;
			} else if(call !== undefined && runsBuiltIn(vertex, BuiltInProcName.StopIfNot)) {
				const asserting = state.facts(Identifier.getName(vertex.name))?.asserts;
				const conditions = asserting === undefined ? stopIfNotConditions(call) : call.arguments.flatMap(a => a === EmptyArgument || a.value === undefined || asserting.includes(a.name?.content ?? '') ? [] : [a.value]);
				if(conditions === undefined) {
					inner();
				}
				conditions?.forEach(expression => this.evaluated.set(expression.info.id, () => conditionClause(expression, asserting === undefined, run)));
				return;
			} else if(call !== undefined && name === 'switch') {
				const [selector] = call.arguments;
				if(selector !== EmptyArgument && selector?.value !== undefined) {
					condition('switch', 'EXPR', selector.value);
				}
				return;
			} else if(RExpressionList.is(node) || RRepeatLoop.is(node) || (call !== undefined && (runsBuiltIn(vertex, BuiltInProcName.Return) || name === 'UseMethod'))) {
				return;
			}
			const all = () => vertex.args.filter(FunctionArgument.isNotEmpty).map(a => valueOfArgument(a.nodeId, vertex, state.graph)).filter(n => n !== undefined);
			const lazy = (call !== undefined && !RFunctionCall.isNamed(call)) || soleCallee(id, state) !== undefined ? all() : evaluatedAndNot(vertex, state).lazy;
			/* of a named argument, what flowR hands over may be its name, the value R does not evaluate sits next to it */
			lazy.map(value => RNode.directParent(value, state.graph.idMap as AstIdMap)).forEach((argument, at) => RNode.collectAllIds(RArgument.is(argument) ? argument : lazy[at]).forEach(n => this.skip(n)));
		}

		/** What may not run can still return from the function, with a value flowR does not know. */
		private skip(id: NodeId): void {
			this.skipped.add(id);
			const vertex = callVertexOf(id, this.run.state);
			if(vertex !== undefined && !RSymbol.is(nodeOf(id, this.run.state)) && (DfgVertex.hasOrigin(vertex, BuiltInProcName.Return) || Identifier.getName(vertex.name) === 'return_from')) {
				eachPath(nodeOf(id, this.run.state) as RNodeWithParent, this.run, path => returnsValue(undefined, path, this.run));
			}
		}

		protected override visitDataflowNode(node: Exclude<CfgVertex, CfgBasicBlockVertex>): void {
			const id = CfgVertex.getId(node);
			if(this.own.has(id) && !this.skipped.has(id)) {
				super.visitDataflowNode(node);
				this.evaluated.get(id)?.();
			}
		}

		protected override visitVariableUse(use: DataflowGraphVertexUse): void {
			const node = nodeOf(use.id, this.run.state);
			const paths = node === undefined ? undefined : pathsAt(node, this.run);
			if(node !== undefined && paths?.length === 1 && paths[0].path.length === 0) {
				const read = termOf(node, this.run.scope, this.run.state);
				if(read?.kind === 'formal') {
					this.run.read.add(read.name);
				}
			}
		}

		protected override visitFunctionCall(vertex: DataflowGraphVertexFunctionCall): void {
			const node = nodeOf(vertex.id, this.run.state);
			if(node !== undefined && !RSymbol.is(node)) {
				callRequirements(node, vertex, this.run);
			}
		}
	};
}

/** What the call asks of the formals on every way it is reached, its arguments being asked of where the control flow evaluates them. */
function callRequirements(this: void, node: RNodeWithParent, vertex: DataflowGraphVertexFunctionCall, run: Run): void {
	const { state } = run;
	const id = node.info.id;
	const call = RFunctionCall.is(node) ? node : undefined;
	if(RIfThenElse.is(node) || RForLoop.is(node) || RWhileLoop.is(node) || (RBinaryOp.is(node) && (node.operator === '&&' || node.operator === '||') && knownNameOf(id, vertex, state) !== undefined)) {
		return;
	} else if(call !== undefined && runsBuiltIn(vertex, BuiltInProcName.Stop)) {
		eachPath(node, run, path => addClause(run, path, GuardTerm.False, id, { kind: 'explicit', ...(messageOf(node) === undefined ? {} : { message: messageOf(node) }) }));
		return;
	} else if(call !== undefined && runsBuiltIn(vertex, BuiltInProcName.StopIfNot)) {
		return;
	} else if(call !== undefined && runsBuiltIn(vertex, BuiltInProcName.Return)) {
		const [value] = call.arguments;
		const returned = value === undefined || value === EmptyArgument ? undefined : value.value;
		eachPath(node, run, path => returnsValue(returned === undefined ? NullValue : termOf(returned, run.scope, state), path, run));
		return;
	} else if(call === undefined && !RBinaryOp.is(node) && !RUnaryOp.is(node) && !RAccess.is(node) && !RPipe.is(node)) {
		return;
	}
	const name = knownNameOf(id, vertex, state);
	if(call !== undefined && name === 'switch') {
		return;
	} else if(call !== undefined && name === 'UseMethod') {
		eachPath(node, run, path => {
			dispatchRequirement(call, path, run);
			/* whichever method it finds, flowR does not know what that does */
			returnsValue(undefined, path, run);
		});
		return;
	} else if(call !== undefined && !RFunctionCall.isNamed(call)) {
		return;
	}
	const target = soleCallee(id, state);
	eachPath(node, run, path => {
		if(target !== undefined) {
			inherit(target, vertex, path, run);
			return;
		}
		if(call !== undefined && RFunctionCall.isNamed(call) && name === undefined) {
			calledFormal(call, path, run);
		}
		if(name !== undefined) {
			if(name === 'NextMethod' && call !== undefined) {
				dispatchedContracts(call, DfgVertex.hasOrigin(vertex, BuiltInProcName.S3DispatchNext) ? vertex : undefined, undefined, path, run);
			}
			operatorMethods(name, vertex, path, run);
			builtInRequirements(name, vertex, path, run);
			if(name === 'get') {
				getRequirement(node, path, run);
			} else if(state.facts(name)?.check !== undefined) {
				checkRequirement(name, node, vertex, path, run);
			}
		}
	});
}

/** A condition of a `stopifnot` has to hold. */
function conditionClause(this: void, expression: RNodeWithParent, vector: boolean, run: Run): void {
	/* `stopifnot("x must be positive" = x > 0)` */
	const named = vector ? RNode.directParent(expression, run.state.graph.idMap as AstIdMap) : undefined;
	const message = RArgument.is(named) ? named.name?.content : undefined;
	eachPath(expression, run, path => {
		const term = termOf(expression, run.scope, run.state);
		if(term !== undefined) {
			addClause(run, path, GuardTerm.truth(term, true, run.state.facts, vector), expression.info.id, { kind: 'explicit', ...(message === undefined ? {} : { message: String(message) }) });
		}
	});
}

/** What the body hands back at its end, on every way it gets there: the value of the node, or `NULL` for an `if` without an `else` that is not taken. */
function tailReturns(this: void, run: Run): void {
	const { state } = run;
	for(const [id, tail] of run.tails) {
		const node = nodeOf(id, state);
		if(node === undefined) {
			continue;
		} else if(tail === Tail.Elseless && RIfThenElse.is(node)) {
			eachPath(node.condition, run, path => returnsValue(NullValue, [...path, stepsOf(termOf(node.condition, run.scope, state), state.facts)[1]], run));
		} else if(tail === Tail.Value && !endsRun(node, state)) {
			eachPath(node, run, path => returnsValue(termOf(node, run.scope, state), path, run));
		}
	}
}

/** Whether the node never hands back a value of its own, as it raises an error or returns from the function. */
function endsRun(this: void, node: RNodeWithParent, state: GuardState): boolean {
	const vertex = callVertexOf(node.info.id, state);
	return runsBuiltIn(vertex, BuiltInProcName.Stop) || runsBuiltIn(vertex, BuiltInProcName.Return) || (vertex !== undefined && knownNameOf(node.info.id, vertex, state) === 'UseMethod');
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
	const order = run.order = orderOf(run);
	new (guardVisitor())(run).walk();
	tailReturns(run);
	state.depth--;
	const demanded = new Set([...run.clauses.values()].flatMap(c => demandsPresenceOf(c.requires, state.facts)));
	const contract: Contract = {
		clauses:  withoutImplied(GuardTerm.resolved(withUnitsApplied([...run.clauses.values()], state.facts), c => c.requires, mergeClauses), scope, state.facts),
		required: scope.definition.parameters.filter(p => demanded.has(p.name.content) || (p.defaultValue === undefined && run.read.has(p.name.content))).map(p => p.name.content),
		effects:  order.effects.size > 0 || order.effectfulDefaults,
		opens:    order.openers.size > 0,
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
	return { graph, info: builtInLookup(ctx), facts: guardFactsOf(ctx), contracts: new Map(), terms: new Map(), bindings, bindsFunction, methodClasses, depth: 0, ctx: ctx ?? contextFromInput('') };
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
