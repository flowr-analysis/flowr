import { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RComment } from '../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { RLineDirective } from '../r-bridge/lang-4.x/ast/model/nodes/r-line-directive';
import { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { RawRType, RType } from '../r-bridge/lang-4.x/ast/model/type';
import { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EmptyArgument, RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RPipe } from '../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { Identifier } from '../dataflow/environments/identifier';
import { OperatorUsedAs } from '../dataflow/environments/default-builtin-config/base-operators';

type Node = RNode<ParentInformation>;
/** A node as the detectors see it, including the empty argument of `f(, x)`. */
export type CloneNode = Node | typeof EmptyArgument;

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

/** The normalized AST of one file and, for the `dataflow` perspective, the temporaries to inline in it. */
export interface CloneAst {
	readonly file:    string;
	readonly root:    Node;
	readonly inline?: InlinePlan;
}

/**
 * One file as presented to the detectors, in preorder: the subtree of `nodes[i]` is `[i, i + size[i])`.
 * Rewritten nodes carry the info (and id) of the node they stem from.
 */
export interface CloneTree {
	readonly file:  string;
	readonly nodes: readonly CloneNode[];
	/** type, operator, and number of children of each node, which the detectors compare */
	readonly shape: readonly string[];
	readonly size:  readonly number[];
	/** the names function definitions (by preorder index) are bound to */
	readonly names: ReadonlyMap<number, string>;
}

/** The target and value of an assignment as the operator database describes it, `undefined` for other nodes. */
export function assignment(n: Node): { readonly target: Node, readonly value: Node, readonly super: boolean } | undefined {
	const facts = RBinaryOp.is(n) ? RBinaryOp.getOperatorInfo(n) : undefined;
	if(!RBinaryOp.is(n) || facts?.usedAs !== OperatorUsedAs.Assignment) {
		return undefined;
	}
	const right = facts.stringUsedInRAst === RawRType.RightAssign;
	return { target: right ? n.rhs : n.lhs, value: right ? n.lhs : n.rhs, super: facts.capabilities.some(c => c.startsWith('super-')) };
}

/** The identifier or constant of a leaf, empty for other nodes. */
export function leafText(n: CloneNode): string {
	if(n === EmptyArgument) {
		return '';
	}
	switch(n.type) {
		case RType.Symbol:  return Identifier.toString(n.content);
		case RType.Number: case RType.String: case RType.Logical: return n.lexeme;
		default:            return '';
	}
}

function withoutTailReturn(body: Node): Node {
	const last = RExpressionList.is(body) ? body.children.at(-1) : undefined;
	const arg = RFunctionCall.isNamed(last, 'return') && last.arguments.length === 1 ? last.arguments[0] : EmptyArgument;
	return RExpressionList.is(body) && arg !== EmptyArgument && arg.name === undefined && arg.value ? { ...body, children: [...body.children.slice(0, -1), arg.value] } : body;
}

/**
 * Rewrites `x |> f(y)` and `x %>% f(y)` to `f(x, y)` and `x %>% f` to `f(x)`; a direct `placeholder` argument
 * receives `x` instead. Returns `undefined` if the rhs is no call (or symbol for magrittr).
 */
function pipe(n: RFunctionCall<ParentInformation> | RPipe<ParentInformation>, lhs: Node, rhs: Node, placeholder: string): Node | undefined {
	const x = RArgument.is(lhs) && lhs.value ? lhs.value : lhs;
	const arg: RArgument<ParentInformation> = { type: RType.Argument, name: undefined, value: x, lexeme: '', location: n.location, info: x.info };
	if(RSymbol.is(rhs) && placeholder === '.') {
		return { type: RType.FunctionCall, named: true, functionName: rhs, arguments: [arg], lexeme: n.lexeme, location: n.location, info: n.info };
	} else if(!RFunctionCall.is(rhs)) {
		return undefined;
	}
	const args = rhs.arguments.map(a => a !== EmptyArgument && RSymbol.is(a.value) && a.value.content === placeholder ? { ...a, value: x } : a);
	return { ...rhs, arguments: args.some((a, i) => a !== rhs.arguments[i]) ? args : [arg, ...args] };
}

/** The node `n` as the perspective presents it, see {@link ClonePerspective}; its children are presented by {@link cloneChildren}. */
function present(n: Node, canonical: boolean, inline: InlinePlan | undefined): CloneNode {
	const value = inline?.replace.get(n.info.id);
	if(value !== undefined) {
		return present(value, canonical, inline);
	} else if(!canonical) {
		return n;
	}
	switch(n.type) {
		case RType.ExpressionList: {
			const children = cloneChildren(n, canonical, inline);
			return children.length === 1 ? children[0] : n;
		}
		case RType.FunctionDefinition:
			return { ...n, body: withoutTailReturn(n.body) };
		case RType.FunctionCall: {
			const [lhs, rhs] = n.arguments;
			return RFunctionCall.isNamed(n, '%>%') && n.arguments.length === 2 && lhs !== EmptyArgument && rhs !== EmptyArgument && rhs.value ? pipe(n, lhs, rhs.value, '.') ?? n : n;
		}
		case RType.Pipe:
			return pipe(n, n.lhs, n.rhs, '_') ?? n;
		case RType.Access: {
			const a = n.access[0];
			const field = a !== EmptyArgument && a.name === undefined && (RAccess.isNamed(n) || n.operator === '[[' && n.access.length === 1) ? a.value : undefined;
			if(a === EmptyArgument || !RString.is(field)) {
				return n;
			}
			const symbol: RSymbol<ParentInformation> = { type: RType.Symbol, content: field.content.str, lexeme: field.content.str, location: field.location, info: field.info };
			return { ...n, operator: n.operator === '@' ? '@' : '$', access: [{ ...a, name: undefined, value: symbol }] };
		}
		case RType.BinaryOp: {
			const a = assignment(n);
			return a ? { ...n, operator: a.super ? '<<-' : '<-', lhs: a.target, rhs: a.value } : n;
		}
		case RType.Symbol: {
			const text = leafText(n);
			return text === 'T' || text === 'F' ? { type: RType.Logical, content: text === 'T', lexeme: text === 'T' ? 'TRUE' : 'FALSE', location: n.location, info: n.info } : n;
		}
	}
	return n;
}

/** The direct children of `n` as the perspective presents them, without comments (and the field of `x$f`). */
export function cloneChildren(n: CloneNode, canonical: boolean, inline?: InlinePlan): CloneNode[] {
	if(n === EmptyArgument) {
		return [];
	}
	const children = RExpressionList.is(n) ? n.children.filter(c => !inline?.drop.has(c.info.id)) : RAccess.is(n) ? [n.accessed, ...n.access] : RNode.directChildren(n);
	return children.filter(c => c === EmptyArgument || !RComment.is(c) && !RLineDirective.is(c)).map(c => c === EmptyArgument ? c : present(c, canonical, inline));
}

/**
 * Presents the AST of one file in preorder, see {@link CloneTree}.
 * @example
 * ```ts
 * const tree = cloneTree(index.files[0], index.perspective);
 * ```
 */
export function cloneTree({ file, root, inline }: CloneAst, perspective: ClonePerspective): CloneTree {
	const canonical = perspective !== ClonePerspective.Syntax;
	const nodes: CloneNode[] = [], shape: string[] = [], size: number[] = [], names = new Map<number, string>();
	const visit = (n: CloneNode, name: string | undefined): void => {
		const i = nodes.length;
		const children = cloneChildren(n, canonical, inline);
		const kind = n === EmptyArgument ? n : `${n.type}${'operator' in n ? String(n.operator) : ''}${RExpressionList.is(n) ? n.grouping?.[0].lexeme ?? '' : ''}`;
		nodes.push(n);
		shape.push(`${kind}/${children.length}`);
		size.push(1);
		if(name !== undefined && n !== EmptyArgument && RFunctionDefinition.is(n)) {
			names.set(i, name);
		}
		const a = n === EmptyArgument ? undefined : assignment(n);
		const bound = a && RSymbol.is(a.target) && RFunctionDefinition.is(a.value) ? leafText(a.target) : undefined;
		children.forEach(c => visit(c, bound));
		size[i] = nodes.length - i;
	};
	visit(root, undefined);
	return { file, nodes, shape, size, names };
}

/**
 * The token string of the subtree at `from` (the whole file for `from = 0`), one token per node.
 * The token of a node includes its number of children, so the string determines the shape of the subtree.
 */
export function tokenize(tree: CloneTree, mode: CloneTokenization, from = 0): string[] {
	const tokens = tree.shape.slice(from, from + tree.size[from]);
	return mode === CloneTokenization.Exact ? tokens.map((t, k) => `${t} ${leafText(tree.nodes[from + k])}`) : tokens;
}
