/**
 * The `FunctionSemantics` facade wires these together, so a sibling here has to call the backing function directly; going through `FunctionSemantics` would make `src/dataflow/fn/function-semantics.ts` import its own importers.
 * @lintIgnore use-instead
 */
import type { DataflowGraph } from '../../graph/graph';
import { FunctionArgument } from '../../graph/graph';
import { Dataflow } from '../../graph/df-helper';
import { OriginType } from '../../origin/dfg-get-origin';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../../graph/vertex';
import { DfgVertex } from '../../graph/vertex';
import { ArgProp, CallProp, CallProps, ImpureProps, SemanticCallTag, type ArgProps, type FnSig } from '../../environments/built-in-props';
import { Identifier, type BrandedIdentifier, type BrandedNamespace } from '../../environments/identifier';
import { BuiltInProcName } from '../../environments/built-in-proc-name';
import { builtInLookup } from '../../environments/query-fn-props';
import { MatchArgs } from '../../graph/match-args';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { RFunctionCall, EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RParameter } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { bindsOutside, type BuiltInLookup } from '../frame-reflection';
import { definitionsBehind } from '../higher-order-function';
import { memoize } from '../../../util/collections/defaultmap';
import { GuardTerm, type GuardArgument, type GuardBinding, type GuardCall, type GuardConstant } from './guard-term';
import { Appliers, Asserting, callable, CheckingCalls, composesName, condition, getAsExists, logicalOperand, Measures, Requirements, succeeds, TypePredicates } from './guard-knowledge';
import { claimsOf, impliedBy, type ClaimedName, type FormalClaim } from './guard-claims';

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
	/** what the failure says, if it is a literal message */
	readonly message?: string
}

/** What a function asks for of the calls it can return from, see {@link guardsOfFunctions}. */
export interface FunctionGuards {
	/** every condition found */
	readonly clauses:  readonly GuardClause[]
	/** per formal, what the conditions say about it */
	readonly formals:  Readonly<Record<BrandedIdentifier, FormalClaim>>
	/** the formals a call has to supply, as it fails otherwise */
	readonly required: readonly BrandedIdentifier[]
	/** all conditions in R syntax, an empty string if there are none */
	readonly requires: string
	/** the conditions that fail before any side effect in R syntax, an empty string if there are none: the tightest precondition that guarantees a clean failure */
	readonly pure:     string
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
}

const NoContract: Contract = { clauses: [], required: [], effects: true, opens: false };

/** What to ask for beyond the definitions, see {@link guardsOfFunctions}. */
export interface FunctionGuardsOptions {
	/** how to ask what a built-in states, so a configured or overwritten one answers */
	readonly ctx?: ReadOnlyFlowrAnalyzerContext
}

/** What one run shares between the definitions it answers. */
interface GuardState {
	readonly graph:         DataflowGraph
	readonly info:          BuiltInLookup
	readonly contracts:     Map<NodeId, Contract>
	/** every name the program binds with where it does so */
	readonly bindings:      ReturnType<typeof Dataflow.definitionsByName>
	/** whether the program binds the name to a function, which lets a call of a name other than a formal succeed */
	readonly bindsFunction: (name: BrandedIdentifier) => boolean
	/** how many contracts are being worked out right now */
	depth:                  number
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
}

/** The one walk through the body of a function. */
interface Run {
	readonly scope:   Scope
	readonly state:   GuardState
	readonly clauses: Map<string, GuardClause>
	/** the formals read without any condition */
	readonly read:    Set<BrandedIdentifier>
	/** the nodes writing to the frame behind the back of the dataflow, see {@link frameOpeners} */
	readonly openers: ReadonlySet<NodeId>
	/** whether anything but computing a value may have happened by now */
	effects:          boolean
}

/** How deep local definitions and predicates are followed. */
const MaxTermDepth = 8;
/** How deep calls are followed, far beyond what code does and well before the stack ends. */
const MaxCalleeDepth = 256;

