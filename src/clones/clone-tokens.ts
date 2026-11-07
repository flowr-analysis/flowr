import { assignmentOperator, type CloneAst, CloneNodeKind, cloneLabel, hashString, mixHash } from './clone-ast';
import { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RawRType } from '../r-bridge/lang-4.x/ast/model/type';
import { BuiltInOperators } from '../dataflow/environments/default-builtin-config/operators';

/**
 * How a {@link CloneAst} is turned into a token string for the token-based detectors.
 * - `jplag`: the token set of JPlag's R language module, see {@link JPlagRToken}
 * - `normalized`: one token per AST node (kind and operator), identifiers and constants abstracted (type-2 clones)
 * - `exact`: like `normalized`, but leaves keep their lexeme (type-1 clones)
 *
 * Use `jplag` if you want results comparable with JPlag (and the {@link ClonePerspective.Syntax} perspective, as
 * JPlag's grammar sees the code as written), `normalized` for renamed copies, and `exact` for verbatim copies.
 * @example
 * ```ts
 * const exact = tokenize(ast, CloneTokenization.Exact).values;
 * const renamed = tokenize(ast, CloneTokenization.Normalized).values; // equal for `x <- 1` and `y <- 2`
 * ```
 */
export enum CloneTokenization {
	Jplag      = 'jplag',
	Normalized = 'normalized',
	Exact      = 'exact'
}

/**
 * The token types of JPlag's R language module, in their declaration order.
 * Quoted from JPlag (GPL-3.0), `languages/rlang/src/main/java/de/jplag/rlang/RTokenType.java`
 * at commit 3ee7de912b90ef82462fa1fbe0a57aa48b4e8f15, which itself is "based on an R module for JPlag v2.15 by Olmo Kramer".
 * Member names are JPlag's in PascalCase (`BEGIN_FUNCTION` is `BeginFunction`).
 * `FILE_END` is JPlag's shared pivot token that ends every token list and is never matched.
 */
export const enum JPlagRToken {
	BeginFunction = 1, EndFunction, FunctionCall, Number, String, Bool, Assign, AssignFunc, AssignList, Help,
	Index, Package, IfBegin, IfEnd, ForBegin, ForEnd, WhileBegin, WhileEnd, RepeatBegin, RepeatEnd,
	Next, Break, CompoundBegin, CompoundEnd
}

/**
 * The node before whose tokens JPlag's grammar puts the enter tokens of node `i`. ANTLR orders the alternatives of
 * `expr` in `R.g4` by precedence, and `FunctionCall` comes after every operator, the prefix ones (`-x`, `!x`, `~x`,
 * `function(x) e`) included: `x <- f(1)` parses as `(x <- f)(1)` and `-f(1)` as `(-f)(1)`, so a call that ends such
 * a chain of operators is entered before them. Likewise, `NamespaceAccess` binds weaker than indexing, so
 * `pkg::x[1]` is `pkg::(x[1])` and its `PACKAGE` comes before the `INDEX`.
 */
function jplagHoist(ast: CloneAst, i: number, from: number): number {
	const last = (p: number, c: number) => c + ast.size[c] === p + ast.size[p];
	let c = i;
	if(ast.kind[i] === CloneNodeKind.FunctionCall && ast.op[i] !== 'infix') {
		for(let p = ast.parent[c]; p >= from && last(p, c); p = ast.parent[c]) {
			const k = ast.kind[p];
			const prefix = k === CloneNodeKind.UnaryOp && (ast.op[p] === '-' || ast.op[p] === '+' || ast.op[p] === '!' || ast.op[p] === '~');
			if(k !== CloneNodeKind.BinaryOp && !prefix && k !== CloneNodeKind.FunctionDefinition && !(k === CloneNodeKind.ExpressionList && ast.parent[p] >= 0)) {
				break;
			}
			c = p;
		}
	} else if(ast.kind[i] === CloneNodeKind.Symbol && ast.text[i].includes('::')) {
		for(let p = ast.parent[c]; p >= from && p + 1 === c && ast.kind[p] === CloneNodeKind.Access && !RAccess.isNamedOperator(ast.op[p]); p = ast.parent[c]) {
			c = p;
		}
	}
	return c;
}

/**
 * The pivot token value terminating each token string, it never matches anything.
 * Pass it to {@link gstSequence}, as all other token values are positive.
 */
export const FileEndToken = 0;

/**
 * A token string over a {@link CloneAst}: token values and, per token, the preorder node it stems from and whether
 * it is emitted when leaving that node (then it stands for the end of the node, otherwise for its start).
 */
export interface CloneTokens {
	readonly values: Int32Array;
	readonly nodes:  Int32Array;
	readonly exits:  Uint8Array;
}

/**
 * A call or index without any argument still has one (empty) `sub`, whose `ASSIGN_LIST` comes after the tokens of
 * the callee/accessed object, so we emit it like an exit token.
 */
function emptySub(ast: CloneAst, i: number): number {
	return ast.size[i] === 1 + ast.size[i + 1] ? JPlagRToken.AssignList : 0;
}


