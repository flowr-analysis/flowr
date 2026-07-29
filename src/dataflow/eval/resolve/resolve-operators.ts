import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { Identifier } from '../../environments/identifier';
import { isRNumberValue, unliftRValue } from '../../../util/r-value';
import type { BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { ValueLogicalFalse, ValueLogicalTrue } from '../values/logical/logical-constants';
import { Top, type Value } from '../values/r-value';
import { liftScalar } from '../values/scalar/scalar-constants';
import { intervalFrom } from '../values/intervals/interval-constants';
import { vectorFrom } from '../values/vectors/vector-constants';
import { valueSetGuard } from '../values/general';
import { resolveIdToValue } from './alias-tracking';

/** the scalar an operand folds to, with a logical counting as its `0`/`1` just like R would coerce it */
function operand(node: RNodeWithParent, args: BuiltInEvalHandlerArgs): number | string | undefined {
	const value = unliftRValue(resolveIdToValue(node, args));
	if(typeof value === 'boolean') {
		return Number(value);
	} else if(isRNumberValue(value)) {
		return value.complexNumber ? undefined : value.num;
	}
	return typeof value === 'object' && value !== null && 'str' in value ? value.str : undefined;
}

/** as a condition, R takes any non-zero number for `TRUE`; `NA`, strings and everything else do not fold */
function asLogical(node: RNodeWithParent, args: BuiltInEvalHandlerArgs): boolean | undefined {
	const value = operand(node, args);
	return typeof value === 'number' && !Number.isNaN(value) ? value !== 0 : undefined;
}

/** the operands of a binary operator and its entry in `ops`, with R presenting the `%.%` ones as an infix call */
function binary<T>(node: RNodeWithParent, ops: Record<string, T>): { op: T, lhs: RNodeWithParent, rhs: RNodeWithParent } | undefined {
	let name: string, lhs: RNodeWithParent | undefined, rhs: RNodeWithParent | undefined;
	if(node.type === RType.BinaryOp) {
		[name, lhs, rhs] = [node.operator, node.lhs, node.rhs];
	} else if(node.type === RType.FunctionCall && node.named && node.arguments.length === 2) {
		const [l, r] = node.arguments;
		name = Identifier.getName(node.functionName.content);
		/* a named argument may swap the operands, as in `` `-`(e2 = 1, e1 = 5) ``, so we only take positional ones */
		[lhs, rhs] = [l === EmptyArgument || l.name ? undefined : l.value, r === EmptyArgument || r.name ? undefined : r.value];
	} else {
		return undefined;
	}
	const op = ops[name] as T | undefined;
	return op === undefined || lhs === undefined || rhs === undefined ? undefined : { op, lhs, rhs };
}

function logicalValue(value: boolean): Value {
	return value ? ValueLogicalTrue : ValueLogicalFalse;
}

/** R rounds `%%` and `%/%` towards `-Inf`, unlike the JS `%` */
export const ArithmeticOps = {
	'+':   (a: number, b: number) => a + b,
	'-':   (a: number, b: number) => a - b,
	'*':   (a: number, b: number) => a * b,
	'/':   (a: number, b: number) => a / b,
	'^':   (a: number, b: number) => a ** b,
	'**':  (a: number, b: number) => a ** b,
	'%%':  (a: number, b: number) => a - Math.floor(a / b) * b,
	'%/%': (a: number, b: number) => Math.floor(a / b)
} as const satisfies Record<string, (a: number, b: number) => number>;

/**
 * Resolves an arithmetic operator to a {@link Value} number: the unary `+`/`-` on a number or number vector, and the
 * binary {@link ArithmeticOps} on two number scalars. Anything else (a vector operand, `NA`, a non-finite result) is Top.
 */
export function resolveAsArithmetic(args: BuiltInEvalHandlerArgs): Value {
	const node = args.node;
	if(node.type === RType.UnaryOp) {
		if(node.operator !== '-' && node.operator !== '+') {
			return Top;
		}
		const sign = node.operator === '-' ? -1 : 1;
		const value = unliftRValue(resolveIdToValue(node.operand, args));
		if(isRNumberValue(value)) {
			return value.complexNumber ? Top : intervalFrom(value.num * sign, value.num * sign);
		}
		return Array.isArray(value) && value.every(isRNumberValue) ?
			vectorFrom(value.map(e => liftScalar({ ...e, num: e.num * sign }))) : Top;
	}
	const bin = binary(node, ArithmeticOps);
	if(bin === undefined) {
		return Top;
	}
	const lhs = unliftRValue(resolveIdToValue(bin.lhs, args));
	const rhs = unliftRValue(resolveIdToValue(bin.rhs, args));
	if(!isRNumberValue(lhs) || !isRNumberValue(rhs) || lhs.complexNumber || rhs.complexNumber) {
		return Top;
	}
	const num = bin.op(lhs.num, rhs.num);
	return Number.isFinite(num) ? intervalFrom(num, num) : Top;
}

/** R breaks a tie to the even neighbor, unlike `Math.round`, which always goes up */
function roundHalfEven(x: number): number {
	const below = Math.floor(x);
	if(x - below !== 0.5) {
		return Math.round(x);
	}
	return below % 2 === 0 ? below : below + 1;
}

/** the one-argument math builtins {@link resolveAsMath} folds, all of which R names their argument `x` */
export const MathFns = {
	abs:     Math.abs,
	sqrt:    Math.sqrt,
	floor:   Math.floor,
	ceiling: Math.ceil,
	round:   roundHalfEven
} as const satisfies Record<string, (x: number) => number>;

/**
 * Resolves a {@link MathFns} call on a single number scalar, with a logical counting as its `0`/`1`.
 * A further argument (as in `round(x, digits)`) or a non-finite result (`sqrt(-1)`) stays Top.
 */
export function resolveAsMath(args: BuiltInEvalHandlerArgs): Value {
	const node = args.node;
	if(node.type !== RType.FunctionCall || !node.named || node.arguments.length !== 1) {
		return Top;
	}
	const [arg] = node.arguments;
	const fold = MathFns[Identifier.getName(node.functionName.content) as keyof typeof MathFns];
	if(fold === undefined || arg === EmptyArgument || arg.value === undefined || (arg.name !== undefined && arg.name.content !== 'x')) {
		return Top;
	}
	const value = operand(arg.value, args);
	const num = typeof value === 'number' ? fold(value) : undefined;
	return num !== undefined && Number.isFinite(num) ? intervalFrom(num, num) : Top;
}

/** `strings` marks the operators that also fold for two strings; the ordering ones do not, as R compares them by locale collation */
export const ComparisonOps = {
	'==': { apply: (a: number | string, b: number | string) => a === b, strings: true },
	'!=': { apply: (a: number | string, b: number | string) => a !== b, strings: true },
	'<':  { apply: (a: number | string, b: number | string) => a < b, strings: false },
	'>':  { apply: (a: number | string, b: number | string) => a > b, strings: false },
	'<=': { apply: (a: number | string, b: number | string) => a <= b, strings: false },
	'>=': { apply: (a: number | string, b: number | string) => a >= b, strings: false }
} as const satisfies Record<string, { apply: (a: number | string, b: number | string) => boolean, strings: boolean }>;

/**
 * Resolves a comparison operator on two scalars of the same kind to a {@link Value} logical, with a logical counting as
 * its `0`/`1`. Operands of different kinds stay Top, as R would coerce them to a common type first.
 */
export function resolveAsComparison(args: BuiltInEvalHandlerArgs): Value {
	const bin = binary(args.node, ComparisonOps);
	if(bin === undefined) {
		return Top;
	}
	const lhs = operand(bin.lhs, args);
	const rhs = operand(bin.rhs, args);
	if(lhs === undefined || rhs === undefined || typeof lhs !== typeof rhs || (typeof lhs === 'string' && !bin.op.strings)) {
		return Top;
	}
	return logicalValue(bin.op.apply(lhs, rhs));
}

/** `decidedBy` is the lhs that fixes the result of the short-circuiting `&&`/`||` on its own; `&`/`|` vectorize, so they need both sides */
export const LogicalOps = {
	'&&': { apply: (a: boolean, b: boolean) => a && b, decidedBy: false },
	'||': { apply: (a: boolean, b: boolean) => a || b, decidedBy: true },
	'&':  { apply: (a: boolean, b: boolean) => a && b, decidedBy: undefined },
	'|':  { apply: (a: boolean, b: boolean) => a || b, decidedBy: undefined }
} as const satisfies Record<string, { apply: (a: boolean, b: boolean) => boolean, decidedBy: boolean | undefined }>;

/**
 * Resolves the unary `!` and the binary {@link LogicalOps} on scalar logicals to a {@link Value} logical.
 * `NA` and any operand that does not fold keep the result Top, unless the lhs alone already decides it.
 */
export function resolveAsLogical(args: BuiltInEvalHandlerArgs): Value {
	const node = args.node;
	if(node.type === RType.UnaryOp) {
		const value = node.operator === '!' ? asLogical(node.operand, args) : undefined;
		return value === undefined ? Top : logicalValue(!value);
	}
	const bin = binary(node, LogicalOps);
	const lhs = bin === undefined ? undefined : asLogical(bin.lhs, args);
	if(bin === undefined || lhs === undefined) {
		return Top;
	} else if(lhs === bin.op.decidedBy) {
		return logicalValue(lhs);
	}
	const rhs = asLogical(bin.rhs, args);
	return rhs === undefined ? Top : logicalValue(bin.op.apply(lhs, rhs));
}

/** Resolves `(x)` to the {@link Value} of `x`, so that a parenthesized sub-expression folds like the expression itself. */
export function resolveAsGroup(args: BuiltInEvalHandlerArgs): Value {
	const node = args.node;
	if(node.type !== RType.ExpressionList || node.children.length !== 1) {
		return Top;
	}
	/* unwrap the set again, as the caller of a handler wraps the returned value in one */
	const values = valueSetGuard(resolveIdToValue(node.children[0], args));
	return values?.elements.length === 1 ? values.elements[0] : Top;
}
