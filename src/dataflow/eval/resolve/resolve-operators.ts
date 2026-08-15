import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { Identifier } from '../../environments/identifier';
import { isRNumberValue, unliftRValue } from '../../../util/r-value';
import type { BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { ValueLogicalFalse, ValueLogicalTrue } from '../values/logical/logical-constants';
import { Top, type Value } from '../values/r-value';
import { valueSetGuard } from '../values/general';
import { Resolve } from '../../environments/resolve-helper';
import { NodeValue } from './node-value';

/** the scalar an operand folds to, with a logical counting as its `0`/`1` just like R would coerce it */
function operand(node: RNodeWithParent, args: BuiltInEvalHandlerArgs): number | string | undefined {
	const value = unliftRValue(Resolve.toValue(node, args));
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
	return NodeValue.sole(valueSetGuard(Resolve.toValue(node.children[0], args))) ?? Top;
}