/** The packages whose functions flowR knows the semantics of when they come with their name. */
const BaseNamespaces: ReadonlySet<BrandedNamespace> = new Set(['base', 'stats', 'utils', 'methods']);

/** The calls that do not do anything but compute, whatever the configuration states about them. */
const ComputesOnly: ReadonlySet<BrandedIdentifier> = new Set([
	'inherits', 'identical', 'isTRUE', 'isFALSE', 'all', 'anyNA', 'typeof', 'mode', 'storage.mode', 'is', 'nzchar', 'class', 'oldClass', 'c', 'stopifnot', 'invisible', 'list', 'names', 'dim', 'exists', 'match.arg', 'arg_match', 'arg_match0',
	'seq_len', 'seq_along', 'xor', '|>', 'all.equal', 'nargs', '...length', '...elt', 'hasArg', '-', '+', '*', '/', '^', '%%', '%/%', '%in%', '%*%', ':', '$', '[', '[[', '@',
	...Object.keys(TypePredicates), ...Measures, ...Object.keys(CheckingCalls)
]);

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
function packageOf(this: void, name: BrandedIdentifier): BrandedNamespace | undefined {
	return CheckingCalls[name]?.pkg ?? Asserting[name]?.pkg ?? (name in TypePredicates && name.startsWith('is_') ? 'rlang' : undefined);
}

/** The name of the function a call runs, if it is what R or the named package ships with rather than something the program defines. */
function knownNameOf(this: void, id: NodeId, vertex: DataflowGraphVertexFunctionCall, state: GuardState): BrandedIdentifier | undefined {
	/* an operator linked to the `Ops` methods of the program still is the operator, a function the program names the same way is not */
	if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Function) && Dataflow.origin(state.graph, id)?.some(o => o.type !== OriginType.BuiltInFunctionOrigin)) {
		return undefined;
	}
	const qualified = Dataflow.qualify(id, state.graph, false) ?? vertex.name;
	const namespace = Identifier.getNamespace(qualified) ?? Identifier.getNamespace(vertex.name);
	const name = Identifier.getName(vertex.name);
	const pkg = packageOf(name);
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
	return ComputesOnly.has(name) || CallProps.hasAny(info, CallProp.Pure);
}

/** Whether the name comes with R rather than with one of the packages flowR knows the checks of. */
function isBaseName(this: void, name: BrandedIdentifier): boolean {
	return packageOf(name) === undefined;
}

