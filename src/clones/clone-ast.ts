import { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RLineDirective } from '../r-bridge/lang-4.x/ast/model/nodes/r-line-directive';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RComment } from '../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { RawRType, RType } from '../r-bridge/lang-4.x/ast/model/type';
import { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { DfgVertex } from '../dataflow/graph/vertex';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EmptyArgument, RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { SourceRange } from '../util/range';
import { Identifier } from '../dataflow/environments/identifier';
import { BuiltInOperators, OperatorUsedAs } from '../dataflow/environments/default-builtin-config/operators';

/**
 * The kinds a {@link CloneAst} node can have. Operators are kept in {@link CloneAst.op}, so `BinaryOp` with
 * `op = '+'` and with `op = '<-'` are different labels.
 */
export const enum CloneNodeKind {
	ExpressionList, Brace, Paren, FunctionDefinition, Parameter, FunctionCall, Argument, EmptyArgument,
	Access, BinaryOp, UnaryOp, Pipe, IfThenElse, ForLoop, WhileLoop, RepeatLoop,
	Symbol, Number, String, Logical, Break, Next
}

const KindNames = [
	'exprlist', '{', '(', 'function', 'param', 'call', 'arg', 'empty',
	'access', 'binop', 'unop', 'pipe', 'if', 'for', 'while', 'repeat',
	'symbol', 'num', 'str', 'lgl', 'break', 'next'
] as const;

/**
 * A function definition found in a {@link CloneAst}, the unit SimilaR and the function-level token algorithms compare.
 */
export interface CloneFunction {
	/** preorder index of the `function` node */
	readonly node: number;
	/** the name it is bound to (`name <- function`), `undefined` for anonymous functions */
	readonly name: string | undefined;
}

/**
 * A flat, preorder encoding of one file's normalized AST. Comments and line directives are dropped; every other
 * node gets one entry, and the subtree of node `i` is exactly `[i, i + size[i])`. This is all the token- and
 * tree-based detectors need, it is cheap to scan, and it serializes as plain arrays (see the clone index).
 */
export interface CloneAst {
	readonly file:      string;
	readonly kind:      Uint8Array;
	/** the operator of operator nodes, the empty string otherwise */
	readonly op:        readonly string[];
	/** the 32-bit hash of the lexeme of leaves (symbols, constants, argument/parameter names), 0 for inner nodes */
	readonly lex:       Int32Array;
	/** the raw lexeme of leaves, kept for the JPlag token mapping and reporting */
	readonly text:      readonly string[];
	readonly size:      Int32Array;
	readonly parent:    Int32Array;
	readonly id:        readonly NodeId[];
	/** start line, start column, end line, end column of the whole subtree, 4 entries per node; 0 when unknown */
	readonly span:      Int32Array;
	readonly functions: readonly CloneFunction[];
}

/** FNV-1a over UTF-16 code units, as a signed 32-bit integer. */
export function hashString(s: string): number {
	let h = 0x811c9dc5;
	for(let i = 0; i < s.length; i++) {
		h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
	}
	return h | 0;
}

/** Mixes `v` into the running hash `h` (murmur3 style), signed 32-bit result. */
export function mixHash(h: number, v: number): number {
	let k = Math.imul(v, 0xcc9e2d51);
	k = (k << 15) | (k >>> 17);
	h ^= Math.imul(k, 0x1b873593);
	h = (h << 13) | (h >>> 19);
	return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

/**
 * The label of node `i`: its kind plus its operator, e.g. `binop:+`. Labels are what the tree- and token-based
 * detectors compare, so identifiers and constants (see {@link CloneAst.lex}) are not part of them.
 * @example
 * ```ts
 * const ast = buildCloneAst(normalized.ast.files[0].root, 'a.R');
 * Array.from(ast.kind, (_, i) => cloneLabel(ast, i)); // e.g. ['exprlist', 'binop:<-', 'symbol', 'function', ...]
 * ```
 */
export function cloneLabel(ast: CloneAst, i: number): string {
	const op = ast.op[i];
	return op === '' ? KindNames[ast.kind[i]] : `${KindNames[ast.kind[i]]}:${op}`;
}

function leafText(node: RNode): string {
	switch(node.type) {
		case RType.Symbol:
			return Identifier.toString(node.content);
		case RType.Number:
		case RType.String:
		case RType.Logical:
			return node.lexeme;
		default:
			return node.lexeme ?? '';
	}
}

/**
 * How the normalized AST is presented to the detectors:
 * - `syntax`: as written (needed to reproduce JPlag's token strings, which follow JPlag's own R grammar)
 * - `canonical`: syntactic sugar and newer R features are rewritten to one core form, each rewritten node keeping
 *   the id (provenance) of the node it stems from: `|>` and `%>%` become calls (respecting `_` and `.`
 *   placeholders), `\(x)` becomes `function(x)`, `->`/`->>`/`=` become `<-`/`<<-`, `(e)`, `{e}` become `e`,
 *   `x[["a"]]` and `x$"a"` become `x$a`, `T`/`F` become `TRUE`/`FALSE`, and a tail `return(e)` becomes `e`
 * - `dataflow`: `canonical`, plus single-use temporaries are inlined along the dataflow graph, turning statement
 *   sequences into the expression trees of the values they compute (`t <- f(x); g(t)` becomes `g(f(x))`)
 *
 * Choose the weakest perspective that finds what you look for, as `dataflow` needs the dataflow graph of the whole
 * project, which the other two do not. Index and search must use the same perspective, as the stored lists
 * of an index are already rewritten.
 * @example
 * ```ts
 * // x |> f(2) and f(x, 2) are different with `syntax` but the same with `canonical`
 * const index = await CloneIndex.build(analyzer, { perspective: ClonePerspective.Canonical, pdgs: false });
 * ```
 */
export enum ClonePerspective {
	Syntax    = 'syntax',
	Canonical = 'canonical',
	Dataflow  = 'dataflow'
}

/** Which symbol reads to replace by which value, and which (now empty) assignment statements to drop. */
export interface InlinePlan {
	readonly replace: ReadonlyMap<NodeId, RNode<ParentInformation>>;
	readonly drop:    ReadonlySet<NodeId>;
}

/** `anonymous` for calls of an expression, `infix` for calls written as `a %op% b`, empty otherwise */
function callOp(call: RFunctionCall<ParentInformation>): string {
	if(!call.named) {
		return 'anonymous';
	}
	return 'infixSpecial' in call && call.infixSpecial === true ? 'infix' : '';
}

/**
 * How the operator database ({@link BuiltInOperators}) describes an assignment operator, `undefined` for other operators.
 * @example
 * ```ts
 * assignmentOperator('->>'); // { right: true, equal: false, super: true }
 * assignmentOperator('+');   // undefined
 * ```
 */
export function assignmentOperator(op: string): { readonly right: boolean, readonly equal: boolean, readonly super: boolean } | undefined {
	const info = BuiltInOperators.byName[op];
	if(info?.usedAs !== OperatorUsedAs.Assignment) {
		return undefined;
	}
	return {
		right: info.stringUsedInRAst === RawRType.RightAssign,
		equal: info.stringUsedInRAst === RawRType.EqualAssign,
		super: info.capabilities.includes('super-left-assignment') || info.capabilities.includes('super-right-assignment')
	};
}

/** a function body whose last statement is `return(e)` with `e` in its place */
function withoutTailReturn(body: RNode<ParentInformation>): RNode<ParentInformation> {
	if(!RExpressionList.is(body) || body.children.length === 0) {
		return body;
	}
	const last = body.children[body.children.length - 1];
	if(RFunctionCall.isNamed(last, 'return') && last.arguments.length === 1) {
		const a = last.arguments[0];
		if(a !== EmptyArgument && a.name === undefined && a.value) {
			return { ...body, children: [...body.children.slice(0, -1), a.value] };
		}
	}
	return body;
}

class CloneAstBuilder {
	private readonly perspective: ClonePerspective;
	private readonly inline:      InlinePlan | undefined;
	private readonly graph:       DataflowGraph | undefined;
	readonly kind:                number[] = [];
	readonly op:                  string[] = [];
	readonly lex:                 number[] = [];
	readonly text:                string[] = [];
	readonly size:                number[] = [];
	readonly parent:              number[] = [];
	readonly id:                  NodeId[] = [];
	readonly span:                number[] = [];
	readonly functions:           CloneFunction[] = [];

	constructor(perspective: ClonePerspective, inline: InlinePlan | undefined, graph: DataflowGraph | undefined) {
		this.perspective = perspective;
		this.inline = inline;
		this.graph = graph;
	}

	/**
	 * Whether the call is a pipe like magrittr's `%>%`: the dataflow graph decides if we have one (it knows
	 * whether magrittr is attached), otherwise we go by the name.
	 */
	private isPipe(call: RFunctionCall<ParentInformation>): boolean {
		if(this.graph) {
			return DfgVertex.hasOrigin(this.graph.getVertex(call.info.id), BuiltInProcName.Pipe);
		}
		return RFunctionCall.isNamed(call, '%>%');
	}

	private push(node: RNode<ParentInformation>, kind: CloneNodeKind, parent: number, op = '', text = ''): number {
		const i = this.kind.length;
		this.kind.push(kind);
		this.op.push(op);
		this.text.push(text);
		this.lex.push(text === '' ? 0 : hashString(text));
		this.size.push(1);
		this.parent.push(parent);
		this.id.push(node.info.id);
		const r = SourceRange.fromNode(node);
		if(r) {
			this.span.push(r[0], r[1], r[2], r[3]);
		} else {
			this.span.push(0, 0, 0, 0);
		}
		return i;
	}

	private close(i: number): void {
		this.size[i] = this.kind.length - i;
		const p = this.parent[i];
		if(p >= 0) {
			this.widen(p, i);
		}
	}

	/** widens the span of `p` to include the span of its child `c` */
	private widen(p: number, c: number): void {
		const s = this.span;
		const cp = 4 * c, pp = 4 * p;
		if(s[cp] === 0) {
			return;
		}
		if(s[pp] === 0 || s[cp] < s[pp] || (s[cp] === s[pp] && s[cp + 1] < s[pp + 1])) {
			s[pp] = s[cp];
			s[pp + 1] = s[cp + 1];
		}
		if(s[pp + 2] === 0 || s[cp + 2] > s[pp + 2] || (s[cp + 2] === s[pp + 2] && s[cp + 3] > s[pp + 3])) {
			s[pp + 2] = s[cp + 2];
			s[pp + 3] = s[cp + 3];
		}
	}

	visit(node: RNode<ParentInformation>, parent: number): void {
		const canonical = this.perspective !== ClonePerspective.Syntax;
		switch(node.type) {
			case RType.Comment:
			case RType.LineDirective:
				return;
			case RType.ExpressionList: {
				const children = canonical ? node.children.filter(c => !RComment.is(c) && !RLineDirective.is(c) && !this.inline?.drop.has(c.info.id)) : node.children;
				const g = node.grouping?.[0].content;
				// canonical: `(e)`, `{e}`, and an ungrouped single statement are just `e`
				if(canonical && parent >= 0 && children.length === 1) {
					return this.visit(children[0], parent);
				}
				const i = this.push(node, g === '{' ? CloneNodeKind.Brace : g === '(' ? CloneNodeKind.Paren : CloneNodeKind.ExpressionList, parent);
				for(const c of children) {
					this.visit(c, i);
				}
				return this.close(i);
			}
			case RType.FunctionDefinition: {
				const i = this.push(node, CloneNodeKind.FunctionDefinition, parent, node.lexeme === '\\' && !canonical ? '\\' : '');
				this.functions.push({ node: i, name: functionName(this, parent, i) });
				for(const p of node.parameters) {
					const pi = this.push(p, CloneNodeKind.Parameter, i, '', Identifier.toString(p.name.content));
					if(p.defaultValue) {
						this.visit(p.defaultValue, pi);
					}
					this.close(pi);
				}
				this.visit(canonical ? withoutTailReturn(node.body) : node.body, i);
				return this.close(i);
			}
			case RType.FunctionCall: {
				if(canonical && node.arguments.length === 2 && this.isPipe(node)) {
					const [lhs, rhs] = node.arguments;
					if(lhs !== EmptyArgument && rhs !== EmptyArgument && rhs.value && this.visitPipe(node, lhs, rhs.value, '.', parent)) {
						return;
					}
				}
				const i = this.push(node, CloneNodeKind.FunctionCall, parent, callOp(node));
				this.visit(node.named ? node.functionName : node.calledFunction, i);
				this.visitArgs(node.arguments, i);
				return this.close(i);
			}
			case RType.Argument: {
				const i = this.push(node, CloneNodeKind.Argument, parent, node.name ? '=' : '', node.name ? Identifier.toString(node.name.content) : '');
				if(node.value) {
					this.visit(node.value, i);
				}
				return this.close(i);
			}
			case RType.Access: {
				// canonical: `x[["name"]]` is `x$name`
				if(canonical && node.operator === '[[' && node.access.length === 1) {
					const a = node.access[0];
					if(a !== EmptyArgument && a.name === undefined && RString.is(a.value)) {
						const i = this.push(node, CloneNodeKind.Access, parent, '$');
						this.visit(node.accessed, i);
						const ai = this.push(a, CloneNodeKind.Argument, i);
						this.close(this.push(a.value, CloneNodeKind.Symbol, ai, '', a.value.content.str));
						this.close(ai);
						return this.close(i);
					}
				}
				const i = this.push(node, CloneNodeKind.Access, parent, node.operator);
				this.visit(node.accessed, i);
				if(canonical && RAccess.isNamed(node)) {
					this.visitAccessName(node.access, i);
				} else {
					this.visitArgs(node.access, i);
				}
				return this.close(i);
			}
			case RType.BinaryOp: {
				let op = node.operator;
				let lhs = node.lhs, rhs = node.rhs;
				if(canonical) {
					// canonical: `x -> y` is `y <- x`, `x ->> y` is `y <<- x`, and `y = x` is `y <- x`
					const assign = assignmentOperator(op);
					if(assign?.right) {
						lhs = node.rhs;
						rhs = node.lhs;
					}
					if(assign?.right || assign?.equal) {
						op = assign.super ? '<<-' : '<-';
					}
				}
				const i = this.push(node, CloneNodeKind.BinaryOp, parent, op);
				this.visit(lhs, i);
				this.visit(rhs, i);
				return this.close(i);
			}
			case RType.Pipe: {
				if(canonical && this.visitPipe(node, node.lhs, node.rhs, '_', parent)) {
					return;
				}
				const i = this.push(node, CloneNodeKind.Pipe, parent, '|>');
				this.visit(node.lhs, i);
				this.visit(node.rhs, i);
				return this.close(i);
			}
			case RType.UnaryOp: {
				const i = this.push(node, CloneNodeKind.UnaryOp, parent, node.operator);
				this.visit(node.operand, i);
				return this.close(i);
			}
			case RType.IfThenElse: {
				const i = this.push(node, CloneNodeKind.IfThenElse, parent, node.otherwise ? 'else' : '');
				this.visit(node.condition, i);
				this.visit(node.then, i);
				if(node.otherwise) {
					this.visit(node.otherwise, i);
				}
				return this.close(i);
			}
			case RType.ForLoop: {
				const i = this.push(node, CloneNodeKind.ForLoop, parent);
				this.visit(node.variable, i);
				this.visit(node.vector, i);
				this.visit(node.body, i);
				return this.close(i);
			}
			case RType.WhileLoop: {
				const i = this.push(node, CloneNodeKind.WhileLoop, parent);
				this.visit(node.condition, i);
				this.visit(node.body, i);
				return this.close(i);
			}
			case RType.RepeatLoop: {
				const i = this.push(node, CloneNodeKind.RepeatLoop, parent);
				this.visit(node.body, i);
				return this.close(i);
			}
			case RType.Symbol: {
				const value = this.inline?.replace.get(node.info.id);
				if(value !== undefined) {
					return this.visit(value, parent);
				}
				const text = leafText(node);
				// canonical: `T` and `F` are `TRUE` and `FALSE`
				if(canonical && (text === 'T' || text === 'F')) {
					return this.close(this.push(node, CloneNodeKind.Logical, parent, '', text === 'T' ? 'TRUE' : 'FALSE'));
				}
				// backticked names are strings to JPlag's lexer, which only the syntax perspective reproduces
				return this.close(this.push(node, CloneNodeKind.Symbol, parent, !canonical && node.lexeme?.startsWith('`') ? 'quoted' : '', text));
			}
			case RType.Number:
				return this.close(this.push(node, CloneNodeKind.Number, parent, '', leafText(node)));
			case RType.String:
				return this.close(this.push(node, CloneNodeKind.String, parent, '', leafText(node)));
			case RType.Logical:
				return this.close(this.push(node, CloneNodeKind.Logical, parent, '', leafText(node)));
			case RType.Break:
				return this.close(this.push(node, CloneNodeKind.Break, parent));
			case RType.Next:
				return this.close(this.push(node, CloneNodeKind.Next, parent));
		}
	}

	/**
	 * Canonical: rewrites a pipe into the call it stands for, `x |> f(y)` and `x %>% f(y)` into `f(x, y)`, and `x %>% f`
	 * into `f(x)`. A direct argument that is the placeholder (`_` for `|>`, `.` for magrittr) receives `x` instead,
	 * and then (as in magrittr) `x` is not inserted as first argument. The inserted argument keeps the id and the
	 * location of `x`, so findings still point to the original source. Returns `false` if the rhs is no call or symbol.
	 */
	private visitPipe(pipe: RNode<ParentInformation>, lhs: RNode<ParentInformation>, rhs: RNode<ParentInformation>, placeholder: string, parent: number): boolean {
		const value = RArgument.is(lhs) && lhs.value ? lhs.value : lhs;
		if(RSymbol.is(rhs) && placeholder === '.') {
			const i = this.push(pipe, CloneNodeKind.FunctionCall, parent);
			this.visit(rhs, i);
			this.visitInserted(value, i);
			this.close(i);
			return true;
		}
		if(!RFunctionCall.is(rhs)) {
			return false;
		}
		const isPlaceholder = (a: RNode<ParentInformation> | typeof EmptyArgument) => a !== EmptyArgument && RArgument.is(a)
			&& RSymbol.is(a.value) && a.value.content === placeholder;
		const hasPlaceholder = rhs.arguments.some(isPlaceholder);
		const i = this.push(rhs, CloneNodeKind.FunctionCall, parent, callOp(rhs));
		this.visit(rhs.named ? rhs.functionName : rhs.calledFunction, i);
		if(!hasPlaceholder) {
			this.visitInserted(value, i);
		}
		for(const a of rhs.arguments) {
			if(hasPlaceholder && isPlaceholder(a) && a !== EmptyArgument && RArgument.is(a)) {
				const ai = this.push(a, CloneNodeKind.Argument, i, a.name ? '=' : '', a.name ? Identifier.toString(a.name.content) : '');
				this.visit(value, ai);
				this.close(ai);
			} else {
				this.visitArgs([a], i);
			}
		}
		this.close(i);
		return true;
	}

	private visitInserted(value: RNode<ParentInformation>, parent: number): void {
		const ai = this.push(value, CloneNodeKind.Argument, parent);
		this.visit(value, ai);
		this.close(ai);
	}

	/** canonical: the name of `x$name`/`x@name` is a plain symbol, whether written as a symbol or a string */
	private visitAccessName(args: readonly (RNode<ParentInformation> | typeof EmptyArgument)[], parent: number): void {
		for(const a of args) {
			const v = a !== EmptyArgument && RArgument.is(a) ? a.value : undefined;
			if(a !== EmptyArgument && RString.is(v)) {
				const ai = this.push(a, CloneNodeKind.Argument, parent);
				this.close(this.push(v, CloneNodeKind.Symbol, ai, '', v.content.str));
				this.close(ai);
			} else {
				this.visitArgs([a], parent);
			}
		}
	}

	private visitArgs(args: readonly (RNode<ParentInformation> | typeof EmptyArgument)[], parent: number): void {
		for(const a of args) {
			if(a === EmptyArgument) {
				this.kind.push(CloneNodeKind.EmptyArgument);
				this.op.push('');
				this.text.push('');
				this.lex.push(0);
				this.size.push(1);
				this.parent.push(parent);
				this.id.push(this.id[parent]);
				this.span.push(0, 0, 0, 0);
			} else {
				this.visit(a, parent);
			}
		}
	}

	build(file: string): CloneAst {
		return {
			file,
			kind:      Uint8Array.from(this.kind),
			op:        this.op,
			lex:       Int32Array.from(this.lex),
			text:      this.text,
			size:      Int32Array.from(this.size),
			parent:    Int32Array.from(this.parent),
			id:        this.id,
			span:      Int32Array.from(this.span),
			functions: this.functions
		};
	}
}

/** the name `name <- function` (or any other left assignment) binds the function to, if the lhs is a plain symbol */
function functionName(b: CloneAstBuilder, parent: number, self: number): string | undefined {
	if(parent < 0 || b.kind[parent] !== CloneNodeKind.BinaryOp || assignmentOperator(b.op[parent])?.right !== false) {
		return undefined;
	}
	const lhs = parent + 1;
	return lhs !== self && b.kind[lhs] === CloneNodeKind.Symbol ? b.text[lhs] : undefined;
}


/**
 * Flattens the normalized AST of one file (the root expression list) into a {@link CloneAst}, see {@link ClonePerspective}.
 * Prefer {@link CloneIndex.build}, which does this for all files of an analyzer and runs the dataflow analysis the
 * `dataflow` perspective needs. Call this directly for tests or for a single normalized file.
 * @example
 * ```ts
 * const normalized = await analyzer.normalize();
 * const ast = buildCloneAst(normalized.ast.files[0].root, 'a.R', ClonePerspective.Canonical);
 * const tokens = tokenize(ast, CloneTokenization.Normalized);
 * ```
 * The `inline` plan and the `graph` of the `dataflow` perspective come from {@link planInlining} and the dataflow
 * analysis; with the graph, rewrites ask it what a call is instead of going by names. The other perspectives are
 * purely syntactic, so they never depend on whether a dataflow graph happens to be around.
 */
export function buildCloneAst(root: RNode<ParentInformation>, file: string, perspective: ClonePerspective = ClonePerspective.Canonical, inline?: InlinePlan, graph?: DataflowGraph): CloneAst {
	const b = new CloneAstBuilder(perspective, inline, graph);
	b.visit(root, -1);
	return b.build(file);
}

/**
 * Iterates the preorder indices of the direct children of `i`, by skipping over the subtrees of the children.
 * @example
 * ```ts
 * const statements = [...cloneChildren(ast, 0)]; // the top-level expressions of the file
 * ```
 */
export function* cloneChildren(ast: CloneAst, i: number): Generator<number> {
	const end = i + ast.size[i];
	for(let c = i + 1; c < end; c += ast.size[c]) {
		yield c;
	}
}

/** The start line of node `i`, 0 when unknown. */
export function cloneStartLine(ast: CloneAst, i: number): number {
	return ast.span[4 * i];
}