/**
 * Maps one node to the tokens JPlag's `RListener` emits when entering it (pushed to `out`) and returns the token
 * emitted when leaving it (or 0). This mirrors the listener rules (quoted from `RListener.java` at the commit above):
 * ```java
 * visit(ArrayAccessContext.class).mapRange(INDEX);  visit(ListAccessContext.class).mapRange(INDEX);
 * visit(NamespaceAccessContext.class).map(PACKAGE);
 * visit(FunctionDefinitionContext.class).map(BEGIN_FUNCTION, END_FUNCTION);
 * visit(FunctionCallContext.class).mapRange(FUNCTION_CALL);
 * visit(CompoundStatementContext.class).map(COMPOUND_BEGIN, COMPOUND_END);
 * visit(HelpContext.class).map(HELP);
 * visit(HexContext|IntContext|FloatContext|ComplexContext).map(NUMBER); visit(StringContext.class).map(STRING);
 * visit(TrueContext.class).map(BOOL); visit(FalseContext.class).map(BOOL);
 * visit(IfContext|IfElseContext).map(IF_BEGIN, IF_END); visit(ForContext.class).map(FOR_BEGIN, FOR_END);
 * visit(WhileContext.class).map(WHILE_BEGIN, WHILE_END); visit(RepeatContext.class).map(REPEAT_BEGIN, REPEAT_END);
 * visit(NextContext.class).map(NEXT); visit(BreakContext.class).map(BREAK);
 * visit(AssignmentContext.class, context -> context.ASSIGN() != null).map(ASSIGN);
 * visit(AssignmentContext.class, context -> context.EQUALS() != null).map(ASSIGN_FUNC);
 * visit(SubContext.class).map(ASSIGN_LIST);
 * ```
 * In JPlag's `R.g4`, `sub` (one slot of the argument list of a call or an index) has an empty alternative, so an
 * empty slot (`x[1, ]`, and the single slot of `f()`) still yields `ASSIGN_LIST`. `Inf`, `NaN`, `NA`, and `NULL`
 * yield nothing (`Inf` and `NaN` lex as identifiers, `NA` and `NULL` are rules without a mapping); `T`/`F` are identifiers.
 * JPlag's grammar predates `|>` and `\(x)`; we emit nothing for the former and treat the latter as `function`.
 */
function jplagEnter(ast: CloneAst, i: number, out: number[]): number {
	switch(ast.kind[i]) {
		case CloneNodeKind.FunctionDefinition:
			out.push(JPlagRToken.BeginFunction);
			return JPlagRToken.EndFunction;
		case CloneNodeKind.FunctionCall:
			// `a %op% b` is a `UserDefinedOperation` without tokens
			if(ast.op[i] === 'infix') {
				return 0;
			}
			out.push(JPlagRToken.FunctionCall);
			return emptySub(ast, i);
		case CloneNodeKind.Access: {
			const op = ast.op[i];
			if(!RAccess.isNamedOperator(op)) {
				out.push(JPlagRToken.Index);
				return emptySub(ast, i);
			}
			return 0;
		}
		case CloneNodeKind.Argument:
		case CloneNodeKind.EmptyArgument: {
			// arguments of `$`/`@` and operands of `%op%` are no `sub`
			const p = ast.parent[i];
			if(ast.kind[p] === CloneNodeKind.FunctionCall ? ast.op[p] !== 'infix' : (ast.kind[p] !== CloneNodeKind.Access || !RAccess.isNamedOperator(ast.op[p]))) {
				out.push(JPlagRToken.AssignList);
				// `sub: expr | ID EQUALS expr | ...` resolves `a = 1` to its first alternative, an `Assignment` with `EQUALS`
				if(ast.op[i] === '=' && ast.size[i] > 1) {
					out.push(JPlagRToken.AssignFunc);
				}
			}
			return 0;
		}
		case CloneNodeKind.Brace:
			out.push(JPlagRToken.CompoundBegin);
			return JPlagRToken.CompoundEnd;
		case CloneNodeKind.BinaryOp: {
			const op = ast.op[i];
			// `R.g4`: `ASSIGN: '<-' | '<<-' | '->' | '->>' | ':='` and `EQUALS: '='`
			const assign = assignmentOperator(op);
			if(assign) {
				out.push(assign.equal ? JPlagRToken.AssignFunc : JPlagRToken.Assign);
			} else if(BuiltInOperators.byName[op]?.stringUsedInRAst === RawRType.Question) {
				out.push(JPlagRToken.Help);
			}
			return 0;
		}
		case CloneNodeKind.UnaryOp:
			if(BuiltInOperators.byName[ast.op[i]]?.stringUsedInRAst === RawRType.Question) {
				out.push(JPlagRToken.Help);
			}
			return 0;
		case CloneNodeKind.IfThenElse:
			out.push(JPlagRToken.IfBegin);
			return JPlagRToken.IfEnd;
		case CloneNodeKind.ForLoop:
			out.push(JPlagRToken.ForBegin);
			return JPlagRToken.ForEnd;
		case CloneNodeKind.WhileLoop:
			out.push(JPlagRToken.WhileBegin);
			return JPlagRToken.WhileEnd;
		case CloneNodeKind.RepeatLoop:
			out.push(JPlagRToken.RepeatBegin);
			return JPlagRToken.RepeatEnd;
		case CloneNodeKind.Next:
			out.push(JPlagRToken.Next);
			return 0;
		case CloneNodeKind.Break:
			out.push(JPlagRToken.Break);
			return 0;
		case CloneNodeKind.Number: {
			const t = ast.text[i];
			if(t !== 'Inf' && t !== 'NaN') {
				out.push(JPlagRToken.Number);
			}
			return 0;
		}
		case CloneNodeKind.String:
			out.push(JPlagRToken.String);
			return 0;
		case CloneNodeKind.Logical:
			out.push(JPlagRToken.Bool);
			return 0;
		case CloneNodeKind.Symbol:
			if(ast.op[i] === 'quoted') {
				// `R.g4` lexes a backticked name as `STRING`
				out.push(JPlagRToken.String);
			} else if(ast.text[i].includes('::')) {
				out.push(JPlagRToken.Package);
			}
			return 0;
		default:
			return 0;
	}
}

