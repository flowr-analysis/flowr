/*
 * SimilaR: program dependence graph (PDG) based clone detection for R functions.
 * Bartoszuk and Gagolewski. "SimilaR: R Code Clone and Plagiarism Detection", The R Journal 12(1), 2020,
 * with the reference implementation https://github.com/bartoszukm/SimilaR (GPL-3.0, v1.0.8).
 *
 * The comparison follows the paper's description (section "SimilaR algorithm in detail"); where the paper is
 * silent we follow the reference implementation (src/pdgmykernelcomparator.cpp, src/CDG.cpp, src/postprocessingPDG.cpp).
 * The PDG is built on flowR's normalized AST, and its data dependencies come from flowR's dataflow graph instead of
 * SimilaR's own reaching-definition pass (which never kills a definition except for parameters).
 * Known deviations from the reference implementation, each to stay with the paper or to avoid a defect:
 * - call colors use the actual argument count of the paper's Table 1 (the code maps 0 and 1 argument to the same color)
 * - `repeat` loops get a header vertex, the code drops the whole loop
 * - the while-loop rewriting (`changeWhileLoop`) and the synthetic `length`/`colon`/`[[` vertices of for-each loops
 *   and map-like calls are not reproduced; a map-like call with a function literal becomes a loop header whose
 *   body is the function's body, the header defining the function's parameters
 * - neighbor labels distinguish data from control edges in every iteration (the code only does so in the first)
 * - vertices are paired over both whole graphs as the paper describes, not only at equal control depth
 * - the unmatched-neighbor test is the paper's (the importances of the unmatched neighbors of both vertices, each
 *   normalized by its own graph, summed, and at most `min(M_F, M_G)`); the code instead multiplies each side's sum by
 *   the number of unmatched neighbors, compares each side strictly against its own graph's threshold, and leaves an
 *   arbitrary surplus unmatched (its neighbor list is sorted by label only)
 * - every vertex starts with the importance 0.1 of the paper's formula; the code gives `stopifnot` vertices 0.1/3
 * - the result is always the mean over all `h` iterations as in Eq. (1); the code stops early once the label counts
 *   no longer change and averages over the iterations done so far
 * - there is no `return` vertex (Table 1, type 22): like the code, a tail `return(e)` is represented by `e` itself,
 *   which dead-code removal keeps as the function's last instruction
 * - the `!` of a condition is erased like in the code, and the operator families come from flowR's operator facts
 */