/** Whether every call within the term is one flowR knows computes nothing but its value, so it may stand in where a variable was read. */
function isPureTerm(this: void, term: GuardTerm, state: GuardState): boolean {
	if(!GuardTerm.isCall(term)) {
		return true;
	}
	const pure = term.known === true && (ComputesOnly.has(GuardTerm.bareName(term.fn)) || CallProps.hasAny(state.info(term.fn), CallProp.Pure));
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
	const origins = Dataflow.origin(state.graph, node.info.id);
	if(origins === undefined || origins.length === 0) {
		/* no call links the read yet */
		return onceBoundLiteral(name, scope, state, depth) ?? { kind: 'free', name };
	} else if(origins.length > 1) {
		return isFormalName(name, scope) || origins.some(o => scope.vertex.subflow.graph.has(o.id)) ? undefined : { kind: 'free', name };
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
	return { definition, vertex, formals: new Map(definition.parameters.filter(p => !p.special).map(p => [p.name.info.id, p.name.content])), frameIsOpen: false };
}

/** What the given arguments of the call bind the formals of the callee to, seen from the caller, with whether that leaves no formal unbound. */
function bindingOfArguments(this: void, vertex: DataflowGraphVertexFunctionCall, args: DataflowGraphVertexFunctionCall['args'], callee: Scope, scope: Scope, state: GuardState, depth: number): { readonly binding: GuardBinding, readonly complete: boolean } {
	const binding = new Map<BrandedIdentifier, GuardTerm>();
	const names = callee.definition.parameters.map(p => p.special ? '...' : p.name.content);
	const spec: Record<BrandedIdentifier, BrandedIdentifier> = Object.fromEntries(names.map(n => [n, n]));
	const matched = MatchArgs.toSpec<BrandedIdentifier>(args, spec);
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
	const names = callee.definition.parameters.map(p => p.name.content);
	const args = MatchArgs.handsOnDots(vertex.args, state.graph) ? vertex.args.filter(a => FunctionArgument.isNamed(a) && names.includes(a.name)) : vertex.args;
	return bindingOfArguments(vertex, args, callee, scope, state, depth).binding;
}

/** What the arguments of a call handing on dots bind if the dots name nothing, which only keeps the arguments in front of the dots in place. */
function bindingBesidesDots(this: void, vertex: DataflowGraphVertexFunctionCall, callee: Scope, scope: Scope, state: GuardState): ReturnType<typeof bindingOfArguments> | undefined {
	const dots = vertex.args.findIndex(a => MatchArgs.handsOnDots([a], state.graph));
	if(dots < 0) {
		return undefined;
	}
	const names = callee.definition.parameters.map(p => p.name.content);
	return bindingOfArguments(vertex, vertex.args.filter((a, at) => at < dots || (FunctionArgument.isNamed(a) && names.includes(a.name))), callee, scope, state, 0);
}

/** Whether something the dots hand on bears a name, which only the function holding the dots can tell. */
const DotsBearNames = GuardTerm.known('!', GuardTerm.known('is.null', { kind: 'free', name: '...names()' }));
const DotsBearNamesText = GuardTerm.render(DotsBearNames);

/** Whether the call hands the dots of the callee an argument bearing a name, which no formal of it takes. */
function hasNamedExtras(this: void, vertex: DataflowGraphVertexFunctionCall, callee: Scope): boolean {
	const names = callee.definition.parameters.map(p => p.name.content);
	return vertex.args.some(a => FunctionArgument.isNamed(a) && !names.some(n => n.startsWith(a.name)));
}

/** The node of the value of an argument, a named argument being bound by the node that names it. */
function valueOfArgument(this: void, argument: NodeId, vertex: DataflowGraphVertexFunctionCall, state: GuardState): RNodeWithParent | undefined {
	const named = vertex.args.find(a => FunctionArgument.isNamed(a) && a.nodeId === argument);
	return nodeOf(named !== undefined && FunctionArgument.isNamed(named) && named.valueId !== undefined ? named.valueId : argument, state);
}

/** A call of a program's own function as what its single expression says, which is how a predicate like `is_count(x)` is seen through. */
function inlined(this: void, id: NodeId, vertex: DataflowGraphVertexFunctionCall, scope: Scope, state: GuardState, depth: number): GuardTerm | undefined {
	const target = soleCallee(id, state);
	const callee = target === undefined || depth >= MaxTermDepth ? undefined : scopeOf(target, state);
	const body = callee === undefined ? undefined : singleExpression(callee.definition, state);
	const term = callee === undefined || body === undefined ? undefined : termOf(body, callee, state, depth + 1);
	return term === undefined || callee === undefined ? undefined : GuardTerm.substitute(term, bindingOf(vertex, callee, scope, state, depth + 1));
}

function callTerm(this: void, id: NodeId, fn: string, args: readonly GuardArgument[], state: GuardState): GuardCall {
	const vertex = callVertexOf(id, state);
	const known = vertex === undefined ? undefined : knownNameOf(id, vertex, state);
	/* what R ships with reads the same with or without the namespace, the rest keeps it to still be what the code says */
	return known === undefined ? { kind: 'call', fn, args } : { kind: 'call', fn: isBaseName(known) ? GuardTerm.bareName(fn) : fn, args, known: true };
}

/** The expression as a term in the formals of the function it is written in, `undefined` if it depends on what cannot be stated in them. */
function termOf(this: void, node: RNodeWithParent, scope: Scope, state: GuardState, depth = 0): GuardTerm | undefined {
	switch(node.type) {
		case RType.Number:
			return { kind: 'constant', lexeme: node.lexeme ?? String(node.content.num), value: node.content.num };
		case RType.Logical:
			return node.content ? GuardTerm.True : GuardTerm.False;
		case RType.String:
			return { kind: 'constant', lexeme: node.lexeme ?? JSON.stringify(node.content.str), value: node.content.str };
		case RType.Symbol:
			return symbolTerm(node, scope, state, depth);
		case RType.ExpressionList:
			return node.children.length === 1 ? termOf(node.children[0], scope, state, depth) : undefined;
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
	const all = GuardTerm.any(...path.map(step => step.fails), condition);
	if(run.scope.frameIsOpen) {
		return;
	}
	for(const requires of GuardTerm.conjuncts(all)) {
		if(GuardTerm.isTrue(requires) || asksNothingOfCalls(requires, run.state)) {
			continue;
		}
		const rendered = GuardTerm.render(requires);
		const known = run.clauses.get(rendered);
		const pure = (extra.pure ?? true) && !run.effects;
		/* the same condition may come up again in a place that is purer than where it was seen first */
		if(known === undefined || (!known.pure && pure)) {
			run.clauses.set(rendered, { requires, rendered, at, ...extra, pure });
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
	for(const node of nodes) {
		const here = walk(node, current, run);
		exits.push(...here);
		const next = afterExits(current, here);
		if(next === undefined) {
			break;
		}
		current = next;
	}
	return exits;
}

/** The calls that hand out a frame or write to one in a way flowR does not see, besides what states {@link SemanticCallTag.Frames}. */
const OpensFrame: ReadonlySet<BrandedIdentifier> = new Set(['rm', 'remove', 'list2env', 'makeActiveBinding', 'eval', 'evalq', 'eval.parent', 'source', 'sys.source', 'attach', 'sys.frame', 'sys.frames', 'as.environment', 'env_poke', 'env_bind', 'caller_env', 'current_env']);

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
			if(OpensFrame.has(name) || CallProps.hasAny(state.info(vertex.name), SemanticCallTag.Frames) || assignsComputedName(name, vertex, state)) {
				openers.add(id);
			}
		}
	});
	return openers;
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
		if(runsBuiltIn(vertex, BuiltInProcName.Return) || Identifier.getName(vertex.name) === 'return_from') {
			exits.push({ path: [...path, UnknownStep], kind: 'return' });
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

function stepsOf(this: void, term: GuardTerm | undefined): readonly [PathStep, PathStep] {
	if(term === undefined) {
		return [UnknownStep, UnknownStep];
	}
	const [holds, fails] = [GuardTerm.truth(term, true), GuardTerm.truth(term, false)];
	return [{ holds, fails }, { holds: fails, fails: holds }];
}

/** The formal the given expression holds, directly or through a local. */
function formalOfNode(this: void, node: RNodeWithParent, run: Run): GuardTerm | undefined {
	const term = RType.Symbol === node.type ? termOf(node, run.scope, run.state) : undefined;
	return term?.kind === 'formal' ? term : undefined;
}

function walkIf(this: void, condNode: RNodeWithParent, then: RNodeWithParent, otherwise: RNodeWithParent | undefined, path: Path, run: Run): Exit[] {
	const before = walk(condNode, path, run);
	const atCondition = afterExits(path, before);
	if(atCondition === undefined) {
		return before;
	}
	const term = termOf(condNode, run.scope, run.state);
	const formal = formalOfNode(condNode, run);
	if(formal !== undefined) {
		addClause(run, atCondition, condition(formal), condNode.info.id, { kind: 'implicit' });
	}
	const [yes, no] = stepsOf(term);
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

function messageOf(this: void, node: RNodeWithParent): string | undefined {
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
			addClause(run, current, GuardTerm.truth(term, true, vector), expression.info.id, { kind: 'explicit', ...(message === undefined ? {} : { message: String(message) }) });
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
	const forcedIds = new Set(sig.filter(([, props]) => (props & ArgProp.Forced) !== 0).flatMap(([formal]) => bound.get(formal) ?? []));
	return { forced: values.filter(v => forcedIds.has(v)), lazy: values.filter(v => !forcedIds.has(v)) };
}

/** What the call of a built-in asks of what it was handed, on top of evaluating it. */
function builtInRequirements(this: void, name: BrandedIdentifier, vertex: DataflowGraphVertexFunctionCall, path: Path, run: Run): void {
	const { state, scope } = run;
	const requirements = Requirements[name];
	const applied = Appliers[name];
	if(requirements === undefined && applied === undefined) {
		return;
	}
	const sig = state.info(vertex.name)?.sig;
	const formals = sig?.map(([formal]) => formal) ?? [...Object.keys(requirements ?? {}), ...(applied === undefined ? [] : [applied])];
	const bound = boundArguments(vertex, formals, state);
	const add = (condition: GuardTerm) => addClause(run, path, condition, vertex.id, { kind: 'implicit' });
	const termOfNode = (n: RNodeWithParent) => termOf(n, scope, state);
	/* an operator also dispatches on its other operand, which has to be stated to be ruled out */
	const operands = requirements !== undefined && Object.keys(requirements).length === 2 ? [...bound.values()].flat() : [];
	for(const [formal, requirement] of Object.entries(requirements ?? {})) {
		for(const value of bound.get(formal) ?? []) {
			const term = termOfNode(value);
			if(term?.kind === 'formal' && requirement !== undefined) {
				const otherNode = operands.find(o => o !== value);
				const other = otherNode === undefined ? undefined : termOfNode(otherNode);
				if(otherNode === undefined || other !== undefined) {
					add(requirement(term, other));
				}
			}
		}
	}
	const handed = applied === undefined ? undefined : bound.get(applied)?.[0];
	const term = handed === undefined ? undefined : termOfNode(handed);
	if(term !== undefined) {
		add(callable(term, n => isDefined(n, state)));
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
	const check = CheckingCalls[name];
	if(!GuardTerm.isCall(term) || check.defers?.some(d => term.args.some(a => a.name === d))) {
		return;
	}
	const [first] = term.args;
	if(first === undefined) {
		return;
	}
	let call: GuardCall = term;
	if((name === 'match.arg' || name === 'arg_match') && term.args.length === 1 && first.value.kind === 'formal') {
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
	const contract = contractOf(target, state);
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
	for(const clause of contract.clauses) {
		const inherited = { kind: clause.kind, pure: clause.pure, via: [vertex.id, ...clause.via ?? []], ...(clause.message === undefined ? {} : { message: clause.message }) };
		/* a call handing nothing on leaves the dots of the callee without a name */
		const asked = MatchArgs.handsOnDots(vertex.args, state.graph) || hasNamedExtras(vertex, callee) ? clause.requires : GuardTerm.any(...GuardTerm.disjuncts(clause.requires).filter(d => GuardTerm.render(d) !== DotsBearNamesText));
		const requires = GuardTerm.substituteCondition(asked, binding, outer);
		if(GuardTerm.formalsOf(requires).size > 0 || GuardTerm.isFalse(requires)) {
			addClause(run, path, requires, clause.at, inherited);
		}
		if(besides !== undefined && !besides.complete) {
			const unlessNamed = GuardTerm.substituteCondition(asked, besides.binding, outer);
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

/** What flowR can say about the `UseMethod` of the function: it has to find a method. */
function dispatchRequirement(this: void, node: RFunctionCall<ParentInformation>, path: Path, run: Run): void {
	const { state, scope } = run;
	const [generic] = node.arguments;
	const value = generic === EmptyArgument ? undefined : generic?.value;
	/* flowR turns a name standing for the generic into the dispatching call itself, which leaves nothing to read */
	const named = RSymbol.is(value) ? onceBoundLiteral(Identifier.getName(value.content), scope, state, 0) : undefined;
	const name = value === undefined ? undefined : GuardTerm.constantString(named ?? termOf(value, scope, state));
	const [first] = scope.definition.parameters;
	if(name === undefined || first === undefined || first.special || state.bindsFunction(`${name}.default`) || state.info(`${name}.default`) !== undefined) {
		return;
	}
	const call: GuardCall = { kind: 'call', fn: 'UseMethod', known: true, args: [{ value: GuardTerm.string(name) }, { value: GuardTerm.formal(first.name.content) }] };
	addClause(run, path, succeeds(call), node.info.id, { kind: 'implicit' });
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
		const asserting = Asserting[Identifier.getName(vertex.name)];
		const conditions = asserting === undefined ? stopIfNotConditions(call) : call.arguments.flatMap(a => a === EmptyArgument || a.value === undefined || asserting.options.has(a.name?.content ?? '') ? [] : [a.value]);
		return conditions === undefined ? skipped(node, path, run) : walkConditions(conditions, asserting === undefined, path, run);
	} else if(call !== undefined && runsBuiltIn(vertex, BuiltInProcName.Return)) {
		const [value] = call.arguments;
		const before = value === undefined || value === EmptyArgument || value.value === undefined ? [] : walk(value.value, path, run);
		return [...before, { path, kind: 'return' }];
	} else if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Try) || runsBuiltIn(vertex, BuiltInProcName.Local)) {
		return skipped(node, path, run);
	}
	const name = knownNameOf(id, vertex, state);
	if(call !== undefined && name === 'switch') {
		return walkSwitch(call, path, run);
	} else if(call !== undefined && name === 'UseMethod') {
		dispatchRequirement(call, path, run);
		/* whichever method it finds, flowR does not know what that does */
		run.effects = true;
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
		builtInRequirements(name, vertex, after, run);
		if(name === 'get') {
			getRequirement(node, after, run);
		} else if(CheckingCalls[name] !== undefined) {
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
	run.scope.frameIsOpen ||= run.openers.has(node.info.id);
	switch(node.type) {
		case RType.ExpressionList:
			return walkSequence(node.children, path, run);
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
			return runsBuiltIn(callVertexOf(node.info.id, run.state), BuiltInProcName.IfThenElse) ? walkIf(node.condition, node.then, node.otherwise, path, run) : skipped(node, path, run);
		case RType.ForLoop:
			return [...walk(node.vector, path, run), ...walkLoopBody(node.body, path, run)];
		case RType.WhileLoop:
			return [...walk(node.condition, path, run), ...walkLoopBody(node.body, path, run)];
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

function walkShortCircuit(this: void, operator: '&&' | '||', lhs: RNodeWithParent, rhs: RNodeWithParent, path: Path, run: Run): Exit[] {
	const before = walk(lhs, path, run);
	const atRight = afterExits(path, before);
	if(atRight === undefined) {
		return before;
	}
	const left = termOf(lhs, run.scope, run.state);
	if(left?.kind === 'formal') {
		addClause(run, atRight, logicalOperand(left), lhs.info.id, { kind: 'implicit' });
	}
	const [yes, no] = stepsOf(left);
	const rightPath = [...atRight, operator === '&&' ? yes : no];
	const right = termOf(rhs, run.scope, run.state);
	const after = branches(run, () => walk(rhs, rightPath, run), () => []);
	if(right?.kind === 'formal') {
		addClause(run, rightPath, logicalOperand(right), rhs.info.id, { kind: 'implicit' });
	}
	return [...before, ...after];
}

/** Takes out of a clause what another one rules out: `is.null(x) || is.numeric(x)` is `is.numeric(x)` once `!is.null(x)` holds, as code reads `if(is.null(x)) stop() else if(!is.numeric(x)) stop()`. */
function withUnitsApplied(this: void, clauses: readonly GuardClause[]): GuardClause[] {
	const isUnit = (term: GuardTerm) => !GuardTerm.isCall(term, '||');
	const units = new Set(clauses.filter(c => isUnit(c.requires)).map(c => GuardTerm.render(GuardTerm.truth(c.requires, false))));
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

/** The clauses without what R asks for that the function checked already, which adds nothing: `x > 0` needs no function to be ruled out after `is.numeric(x)`. */
function withoutImplied(this: void, clauses: readonly GuardClause[], scope: Scope): GuardClause[] {
	const explicit = clauses.filter(c => c.kind === 'explicit').map(c => c.requires);
	const formals = [...scope.formals.values()];
	return clauses.filter(c => c.kind === 'explicit' || !impliedBy(c.requires, explicit, formals));
}

/** The formals the condition asks to be there, as `!missing(x)` does, whether or not they come with a default. */
function demandsPresenceOf(this: void, condition: GuardTerm): BrandedIdentifier[] {
	if(!GuardTerm.isCall(condition) || !condition.known || (condition.fn !== '!' && condition.fn !== 'succeeds')) {
		return [];
	}
	const [{ value: inner }] = condition.args;
	const asked = GuardTerm.isCall(inner) && (condition.fn === '!' ? inner.fn === 'missing' : CheckingCalls[GuardTerm.bareName(inner.fn)]?.present) ? inner.args[0]?.value : undefined;
	return asked?.kind === 'formal' ? [asked.name] : [];
}

/** What the given definition asks of its calls. */
function contractOf(this: void, id: NodeId, state: GuardState): Contract {
	const known = state.contracts.get(id);
	if(known !== undefined) {
		return known;
	}
	const scope = state.depth > MaxCalleeDepth ? undefined : scopeOf(id, state);
	if(scope === undefined) {
		return NoContract;
	}
	/* a recursive call counts for nothing, which only ever leaves out what the recursion could have added */
	state.contracts.set(id, NoContract);
	state.depth++;
	const run: Run = { scope, state, clauses: new Map(), read: new Set(), openers: frameOpeners(scope.definition, state), effects: false };
	/* a default is evaluated on first read, wherever that is: one with a side effect leaves nothing clean */
	for(const { defaultValue } of scope.definition.parameters) {
		if(defaultValue !== undefined) {
			skipped(defaultValue, [], run);
		}
	}
	walk(scope.definition.body, [], run);
	state.depth--;
	const demanded = new Set([...run.clauses.values()].flatMap(c => demandsPresenceOf(c.requires)));
	const contract: Contract = {
		clauses:  withoutImplied(withUnitsApplied([...run.clauses.values()]), scope),
		required: scope.definition.parameters.filter(p => demanded.has(p.name.content) || (p.defaultValue === undefined && run.read.has(p.name.content))).map(p => p.name.content),
		effects:  run.effects,
		opens:    scope.frameIsOpen
	};
	state.contracts.set(id, contract);
	return contract;
}

function stateOf(this: void, graph: DataflowGraph, { ctx }: FunctionGuardsOptions): GuardState {
	const bindings = Dataflow.definitionsByName(graph);
	return { graph, info: builtInLookup(ctx), contracts: new Map(), bindings, bindsFunction: memoize(name => bindings.get(name).some(id => definitionsBehind(id, graph).size > 0)), depth: 0 };
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
		const { clauses, required } = contractOf(id, state);
		result[id] = {
			clauses,
			formals: withCandidates(claimsOf(clauses.map(c => c.requires), [...scope.formals.values()]), state),
			required,
			...summarizeClauses(clauses)
		};
	}
	return result;
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