/**
 * Token values are 31-bit and never the pivot 0, as JPlag's token values are small non-negative numbers: its
 * rolling hash then stays non-negative and never collides with its `NO_HASH` marker (-1).
 */
function nonNegative(h: number): number {
	return (h >>> 1) || 1;
}

const labelHashes = new Map<string, number>();
function labelHash(label: string): number {
	let h = labelHashes.get(label);
	if(h === undefined) {
		h = nonNegative(hashString(label));
		labelHashes.set(label, h);
	}
	return h;
}

function hasEndToken(kind: CloneNodeKind): boolean {
	switch(kind) {
		case CloneNodeKind.Brace:
		case CloneNodeKind.FunctionDefinition:
		case CloneNodeKind.IfThenElse:
		case CloneNodeKind.ForLoop:
		case CloneNodeKind.WhileLoop:
		case CloneNodeKind.RepeatLoop:
		case CloneNodeKind.FunctionCall:
			return true;
		default:
			return false;
	}
}

function isLeaf(kind: CloneNodeKind): boolean {
	return kind === CloneNodeKind.Symbol || kind === CloneNodeKind.Number || kind === CloneNodeKind.String || kind === CloneNodeKind.Logical
		|| kind === CloneNodeKind.Parameter || kind === CloneNodeKind.Argument;
}

/**
 * Tokenizes the subtree `[from, from + size[from])` of `ast` (the whole file for `from = 0`).
 * The result does not include the {@link FileEndToken} pivot, which {@link gstSequence} appends.
 * The `jplag` mode inserts tokens in front of already emitted ones where JPlag's grammar does, which costs
 * extra time for deeply nested calls compared to the other modes.
 * @example
 * ```ts
 * const { values, nodes } = tokenize(ast, CloneTokenization.Jplag);
 * values.length === nodes.length; // true, nodes[t] is the preorder index of the AST node of token t
 * const perFunction = ast.functions.map(f => tokenize(ast, CloneTokenization.Normalized, f.node));
 * ```
 */
export function tokenize(ast: CloneAst, mode: CloneTokenization, from = 0): CloneTokens {
	const values: number[] = [];
	const nodes: number[] = [];
	const exits: number[] = [];
	const end = from + ast.size[from];
	// pending end tokens: [subtree end, token, node]
	const closing: number[] = [];
	const enter: number[] = [];
	// where the tokens of a node start, to place the tokens JPlag's grammar puts before the node's ancestors
	const startOf = new Map<number, number>();
	const flush = (upTo: number) => {
		while(closing.length > 0 && closing[closing.length - 3] <= upTo) {
			const node = closing.pop() as number;
			const token = closing.pop() as number;
			closing.pop();
			values.push(token);
			nodes.push(node);
			exits.push(1);
		}
	};
	for(let i = from; i < end; i++) {
		flush(i);
		const kind = ast.kind[i];
		let exit = 0;
		if(mode === CloneTokenization.Jplag) {
			startOf.set(i, values.length);
			enter.length = 0;
			exit = jplagEnter(ast, i, enter);
			const at = enter.length > 0 ? startOf.get(jplagHoist(ast, i, from)) ?? values.length : values.length;
			values.splice(at, 0, ...enter);
			nodes.splice(at, 0, ...enter.map(() => i));
			exits.splice(at, 0, ...enter.map(() => 0));
		} else {
			const label = cloneLabel(ast, i);
			let v = labelHash(label);
			if(mode === CloneTokenization.Exact && isLeaf(kind) && ast.lex[i] !== 0) {
				v = nonNegative(mixHash(v, ast.lex[i]));
			}
			values.push(v);
			nodes.push(i);
			exits.push(0);
			if(hasEndToken(kind)) {
				exit = labelHash('/' + label);
			}
		}
		if(exit !== 0) {
			closing.push(i + ast.size[i], exit, i);
		}
	}
	flush(end);
	return { values: Int32Array.from(values), nodes: Int32Array.from(nodes), exits: Uint8Array.from(exits) };
}