import { arraySum } from '../../util/collections/arrays';
import { RUnaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RPipe } from '../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { RNext } from '../../r-bridge/lang-4.x/ast/model/nodes/r-next';
import { RLineDirective } from '../../r-bridge/lang-4.x/ast/model/nodes/r-line-directive';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RComment } from '../../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { DfgVertex } from '../../dataflow/graph/vertex';
import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import { callFnProps } from '../../dataflow/environments/query-fn-props';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { CallProp, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { RawRType, RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RConstant, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { EmptyArgument, RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Identifier } from '../../dataflow/environments/identifier';
import type { CloneAst } from '../clone-ast';
import { BuiltInOperators, OperatorCategory } from '../../dataflow/environments/default-builtin-config/operators';

/** The vertex types of Table 1 of the paper, with its numbering. */
export const enum PdgColor {
	Entry = 0, Header, Next, Break, If, IfPart, Assignment, Parameter, OneBracketSingle, OneBracketDouble,
	OneBracketTripleOrMore, TwoBrackets, Dollar, FunNoArguments, FunOneArgument, FunTwoArguments, FunThreeArguments,
	FunFourOrMoreArguments, Stopifnot, LogicalOperator, ArithmeticOperator, ComparisonOperator, Return, Colon, Symbol, Constant
}

export const enum PdgEdge {
	Control = 0, Data = 1
}

/**
 * A program dependence graph: vertex colors, the AST node each vertex stems from, and edges as flat triples
 * `[source, target, PdgEdge]`. Vertex indices follow creation order, which the comparison relies on.
 */
export interface Pdg {
	readonly color: Uint8Array;
	/** the preorder index of the vertex's AST node in the file's clone AST, -1 if it has none there */
	readonly node:  Int32Array;
	readonly edges: Int32Array;
}

/** the colors `mergeTheSameInstructions` (src/postprocessingPDG.cpp) memoizes */
const Memoizable: ReadonlySet<PdgColor> = new Set([
	PdgColor.FunNoArguments, PdgColor.FunOneArgument, PdgColor.FunTwoArguments, PdgColor.FunThreeArguments, PdgColor.FunFourOrMoreArguments,
	PdgColor.OneBracketSingle, PdgColor.OneBracketDouble, PdgColor.TwoBrackets, PdgColor.ArithmeticOperator, PdgColor.LogicalOperator
]);
/** colors `removeSingleInstructions` (src/postprocessingPDG.cpp) never removes */
const KeepColors: ReadonlySet<PdgColor> = new Set([
	PdgColor.Break, PdgColor.Next, PdgColor.Dollar, PdgColor.OneBracketSingle, PdgColor.OneBracketDouble, PdgColor.OneBracketTripleOrMore, PdgColor.TwoBrackets
]);
type Node = RNode<ParentInformation>;

/** what flows into a consumer: PDG vertices, and symbol reads to resolve once all definitions are known */
interface Sources {
	readonly vertices: number[];
	readonly reads:    NodeId[];
}

function noSources(): Sources {
	return { vertices: [], reads: [] };
}

function calleeName(call: Node): string | undefined {
	const name = RFunctionCall.calledName(call);
	return name === undefined ? undefined : Identifier.getName(name);
}

function argValues(args: readonly (Node | typeof EmptyArgument)[]): (Node | undefined)[] {
	return args.map(a => a === EmptyArgument ? undefined : RArgument.is(a) ? a.value : a);
}

/** the name and operands of an operator or call, as a call would have them */
function callParts(e: Node): [name: string, operands: (Node | undefined)[]] {
	switch(e.type) {
		case RType.BinaryOp: return [e.operator, [e.lhs, e.rhs]];
		case RType.Pipe: return ['|>', [e.lhs, e.rhs]];
		case RType.UnaryOp: return [e.operator, [e.operand]];
		case RType.FunctionCall: return [calleeName(e) ?? '', argValues(e.arguments)];
		default: return ['', []];
	}
}

function isCallLike(n: Node): boolean {
	return RFunctionCall.is(n) || RBinaryOp.is(n) || RUnaryOp.is(n) || RPipe.is(n) || RAccess.is(n);
}

function isConstant(n: Node): boolean {
	return RConstant.is(n) || RSymbol.isSpecial(n);
}

/** unwraps `(e)` and `{e}` */
function unwrap(n: Node): Node {
	while(RExpressionList.is(n) && n.children.length === 1) {
		n = n.children[0];
	}
	return n;
}

function statements(n: Node): readonly Node[] {
	if(RExpressionList.is(n)) {
		return n.children.filter(c => !RComment.is(c) && !RLineDirective.is(c));
	}
	return [n];
}

class PdgBuilder {
	readonly color:   PdgColor[] = [];
	readonly ast:     NodeId[] = [];
	readonly name:    string[] = [];
	readonly last:    boolean[] = [];
	/** calls that must survive dead-code removal */
	readonly effect:  boolean[] = [];
	readonly control: [number, number][] = [];
	readonly data:    [number, number][] = [];
	/** symbol reads to resolve into data edges: [read symbol, consumer] */
	readonly pending: [NodeId, number][] = [];
	/** definition id (as the dataflow graph names it) to the vertices that define it */
	readonly defs = new Map<NodeId, number[]>();
	/** definitions that are aliases (`x <- y`): resolved through the reads of `y` */
	readonly aliases = new Map<NodeId, NodeId[]>();
	readonly memo = new Map<string, number>();

	constructor(private readonly graph: DataflowGraph, private readonly environment: REnvironmentInformation | undefined) {}

	/** whether the dataflow graph resolved the call at `node` to the built-in processor `origin` */
	is(node: Node | undefined, origin: BuiltInProcName): boolean {
		return node !== undefined && DfgVertex.hasOrigin(this.graph.getVertex(node.info.id), origin);
	}

	/**
	 * Whether a call must survive dead-code removal although nothing uses its value. SimilaR keeps a fixed list
	 * of side-effecting functions (`isSideEffectFunction`); we ask flowR what it knows about the call instead:
	 * unknown side effects, exit hooks, ambient state writes (options, devices, ...), and the stated call props.
	 */
	hasSideEffect(node: Node): boolean {
		const id = node.info.id;
		if(this.graph.unknownSideEffects.has(id) || this.is(node, BuiltInProcName.RegisterHook) || (this.graph.ambientAccessOf(id)?.writes.length ?? 0) > 0) {
			return true;
		}
		const stated = callFnProps(id, this.graph, this.environment);
		const has = FunctionSemantics.call.props.hasAny;
		return has(stated, [SemanticCallTag.Graphics, SemanticCallTag.Prints, CallProp.Configures, CallProp.Throws])
			|| FunctionSemantics.call.props.hasAll(stated, [SemanticCallTag.File, SemanticCallTag.Writes]);
	}

	/** a branch "returns" if one of its top-level statements returns or stops (SimilaR's `isReturnBranch`) */
	isReturnBranch(branch: Node): boolean {
		return statements(branch).some(s => {
			const u = unwrap(s);
			return this.is(u, BuiltInProcName.Return) || this.is(u, BuiltInProcName.Stop);
		});
	}

	/** the vertex type of Table 1 for a call, from what flowR knows about it */
	callColor(e: Node, name: string, args: number): PdgColor {
		if(RAccess.isIndex(e)) {
			return e.operator === '[[' ? PdgColor.TwoBrackets
				: args <= 2 ? PdgColor.OneBracketSingle : args === 3 ? PdgColor.OneBracketDouble : PdgColor.OneBracketTripleOrMore;
		} else if(RAccess.isNamed(e)) {
			return PdgColor.Dollar;
		} else if(this.is(e, BuiltInProcName.StopIfNot)) {
			return PdgColor.Stopifnot;
		}
		const operator = BuiltInOperators.byName[name];
		if(operator?.stringUsedInRAst === RawRType.Colon) {
			return PdgColor.Colon;
		}
		switch(operator?.category) {
			case OperatorCategory.Arithmetic: return PdgColor.ArithmeticOperator;
			case OperatorCategory.Logical:    return PdgColor.LogicalOperator;
			case OperatorCategory.Comparison: return PdgColor.ComparisonOperator;
		}
		return args === 0 ? PdgColor.FunNoArguments : args === 1 ? PdgColor.FunOneArgument : args === 2 ? PdgColor.FunTwoArguments
			: args === 3 ? PdgColor.FunThreeArguments : PdgColor.FunFourOrMoreArguments;
	}

	vertex(color: PdgColor, node: Node | undefined, control: number, name = ''): number {
		const v = this.color.length;
		this.color.push(color);
		this.ast.push(node?.info.id ?? -1);
		this.name.push(name);
		this.last.push(false);
		this.effect.push(node !== undefined && isCallLike(node) && this.hasSideEffect(node));
		if(control >= 0) {
			this.control.push([control, v]);
		}
		return v;
	}

	flow(sources: Sources, target: number): void {
		for(const s of sources.vertices) {
			this.data.push([s, target]);
		}
		for(const r of sources.reads) {
			this.pending.push([r, target]);
		}
	}

	define(defId: NodeId, vertex: number): void {
		const list = this.defs.get(defId);
		if(list) {
			list.push(vertex);
		} else {
			this.defs.set(defId, [vertex]);
		}
	}

	/** the definitions a symbol read sees */
	readsOf(symbol: NodeId): NodeId[] {
		const out: NodeId[] = [];
		for(const [target, edge] of this.graph.edgesFrom(symbol)) {
			if(DfEdge.includesType(edge, EdgeType.Reads)) {
				out.push(target);
			}
		}
		return out;
	}

	/** the memoization key of a call: color, name, and its arguments (vertices, definitions read, or constants) */
	memoKey(color: PdgColor, name: string, args: readonly string[]): string | undefined {
		return Memoizable.has(color) ? `${color}|${name}|${args.join(',')}` : undefined;
	}

	/** describes an argument for memoization */
	argKey(arg: Node | undefined, sources: Sources): string {
		if(arg === undefined) {
			return '_';
		}
		if(sources.vertices.length === 0 && sources.reads.length === 0) {
			return isConstant(arg) ? `c${arg.lexeme ?? ''}` : '?';
		}
		const defs = sources.reads.flatMap(r => this.readsOf(r)).map(String).sort();
		return `v${sources.vertices.join('.')}r${defs.join('.')}`;
	}

	// ----- statements -----

	statements(list: readonly Node[], control: number, isLast: boolean, loopHeader: number): void {
		for(let i = 0; i < list.length; i++) {
			this.statement(list[i], control, isLast && i === list.length - 1, loopHeader);
		}
	}

	statement(s: Node, control: number, isLast: boolean, loopHeader: number): void {
		switch(s.type) {
			case RType.Comment:
			case RType.LineDirective:
				return;
			case RType.ExpressionList:
				return this.statements(statements(s), control, isLast, loopHeader);
			case RType.Symbol:
				if(isLast && !isConstant(s)) {
					const v = this.vertex(PdgColor.Symbol, s, control);
					this.last[v] = true;
					this.pending.push([s.info.id, v]);
				} else if(isLast) {
					this.last[this.vertex(PdgColor.Constant, s, control)] = true;
				}
				return;
			case RType.Number:
			case RType.String:
			case RType.Logical:
				if(isLast) {
					this.last[this.vertex(PdgColor.Constant, s, control)] = true;
				}
				return;
			case RType.IfThenElse:
				return this.ifStatement(s, control, isLast, loopHeader);
			case RType.ForLoop: {
				const seq = this.expression(s.vector, control);
				const header = this.vertex(PdgColor.Header, s, control, 'for');
				this.flow(seq, header);
				this.define(s.variable.info.id, header);
				this.statements(statements(s.body), header, false, header);
				return;
			}
			case RType.WhileLoop: {
				const cond = this.expression(s.condition, control);
				const header = this.vertex(PdgColor.Header, s, control, 'while');
				this.flow(cond, header);
				this.statements(statements(s.body), header, false, header);
				return;
			}
			case RType.RepeatLoop: {
				const header = this.vertex(PdgColor.Header, s, control, 'repeat');
				this.statements(statements(s.body), header, false, header);
				return;
			}
			case RType.Next:
			case RType.Break: {
				this.vertex(RNext.is(s) ? PdgColor.Next : PdgColor.Break, s, control);
				if(loopHeader >= 0 && loopHeader !== control) {
					// `makeStructuredTransfersOfControlForLoop`: the branch containing the jump controls the loop
					this.control.push([control, loopHeader]);
				}
				return;
			}
			case RType.FunctionCall: {
				const args = argValues(s.arguments);
				if(this.is(s, BuiltInProcName.Return) && args.length <= 1) {
					const a = args[0];
					if(a === undefined || isConstant(unwrap(a))) {
						this.last[this.vertex(PdgColor.Constant, a ?? s, control)] = true;
						return;
					}
					return this.statement(a, control, true, loopHeader);
				}
				break;
			}
		}
		const out = this.expression(s, control);
		if(isLast) {
			for(const v of out.vertices) {
				this.last[v] = true;
			}
			if(out.vertices.length === 0 && out.reads.length > 0) {
				const v = this.vertex(PdgColor.Symbol, s, control);
				this.last[v] = true;
				this.flow(out, v);
			}
		}
	}

	/**
	 * `if`, with the paper's canonicalization: if exactly one branch returns (or both, then the smaller one),
	 * only that branch stays conditional and the other one is emitted after the `if`, as `if (c) return(A); B`.
	 * A tail `if`/`else` is always treated as if both branches returned.
	 */
	ifStatement(s: Node & { type: RType.IfThenElse }, control: number, isLast: boolean, loopHeader: number): void {
		const cond = this.expression(s.condition, control);
		const ifVertex = this.vertex(PdgColor.If, s, control, 'if');
		this.flow(cond, ifVertex);
		const branch = (b: Node, last: boolean) => {
			const part = this.vertex(PdgColor.IfPart, b, ifVertex, 'if_part');
			this.flow(cond, part);
			this.statements(statements(b), part, last, loopHeader);
		};
		if(!s.otherwise) {
			branch(s.then, isLast);
			return;
		}
		const rIf = isLast || this.isReturnBranch(s.then);
		const rElse = isLast || this.isReturnBranch(s.otherwise);
		const sizeIf = RNode.collectAllIds(s.then).size, sizeElse = RNode.collectAllIds(s.otherwise).size;
		const thenPart = (!rIf && !rElse) || (rIf && !rElse) || (rIf && rElse && sizeIf < sizeElse);
		const elsePart = (!rIf && !rElse) || (!rIf && rElse) || (rIf && rElse && sizeElse <= sizeIf);
		if(thenPart) {
			branch(s.then, isLast);
		}
		if(elsePart) {
			branch(s.otherwise, isLast);
		} else {
			this.statements(statements(s.otherwise), control, isLast, loopHeader);
		}
		if(!thenPart) {
			this.statements(statements(s.then), control, isLast, loopHeader);
		}
	}

	// ----- expressions: nested calls are unwound into one vertex each -----

	expression(e: Node, control: number): Sources {
		switch(e.type) {
			case RType.Symbol:
				return isConstant(e) ? noSources() : { vertices: [], reads: [e.info.id] };
			case RType.Number:
			case RType.String:
			case RType.Logical:
			case RType.Comment:
			case RType.LineDirective:
			case RType.FunctionDefinition:
				return noSources();
			case RType.ExpressionList: {
				const list = statements(e);
				for(let i = 0; i < list.length - 1; i++) {
					this.statement(list[i], control, false, -1);
				}
				return list.length > 0 ? this.expression(list[list.length - 1], control) : noSources();
			}
			case RType.Argument:
				return e.value ? this.expression(e.value, control) : noSources();
			case RType.BinaryOp:
			case RType.Pipe:
			case RType.UnaryOp:
			case RType.FunctionCall:
				return this.callLike(e, control);
			case RType.Access:
				// the member name of `x$name` is no variable
				return this.call(e, e.operator, RAccess.isNamed(e) ? [e.accessed] : [e.accessed, ...argValues(e.access)], control);
			case RType.IfThenElse:
				return this.call(e, 'if', e.otherwise ? [e.condition, e.then, e.otherwise] : [e.condition, e.then], control);
			case RType.ForLoop:
			case RType.WhileLoop:
			case RType.RepeatLoop:
			case RType.Next:
			case RType.Break:
				this.statement(e, control, false, -1);
				return noSources();
			default:
				return noSources();
		}
	}

	/**
	 * Operators, pipes, and calls, dispatched on what the dataflow graph resolved them to: assignments (any
	 * assignment operator, with the operands as the operator database orders them), pipes (`|>`, `%>%`, ...),
	 * `return`, negation (erased like `makeCallNode` does, so `if(!(a >= b))` and `if(a < b)` look alike),
	 * map-like calls, and plain calls.
	 */
	callLike(e: Node, control: number): Sources {
		const [name, operands] = callParts(e);
		if(this.is(e, BuiltInProcName.Assignment) && operands.length === 2 && operands[0] && operands[1]) {
			const swap = BuiltInOperators.byName[name]?.stringUsedInRAst === RawRType.RightAssign;
			return this.assignment(e, operands[swap ? 1 : 0] as Node, operands[swap ? 0 : 1] as Node, control);
		} else if(this.is(e, BuiltInProcName.Pipe) && operands.length === 2 && operands[0] && operands[1]) {
			return this.pipe(e, operands[0], operands[1], control);
		} else if(this.is(e, BuiltInProcName.Return)) {
			return operands[0] ? this.expression(operands[0], control) : noSources();
		} else if(BuiltInOperators.byName[name]?.stringUsedInRAst === RawRType.Exclamation && operands.length === 1 && operands[0]) {
			return this.expression(operands[0], control);
		} else if(this.is(e, BuiltInProcName.Apply) || operands.some(a => RFunctionDefinition.is(a))) {
			return this.mapLike(e, operands, control);
		} else if(RFunctionCall.isUnnamed(e)) {
			const callee = this.expression(e.calledFunction, control);
			const v = this.call(e, '', operands, control);
			this.flow(callee, v.vertices[0]);
			return v;
		}
		return this.call(e, name, operands, control);
	}

	/** a call vertex whose arguments are unwound first; memoized like SimilaR's `mergeTheSameInstructions` */
	call(e: Node, name: string, args: readonly (Node | undefined)[], control: number): Sources {
		const count = RAccess.isNamed(e) ? 2 : args.length;
		const color = this.callColor(e, name, count);
		if(color === PdgColor.Stopifnot) {
			// one stopifnot vertex per condition (`makeStopIfNotNodesIfNecessary`)
			const out: number[] = [];
			for(const a of args) {
				if(a) {
					const v = this.vertex(PdgColor.Stopifnot, a, control, 'stopifnot');
					this.flow(this.expression(a, control), v);
					out.push(v);
				}
			}
			return { vertices: out, reads: [] };
		}
		const argSources = args.map(a => a === undefined ? noSources() : this.expression(a, control));
		const key = this.memoKey(color, name, args.map((a, i) => this.argKey(a, argSources[i])));
		if(key !== undefined) {
			const known = this.memo.get(key);
			if(known !== undefined) {
				return { vertices: [known], reads: [] };
			}
		}
		const v = this.vertex(color, e, control, name);
		for(const s of argSources) {
			this.flow(s, v);
		}
		if(key !== undefined) {
			this.memo.set(key, v);
		}
		return { vertices: [v], reads: [] };
	}

	/** `lhs |> f(a)`/`lhs %>% f(a)` is unwound like `f(lhs, a)`, `lhs %>% f` like `f(lhs)` */
	pipe(e: Node, lhs: Node, rhs: Node, control: number): Sources {
		const value = RArgument.is(lhs) && lhs.value ? lhs.value : lhs;
		const r = unwrap(rhs);
		if(RSymbol.is(r)) {
			return this.call(e, Identifier.getName(r.content), [value], control);
		} else if(RFunctionCall.isNamed(r)) {
			const name = calleeName(r) ?? '';
			const args = [value, ...argValues(r.arguments)];
			if(args.some(a => RFunctionDefinition.is(a))) {
				return this.mapLike(r, args, control);
			}
			return this.call(r, name, args, control);
		}
		return this.call(e, callParts(e)[0], [lhs, rhs], control);
	}

	/**
	 * A map-like call with a function literal, e.g. `lapply(l, function(x) ...)`: the paper unwinds it into a loop
	 * over the container, so we emit a loop header fed by the other arguments, define the function's parameters by
	 * it, and emit the function's body under it. SimilaR's `isApplyFunction` treats any call with a function literal
	 * argument this way, not only the apply family.
	 */
	mapLike(e: Node, args: readonly (Node | undefined)[], control: number): Sources {
		const inputs = args.filter(a => a !== undefined && !RFunctionDefinition.is(a)).map(a => this.expression(a as Node, control));
		const header = this.vertex(PdgColor.Header, e, control, calleeName(e) ?? 'apply');
		for(const s of inputs) {
			this.flow(s, header);
		}
		for(const fn of args) {
			if(RFunctionDefinition.is(fn)) {
				for(const p of fn.parameters) {
					this.define(p.info.id, header);
					this.define(p.name.info.id, header);
				}
				this.statements(statements(fn.body), header, true, -1);
			}
		}
		return { vertices: [header], reads: [] };
	}

	/**
	 * `x <- e`: a call on the right defines `x` itself (no extra vertex), `x <- y` makes `x` an alias of `y` (no
	 * vertex, "variable duplication"), and a constant gets an assignment vertex. `f(x) <- e` (replacement) gets a
	 * vertex for the left side, one for the right, and an assignment vertex depending on both.
	 */
	assignment(e: Node, lhs: Node, rhs: Node, control: number): Sources {
		const target = unwrap(lhs);
		const value = unwrap(rhs);
		if(RSymbol.is(target) || RString.is(target)) {
			if(RFunctionDefinition.is(value)) {
				return noSources();
			}
			if(RSymbol.is(value) && !isConstant(value)) {
				this.aliases.set(target.info.id, [value.info.id]);
				return { vertices: [], reads: [value.info.id] };
			}
			const out = this.expression(value, control);
			if(out.vertices.length === 1 && out.reads.length === 0) {
				this.define(target.info.id, out.vertices[0]);
				return out;
			}
			const v = this.vertex(PdgColor.Assignment, e, control, '<-');
			this.flow(out, v);
			this.define(target.info.id, v);
			return { vertices: [v], reads: [] };
		}
		const left = this.expression(target, control);
		const right = this.expression(value, control);
		const v = this.vertex(PdgColor.Assignment, e, control, '<-');
		for(const l of left.vertices) {
			this.last[l] = true;
		}
		this.flow(left, v);
		this.flow(right, v);
		this.define(target.info.id, v);
		let root: Node | undefined = target;
		while(root && !RSymbol.is(root)) {
			root = RAccess.is(root) ? root.accessed : RFunctionCall.is(root) ? argValues(root.arguments)[0] : undefined;
		}
		if(root) {
			this.define(root.info.id, v);
		}
		return { vertices: [v], reads: [] };
	}

	/** the vertices defining `def`, following aliases */
	definers(def: NodeId, seen: Set<NodeId>): number[] {
		if(seen.has(def)) {
			return [];
		}
		seen.add(def);
		const alias = this.aliases.get(def);
		if(alias) {
			return alias.flatMap(read => this.readsOf(read).flatMap(d => this.definers(d, seen)));
		}
		return this.defs.get(def) ?? [];
	}

	resolve(): void {
		for(const [read, consumer] of this.pending) {
			for(const def of this.readsOf(read)) {
				for(const v of this.definers(def, new Set())) {
					this.data.push([v, consumer]);
				}
			}
		}
	}
}

/**
 * Builds the PDG of a function. The vertices map to preorder indices of `ast` (the file's clone AST) for locations.
 * `environment`, that of the analysis, knows the configured built-ins.
 */
export function buildPdg(fn: RFunctionDefinition<ParentInformation>, ast: CloneAst, graph: DataflowGraph, environment?: REnvironmentInformation): Pdg {
	const b = new PdgBuilder(graph, environment);
	const entry = b.vertex(PdgColor.Entry, fn, -1, 'Entry');
	for(const p of fn.parameters) {
		const v = b.vertex(PdgColor.Parameter, p, entry, Identifier.toString(p.name.content));
		b.define(p.info.id, v);
		b.define(p.name.info.id, v);
	}
	b.statements(statements(fn.body), entry, true, -1);
	b.resolve();
	return finish(b, ast);
}

/** dead code removal, removal of tail symbol vertices, and compaction (`postprocessingPDG.cpp`) */
function finish(b: PdgBuilder, ast: CloneAst): Pdg {
	const n = b.color.length;
	if(n > 0) {
		b.last[n - 1] = true;
	}
	const edgeSet = new Set<string>();
	const edges: [number, number, PdgEdge][] = [];
	for(const [s, t] of b.control) {
		if(s !== t && !edgeSet.has(`${s}>${t}>0`)) {
			edgeSet.add(`${s}>${t}>0`);
			edges.push([s, t, PdgEdge.Control]);
		}
	}
	for(const [s, t] of b.data) {
		if(s !== t && !edgeSet.has(`${s}>${t}>1`)) {
			edgeSet.add(`${s}>${t}>1`);
			edges.push([s, t, PdgEdge.Data]);
		}
	}
	const alive = new Uint8Array(n).fill(1);
	const outDegree = new Int32Array(n);
	const incoming: number[][] = Array.from({ length: n }, () => []);
	for(const [s, t] of edges) {
		outDegree[s]++;
		incoming[t].push(s);
	}
	const removable = (v: number) => alive[v] === 1 && outDegree[v] === 0 && !b.last[v] && b.color[v] !== PdgColor.Entry
		&& !KeepColors.has(b.color[v]) && !b.effect[v];
	const worklist: number[] = [];
	for(let v = 0; v < n; v++) {
		if(removable(v)) {
			worklist.push(v);
		}
	}
	const kill = (v: number) => {
		alive[v] = 0;
		for(const s of incoming[v]) {
			if(alive[s]) {
				outDegree[s]--;
				if(removable(s)) {
					worklist.push(s);
				}
			}
		}
	};
	while(worklist.length > 0) {
		const v = worklist.pop() as number;
		if(removable(v)) {
			kill(v);
		}
	}
	// the tail symbol vertices only kept their definitions alive
	for(let v = 0; v < n; v++) {
		if(alive[v] && b.last[v] && b.color[v] === PdgColor.Symbol) {
			alive[v] = 0;
		}
	}
	const index = new Int32Array(n).fill(-1);
	const color: number[] = [];
	const node: number[] = [];
	const ids = new Map<NodeId, number>();
	for(let i = 0; i < ast.id.length; i++) {
		if(!ids.has(ast.id[i])) {
			ids.set(ast.id[i], i);
		}
	}
	for(let v = 0; v < n; v++) {
		if(alive[v]) {
			index[v] = color.length;
			color.push(b.color[v]);
			node.push(ids.get(b.ast[v]) ?? -1);
		}
	}
	const flat: number[] = [];
	for(const [s, t, type] of edges) {
		if(alive[s] && alive[t]) {
			flat.push(index[s], index[t], type);
		}
	}
	return { color: Uint8Array.from(color), node: Int32Array.from(node), edges: Int32Array.from(flat) };
}

// ------------------------------------------------------------------------------------------------
// comparison
// ------------------------------------------------------------------------------------------------

interface Prepared {
	readonly n:          number;
	/** outgoing neighbors per vertex: [target, PdgEdge] pairs, after removing back edges */
	readonly out:        Int32Array[];
	/** normalized importance degrees */
	readonly importance: Float64Array;
	/** SimilaR's median threshold of the normalized importances */
	readonly median:     number;
}

/**
 * Vertex importance (step 1 of the paper):
 * `delta(v) = 0.1 + sum over edges (v,u) of (1 + 0.1 * [the edge is DATA]) * delta(u)`, normalized by the sum over all vertices.
 * Like the reference implementation (`removeDataCycles`) we first drop all edges whose source was created after
 * their target, which makes the graph acyclic (creation order is a topological order of the remaining edges).
 * The threshold is the reference implementation's "median": the element at index `11 * (n - 1) / 20` (integer
 * division) of the sorted normalized importances, moved to the next larger value if the element before it is equal.
 */
function prepare(pdg: Pdg): Prepared {
	const n = pdg.color.length;
	const outLists: number[][] = Array.from({ length: n }, () => []);
	for(let e = 0; e < pdg.edges.length; e += 3) {
		const s = pdg.edges[e], t = pdg.edges[e + 1];
		if(s < t) {
			outLists[s].push(t, pdg.edges[e + 2]);
		}
	}
	const out = outLists.map(l => Int32Array.from(l));
	const raw = new Float64Array(n);
	let sum = 0;
	for(let v = n - 1; v >= 0; v--) {
		let d = 0.1;
		const o = out[v];
		for(let k = 0; k < o.length; k += 2) {
			d += (o[k + 1] === PdgEdge.Data ? 1.1 : 1) * raw[o[k]];
		}
		raw[v] = d;
		sum += d;
	}
	const importance = raw.map(d => d / sum);
	const sorted = Float64Array.from(importance).sort();
	let median = 0;
	if(n > 0) {
		let idx = Math.floor(11 * (n - 1) / 20);
		median = sorted[idx];
		if(idx > 0 && sorted[idx - 1] === median) {
			while(idx + 1 < n && sorted[idx] === median) {
				idx++;
			}
			median = sorted[idx];
		}
	}
	return { n, out, importance, median };
}

class UnionFind {
	private readonly parent: Int32Array;
	constructor(n: number) {
		this.parent = Int32Array.from({ length: n }, (_, i) => i);
	}
	find(x: number): number {
		while(this.parent[x] !== x) {
			this.parent[x] = this.parent[this.parent[x]];
			x = this.parent[x];
		}
		return x;
	}
	union(a: number, b: number): void {
		const ra = this.find(a), rb = this.find(b);
		if(ra !== rb) {
			this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
		}
	}
}

/**
 * The neighbor multiset of a vertex: (label, importance) sorted by label, then by increasing importance, so that
 * the unmatched neighbors of a label are always the least important ones ("we always assume that the unmatched
 * importances are considered in an increasing order").
 */
function neighborhood(p: Prepared, labels: Int32Array, offset: number, v: number): Float64Array {
	const o = p.out[v];
	const pairs: [number, number][] = [];
	for(let k = 0; k < o.length; k += 2) {
		const t = o[k];
		pairs.push([labels[offset + t] * 2 + (o[k + 1] === PdgEdge.Data ? 1 : 0), p.importance[t]]);
	}
	pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const flat = new Float64Array(pairs.length * 2);
	pairs.forEach(([l, i], k) => {
		flat[2 * k] = l;
		flat[2 * k + 1] = i;
	});
	return flat;
}

/**
 * The importance of the unmatched neighbors of both vertices: for every label, the side with more neighbors of
 * that label leaves its least important surplus unmatched.
 */
function unmatchedImportance(a: Float64Array, b: Float64Array): number {
	let sum = 0;
	let i = 0, j = 0;
	while(i < a.length || j < b.length) {
		const la = i < a.length ? a[i] : Number.POSITIVE_INFINITY;
		const lb = j < b.length ? b[j] : Number.POSITIVE_INFINITY;
		const label = Math.min(la, lb);
		let ea = i;
		while(ea < a.length && a[ea] === label) {
			ea += 2;
		}
		let eb = j;
		while(eb < b.length && b[eb] === label) {
			eb += 2;
		}
		const ca = (ea - i) / 2, cb = (eb - j) / 2;
		// the surplus is the first (least important) entries of the larger side
		for(let k = 0; k < ca - cb; k++) {
			sum += a[i + 2 * k + 1];
		}
		for(let k = 0; k < cb - ca; k++) {
			sum += b[j + 2 * k + 1];
		}
		i = ea;
		j = eb;
	}
	return sum;
}

export interface SimilarResult {
	/** mu(F, G), the symmetric similarity */
	readonly symmetric:  number;
	/** the asymmetric mu~(F, G), the degree to which F is contained in G */
	readonly fInG:       number;
	/** mu~(G, F) */
	readonly gInF:       number;
	/** the partial symmetric similarities mu(L^i_F, L^i_G), i = 1..h */
	readonly iterations: readonly number[];
}

function partial(lf: Int32Array, lg: Int32Array): [sym: number, fg: number, gf: number] {
	let diff = 0, min = 0, sf = 0, sg = 0;
	for(let k = 0; k < lf.length; k++) {
		diff += Math.abs(lf[k] - lg[k]);
		min += Math.min(lf[k], lg[k]);
		sf += lf[k];
		sg += lg[k];
	}
	return [sf + sg === 0 ? 1 : 1 - diff / (sf + sg), sf === 0 ? 1 : min / sf, sg === 0 ? 1 : min / sg];
}

function counts(labels: Int32Array, from: number, to: number, m: number): Int32Array {
	const c = new Int32Array(m);
	for(let v = from; v < to; v++) {
		c[labels[v]]++;
	}
	return c;
}

/**
 * Compares two PDGs with the SimilaR algorithm over `h` iterations (3 in the paper; the first iteration just
 * remaps the vertex types). In each further iteration, two vertices `v`, `u` of the union of `F` and `G` are similar iff they had the
 * same label and the importance of their unmatched neighbors does not exceed `min(M_F, M_G)`; the equivalence
 * classes of the transitive closure become the new labels. With the label count vectors `L^i` the partial
 * similarities are `mu = 1 - sum |L_F - L_G| / (sum L_F + sum L_G)` and `mu~(F, G) = sum min(L_F, L_G) / sum L_F`, and the
 * results are their arithmetic means over all `h` iterations.
 */
export function similarCompare(f: Pdg, g: Pdg, h = 3): SimilarResult {
	const pf = prepare(f), pg = prepare(g);
	const n = pf.n + pg.n;
	const threshold = Math.min(pf.median, pg.median);
	// iteration 1: types remapped to consecutive integers
	let labels = new Int32Array(n);
	const typeIds = new Map<number, number>();
	for(let v = 0; v < n; v++) {
		const c = v < pf.n ? f.color[v] : g.color[v - pf.n];
		let id = typeIds.get(c);
		if(id === undefined) {
			id = typeIds.size;
			typeIds.set(c, id);
		}
		labels[v] = id;
	}
	let m = typeIds.size;
	const sym: number[] = [], fg: number[] = [], gf: number[] = [];
	const record = () => {
		const [s, a, b] = partial(counts(labels, 0, pf.n, m), counts(labels, pf.n, n, m));
		sym.push(s);
		fg.push(a);
		gf.push(b);
	};
	record();
	for(let i = 2; i <= h; i++) {
		const hoods: Float64Array[] = new Array<Float64Array>(n);
		for(let v = 0; v < n; v++) {
			hoods[v] = v < pf.n ? neighborhood(pf, labels, 0, v) : neighborhood(pg, labels, pf.n, v - pf.n);
		}
		const uf = new UnionFind(n);
		const byLabel = new Map<number, number[]>();
		for(let v = 0; v < n; v++) {
			const list = byLabel.get(labels[v]);
			if(list) {
				list.push(v);
			} else {
				byLabel.set(labels[v], [v]);
			}
		}
		for(const group of byLabel.values()) {
			for(let x = 0; x < group.length; x++) {
				for(let y = x + 1; y < group.length; y++) {
					const a = group[x], b = group[y];
					if(uf.find(a) !== uf.find(b) && unmatchedImportance(hoods[a], hoods[b]) <= threshold) {
						uf.union(a, b);
					}
				}
			}
		}
		const next = new Int32Array(n);
		const ids = new Map<number, number>();
		for(let v = 0; v < n; v++) {
			const root = uf.find(v);
			let id = ids.get(root);
			if(id === undefined) {
				id = ids.size;
				ids.set(root, id);
			}
			next[v] = id;
		}
		labels = next;
		m = ids.size;
		record();
	}
	const mean = (xs: readonly number[]) => arraySum(xs) / xs.length;
	return { symmetric: mean(sym), fInG: mean(fg), gInF: mean(gf), iterations: sym };
}

/**
 * An upper bound of {@link similarCompare}'s symmetric similarity from the graph sizes alone: every partial
 * similarity is at most `2 min(|V_F|, |V_G|) / (|V_F| + |V_G|)`.
 */
export function similarSizeBound(f: Pdg, g: Pdg): number {
	const a = f.color.length, b = g.color.length;
	return a + b === 0 ? 1 : 2 * Math.min(a, b) / (a + b);
}

