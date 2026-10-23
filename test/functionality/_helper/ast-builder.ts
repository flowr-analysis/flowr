import { SourceRange } from '../../../src/util/range';
import type { RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import type { RExpressionList } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import type { RNumberValue } from '../../../src/r-bridge/lang-4.x/convert-values';
import type { RParameter } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { RSymbol } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RNumber } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RLogical } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RComment } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-comment';
import type { RArgument } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RBinaryOp } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { RUnaryOp } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import type { RAccess } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { PotentiallyEmptyRArgument, RFunctionCall } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { Identifier } from '../../../src/dataflow/environments/identifier';

const emptyInfo = { fullRange: undefined, adToks: [], fullLexeme: undefined, nest: 0 };


/**
 * An expression list holding `children`, with no location and no lexeme, as a test expectation wants it.
 * @param children - what the list holds
 */
export function exprList(...children: RNode[]): RExpressionList {
	return { type: RType.ExpressionList, children, lexeme: undefined, info: emptyInfo, grouping: undefined, location: undefined };
}

/**
 * An R number value.
 * @param value         - the number itself
 * @param markedAsInt   - whether the source wrote it as `1L`
 * @param complexNumber - whether the source wrote it as `1i`
 */
export function numVal(value: number, markedAsInt = false, complexNumber = false): RNumberValue {
	return { num: value, markedAsInt, complexNumber };
}


/**
 * A function parameter.
 * @param name         - the parameter's name
 * @param location     - where the name is written
 * @param defaultValue - what it falls back to, absent for a parameter without one
 * @param special      - whether this is the `...` parameter
 */
export function parameter(name: string, location: SourceRange, defaultValue?: RNode, special = false): RParameter {
	return {
		type:   RType.Parameter,
		location,
		special,
		lexeme: name,
		defaultValue,
		name:   {
			type:    RType.Symbol,
			location,
			lexeme:  name,
			content: name,
			info:    emptyInfo
		},
		info: emptyInfo
	};
}

/** Where a token sits: `[line, column]` for a token on one line (its end follows from the lexeme) or `[line, column, endLine, endColumn]`. */
export type Pos = readonly [line: number, col: number] | readonly [line: number, col: number, endLine: number, endCol: number];

/** Turns a {@link Pos} and the token's lexeme into the range the normalizer reports. */
export function rangeOf(pos: Pos, lexeme: string): SourceRange {
	return pos.length === 4 ? SourceRange.from(pos[0], pos[1], pos[2], pos[3]) : SourceRange.from(pos[0], pos[1], pos[0], pos[1] + lexeme.length - 1);
}

type Adtoks = RComment[];
function infoOf(adToks?: Adtoks) {
	return adToks ? { adToks } : {};
}

/** A symbol; `content` defaults to the lexeme. */
export function sym(lexeme: string, pos: Pos, content: Identifier | string = lexeme): RSymbol {
	return { type: RType.Symbol, location: rangeOf(pos, lexeme), lexeme, content: content, info: {} };
}

/** A number; `value` defaults to the lexeme parsed as a plain number. */
export function num(lexeme: string, pos: Pos, value: number | RNumberValue = Number(lexeme)): RNumber {
	return { type: RType.Number, location: rangeOf(pos, lexeme), lexeme, content: typeof value === 'number' ? numVal(value) : value, info: {} };
}

/** A string; the quotes come from the lexeme and `str` is the unescaped content. */
export function str(lexeme: string, pos: Pos, content: string): RString {
	return { type: RType.String, location: rangeOf(pos, lexeme), lexeme, content: { str: content, quotes: lexeme[0] as '"' | "'" }, info: {} };
}

/** `TRUE` or `FALSE`. */
export function lgl(lexeme: 'TRUE' | 'FALSE', pos: Pos): RLogical {
	return { type: RType.Logical, location: rangeOf(pos, lexeme), lexeme, content: lexeme === 'TRUE', info: {} };
}

/** A comment as it appears in the `adToks` of the node it is attached to. */
export function comment(lexeme: string, pos: Pos): RComment {
	return { type: RType.Comment, location: rangeOf(pos, lexeme), lexeme, info: {} };
}

/** `lhs op rhs`, with `pos` being the position of the operator. */
export function bin(operator: string, pos: Pos, lhs: RNode, rhs: RNode, adToks?: Adtoks): RBinaryOp {
	return { type: RType.BinaryOp, operator, location: rangeOf(pos, operator), lexeme: operator, lhs, rhs, info: infoOf(adToks) };
}

/** `op operand`, with `pos` being the position of the operator. */
export function un(operator: string, pos: Pos, operand: RNode, adToks?: Adtoks): RUnaryOp {
	return { type: RType.UnaryOp, operator, location: rangeOf(pos, operator), lexeme: operator, operand, info: infoOf(adToks) };
}

/**
 * An argument; location and lexeme come from its name (or else its value) unless `over` states them.
 * @param value - the value, absent for `f(x=)`
 * @param name  - the argument's name, if any
 * @param over  - lexeme/location where the argument spans more than its name or value
 */
export function arg(value: RNode | undefined, name?: RSymbol, over?: { readonly lexeme?: string, readonly location?: SourceRange }): RArgument {
	const from = (name ?? value) as RNode & { location: SourceRange };
	return {
		type:     RType.Argument,
		location: over?.location ?? from.location,
		lexeme:   over?.lexeme ?? from.lexeme as string,
		name:     name as RArgument['name'],
		value,
		info:     {}
	};
}

/** A call of a named function; location and lexeme default to those of the function name. */
export function call(functionName: RSymbol, args: readonly PotentiallyEmptyRArgument[] = [], over?: { readonly lexeme?: string, readonly location?: SourceRange, readonly adToks?: Adtoks }): RFunctionCall {
	return {
		type:      RType.FunctionCall,
		named:     true,
		location:  over?.location ?? functionName.location,
		lexeme:    over?.lexeme ?? functionName.lexeme,
		functionName,
		arguments: args,
		info:      infoOf(over?.adToks)
	};
}

/** A call of an expression (`(function(x) x)(2)`, `a(1)(2)`). */
export function callExpr(calledFunction: RNode, args: readonly PotentiallyEmptyRArgument[], location: SourceRange, lexeme: string): RFunctionCall {
	return { type: RType.FunctionCall, named: undefined, location, lexeme, calledFunction, arguments: args, info: {} };
}

/** An access with `op` (`[`, `[[`, `$`, `@`) located at `pos`. */
export function access(operator: '[' | '[[' | '$' | '@', pos: Pos, accessed: RNode, args: readonly PotentiallyEmptyRArgument[], adToks?: Adtoks): RAccess {
	return { type: RType.Access, operator, location: rangeOf(pos, operator), lexeme: operator, accessed, access: args, info: infoOf(adToks) } as RAccess;
}

/** A braced (`{`) or parenthesized (`(`) group with the delimiters at `open` and `close`. */
export function group(kind: '{' | '(', open: Pos, close: Pos, ...children: RNode[]): RExpressionList {
	const closing = kind === '{' ? '}' : ')';
	return { ...exprList(...children), grouping: [sym(kind, open), sym(closing, close)] };
}
