import { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RComment } from '../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { RLineDirective } from '../r-bridge/lang-4.x/ast/model/nodes/r-line-directive';
import { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { RawRType, RType } from '../r-bridge/lang-4.x/ast/model/type';
import { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { DfgVertex } from '../dataflow/graph/vertex';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EmptyArgument, RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { SourceRange } from '../util/range';
import { Identifier } from '../dataflow/environments/identifier';
import { BuiltInOperators, OperatorUsedAs } from '../dataflow/environments/default-builtin-config/operators';

type Node = RNode<ParentInformation>;
type Child = Node | typeof EmptyArgument | undefined;

/** A function definition of a {@link CloneAst}: its preorder index and the name it is bound to, if any. */
export interface CloneFunction {
	readonly node: number;
	readonly name: string | undefined;
}

/**
 * The preorder encoding of one file's normalized AST without comments: the subtree of node `i` is `[i, i + size[i])`.
 * It consists of plain arrays only, so it serializes as JSON as it is.
 */
export interface CloneAst {
	readonly file:      string;
	/** the hash of type, operator, and number of children, which the detectors compare */
	readonly token:     readonly number[];
	/** the hash of the lexeme of leaves, 0 for inner nodes */
	readonly lex:       readonly number[];
	readonly size:      readonly number[];
	readonly id:        readonly NodeId[];
	/** start line, start column, end line, end column of the subtree, 4 entries per node, 0 if unknown */
	readonly span:      readonly number[];
	readonly functions: readonly CloneFunction[];
}

/**
 * How the code is presented to the detectors:
 * - `syntax`: as written
 * - `canonical`: sugar rewritten to one core form (pipes become calls, `\(x)` is `function(x)`, `->` and `=` are `<-`,
 *   `(e)` and `{e}` are `e`, `x[["a"]]` is `x$a`, `T` is `TRUE`, a tail `return(e)` is `e`), keeping the ids of the source nodes
 * - `dataflow`: `canonical` with single-use temporaries inlined along the dataflow graph (`t <- f(x); g(t)` is `g(f(x))`)
 */
export enum ClonePerspective {
	Syntax    = 'syntax',
	Canonical = 'canonical',
	Dataflow  = 'dataflow'
}

/**
 * How {@link tokenize} presents the nodes: `normalized` abstracts identifiers and constants (type-2 clones),
 * `exact` keeps them (type-1 clones).
 */
export enum CloneTokenization {
	Normalized = 'normalized',
	Exact      = 'exact'
}

/** Which symbol reads to replace by which value, and which assignment statements to drop. */
export interface InlinePlan {
	readonly replace: ReadonlyMap<NodeId, Node>;
	readonly drop:    ReadonlySet<NodeId>;
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
 * How the operator database describes an assignment operator, `undefined` for other operators.
 * @example
 * ```ts
 * assignmentOperator('->>'); // { right: true, super: true }
 * ```
 */
export function assignmentOperator(op: string): { readonly right: boolean, readonly super: boolean } | undefined {
	const info = BuiltInOperators.byName[op];
	if(info?.usedAs !== OperatorUsedAs.Assignment) {
		return undefined;
	}
	return {
		right: info.stringUsedInRAst === RawRType.RightAssign,
		super: info.capabilities.includes('super-left-assignment') || info.capabilities.includes('super-right-assignment')
	};
}

function leafText(node: Node): string {
	switch(node.type) {
		case RType.Symbol:  return Identifier.toString(node.content);
		case RType.Number: case RType.String: case RType.Logical: return node.lexeme;
		default:            return '';
	}
}

function withoutTailReturn(body: Node): Node {
	const last = RExpressionList.is(body) ? body.children.at(-1) : undefined;
	const arg = RFunctionCall.isNamed(last, 'return') && last.arguments.length === 1 ? last.arguments[0] : EmptyArgument;
	if(RExpressionList.is(body) && arg !== EmptyArgument && arg.name === undefined && arg.value) {
		return { ...body, children: [...body.children.slice(0, -1), arg.value] };
	}
	return body;
}

class CloneAstBuilder {
	private readonly canonical: boolean;
	private readonly inline:    InlinePlan | undefined;
	private readonly graph:     DataflowGraph | undefined;
	private readonly arity:     number[] = [];
	private name:               string | undefined;
	readonly token:             number[] = [];
	readonly lex:               number[] = [];
	readonly size:              number[] = [];
	readonly id:                NodeId[] = [];
	readonly span:              number[] = [];
	readonly functions:         CloneFunction[] = [];

	constructor(canonical: boolean, inline: InlinePlan | undefined, graph: DataflowGraph | undefined) {
		this.canonical = canonical;
		this.inline = inline;
		this.graph = graph;
	}

	/** pushes a node labeled `kind` stemming from `src`, lets `inner` add its children, and closes it */
	private node(src: Node | undefined, kind: string, parent: number, inner?: (self: number) => void, text = ''): void {
		const i = this.token.length;
		this.token.push(hashString(kind));
		this.lex.push(text === '' ? 0 : hashString(text));
		this.arity.push(0);
		this.size.push(1);
		this.id.push(src?.info.id ?? this.id[parent]);
		this.span.push(...(SourceRange.fromNode(src) ?? [0, 0, 0, 0]));
		inner?.(i);
		this.size[i] = this.token.length - i;
		if(parent >= 0) {
			this.arity[parent]++;
			const s = this.span, p = 4 * parent, c = 4 * i;
			if(s[c] !== 0) {
				const [sl, sc, el, ec] = s[p] === 0 ? s.slice(c, c + 4) : SourceRange.merge([s.slice(p, p + 4) as SourceRange, s.slice(c, c + 4) as SourceRange]);
				s.splice(p, 4, sl, sc, el, ec);
			}
		}
	}

	private visitAll(children: readonly Child[], parent: number): void {
		for(const c of children) {
			if(c === EmptyArgument) {
				this.node(undefined, 'empty', parent);
			} else if(c !== undefined) {
				this.visit(c, parent);
			}
		}
	}

	visit(n: Node, parent: number): void {
		const canonical = this.canonical;
		const typeLabel = `${n.type}:${'operator' in n ? String(n.operator) : ''}`;
		switch(n.type) {
			case RType.Comment:
			case RType.LineDirective:
				return;
			case RType.ExpressionList: {
				const children = n.children.filter(c => !RComment.is(c) && !RLineDirective.is(c) && !this.inline?.drop.has(c.info.id));
				if(canonical && parent >= 0 && children.length === 1) {
					return this.visit(children[0], parent);
				}
				return this.node(n, typeLabel + (n.grouping?.[0].lexeme ?? ''), parent, i => this.visitAll(children, i));
			}
			case RType.FunctionDefinition: {
				const name = this.name;
				this.name = undefined;
				return this.node(n, typeLabel, parent, i => {
					this.functions.push({ node: i, name });
					this.visitAll([...n.parameters, canonical ? withoutTailReturn(n.body) : n.body], i);
				});
			}
			case RType.FunctionCall: {
				const [lhs, rhs] = n.arguments;
				const isPipe = this.graph ? DfgVertex.hasOrigin(this.graph.getVertex(n.info.id), BuiltInProcName.Pipe) : RFunctionCall.isNamed(n, '%>%');
				if(canonical && n.arguments.length === 2 && isPipe && lhs !== EmptyArgument && rhs !== EmptyArgument && rhs.value && this.visitPipe(n, lhs, rhs.value, '.', parent)) {
					return;
				}
				break;
			}
			case RType.Pipe:
				if(canonical && this.visitPipe(n, n.lhs, n.rhs, '_', parent)) {
					return;
				}
				break;
			case RType.Access: {
				const a = n.access[0];
				const field = a !== EmptyArgument && a.name === undefined && (RAccess.isNamed(n) || n.operator === '[[' && n.access.length === 1) ? a.value : undefined;
				const text = RString.is(field) ? field.content.str : RSymbol.is(field) && RAccess.isNamed(n) ? leafText(field) : undefined;
				if(canonical && field && text !== undefined) {
					return this.node(n, `${n.type}:${n.operator === '@' ? '@' : '$'}`, parent, i => {
						this.visit(n.accessed, i);
						this.node(field, `${RType.Symbol}:`, i, undefined, text);
					});
				}
				return this.node(n, typeLabel, parent, i => this.visitAll([n.accessed, ...n.access], i));
			}
			case RType.BinaryOp: {
				const assign = assignmentOperator(n.operator);
				const [target, value] = assign?.right ? [n.rhs, n.lhs] : [n.lhs, n.rhs];
				if(assign && RSymbol.is(target) && RFunctionDefinition.is(value) && (canonical || !assign.right)) {
					this.name = leafText(target);
				}
				if(canonical && assign) {
					return this.node(n, `${n.type}:${assign.super ? '<<-' : '<-'}`, parent, i => this.visitAll([target, value], i));
				}
				break;
			}
			case RType.Symbol: {
				const value = this.inline?.replace.get(n.info.id);
				if(value !== undefined) {
					return this.visit(value, parent);
				}
				const text = leafText(n);
				if(canonical && (text === 'T' || text === 'F')) {
					return this.node(n, `${RType.Logical}:`, parent, undefined, text === 'T' ? 'TRUE' : 'FALSE');
				}
				break;
			}
		}
		this.node(n, typeLabel, parent, i => this.visitAll(RNode.directChildren(n), i), leafText(n));
	}

	/**
	 * Rewrites `x |> f(y)` and `x %>% f(y)` to `f(x, y)` and `x %>% f` to `f(x)`; a direct `placeholder` argument
	 * receives `x` instead. Returns `false` if the rhs is no call (or symbol for magrittr).
	 */
	private visitPipe(pipe: Node, lhs: Node, rhs: Node, placeholder: string, parent: number): boolean {
		const value = RArgument.is(lhs) && lhs.value ? lhs.value : lhs;
		const insert = (i: number) => this.node(value, `${RType.Argument}:`, i, a => this.visit(value, a));
		if(RSymbol.is(rhs) && placeholder === '.') {
			this.node(pipe, `${RType.FunctionCall}:`, parent, i => {
				this.visit(rhs, i);
				insert(i);
			});
			return true;
		}
		if(!RFunctionCall.is(rhs)) {
			return false;
		}
		const isPlaceholder = (a: Child): a is RArgument<ParentInformation> => a !== EmptyArgument && RArgument.is(a) && RSymbol.is(a.value) && a.value.content === placeholder;
		const hasPlaceholder = rhs.arguments.some(isPlaceholder);
		this.node(rhs, `${RType.FunctionCall}:`, parent, i => {
			this.visit(rhs.named ? rhs.functionName : rhs.calledFunction, i);
			if(!hasPlaceholder) {
				insert(i);
			}
			for(const a of rhs.arguments) {
				if(isPlaceholder(a)) {
					this.node(a, `${RType.Argument}:`, i, ai => this.visitAll([a.name, value], ai));
				} else {
					this.visitAll([a], i);
				}
			}
		});
		return true;
	}

	build(file: string): CloneAst {
		const token = this.token.map((t, i) => mixHash(t, this.arity[i]));
		return { file, token, lex: this.lex, size: this.size, id: this.id, span: this.span, functions: this.functions };
	}
}

/**
 * Flattens the normalized AST of one file into a {@link CloneAst}, see {@link ClonePerspective}.
 * Prefer {@link CloneIndex.build}, which also prepares the `inline` plan and `graph` of the `dataflow` perspective.
 * @example
 * ```ts
 * const ast = buildCloneAst((await analyzer.normalize()).ast.files[0].root, 'a.R');
 * ```
 */
export function buildCloneAst(root: Node, file: string, perspective: ClonePerspective = ClonePerspective.Canonical, inline?: InlinePlan, graph?: DataflowGraph): CloneAst {
	const b = new CloneAstBuilder(perspective !== ClonePerspective.Syntax, inline, graph);
	b.visit(root, -1);
	return b.build(file);
}

/** Iterates the preorder indices of the direct children of node `i`. */
export function* cloneChildren(ast: CloneAst, i: number): Generator<number> {
	for(let c = i + 1; c < i + ast.size[i]; c += ast.size[c]) {
		yield c;
	}
}

/**
 * The token string of the subtree `[from, from + size[from])` (the whole file for `from = 0`), one token per node.
 * The token of a node includes its number of children, so the string determines the shape of the subtree.
 */
export function tokenize(ast: CloneAst, mode: CloneTokenization, from = 0): number[] {
	const tokens = ast.token.slice(from, from + ast.size[from]);
	return mode === CloneTokenization.Exact ? tokens.map((t, k) => ast.lex[from + k] === 0 ? t : mixHash(t, ast.lex[from + k])) : tokens;
}
