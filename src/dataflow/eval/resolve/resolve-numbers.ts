import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { Identifier } from '../../environments/identifier';
import { isRNumberValue, unliftRValue } from '../../../util/r-value';
import type { BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { Top, type Value } from '../values/r-value';
import { intervalFrom } from '../values/intervals/interval-constants';
import { vectorFrom } from '../values/vectors/vector-constants';
import { matchCallArguments } from './match-arguments';
import { Resolve } from '../../environments/resolve-helper';

/** R breaks a tie to the even neighbor, unlike `Math.round`, which always goes up */
function roundHalfEven(x: number, digits = 0): number {
	const scale = 10 ** digits;
	const scaled = x * scale;
	const below = Math.floor(scaled);
	const rounded = scaled - below !== 0.5 ? Math.round(scaled) : below % 2 === 0 ? below : below + 1;
	return rounded / scale;
}

/** R rounds `%%` and `%/%` towards `-Inf`, unlike the JS `%` */
function mod(a: number, b: number): number {
	return a - Math.floor(a / b) * b;
}

/**
 * One entry of the {@link NumericFns} registry: the parameters R declares, in order, and how to fold them.
 *
 * A call supplies its arguments positionally or under these names, and `fold` receives them in declaration
 * order, so a parameter R gives a default is simply an optional parameter of `fold`. Whatever `fold` cannot
 * answer (a missing operand it needs, a domain error) it returns `undefined` for, which keeps the call `Top`.
 */
export interface NumericFn {
	/** the parameter names, in the order R declares them; an argument matching none of them stops the fold */
	readonly params: readonly string[];
	/** the fold over the supplied operands, in declaration order */
	readonly fold:   (...args: number[]) => number | undefined;
}

/**
 * Every numeric built-in the value solver folds, operators included: `-` is an entry like `sqrt` is, and both
 * are reached through {@link resolveAsNumeric}. Teaching flowR one more is a line here plus the matching
 * `evalHandler` in the built-in configuration -- a test checks that the two agree.
 *
 * An operator gets its operands under the names R gives them (`e1`, `e2`), and the ones that also exist as a
 * unary form declare `e2` as optional. Anything the fold hands back that is not a finite number stays `Top`,
 * so `sqrt(-1)` or `1/0` need no special case here.
 */
export const NumericFns = {
	/* the arithmetic operators; `+` and `-` fold their unary form as well, which is why `e2` may be missing */
	'+':        { params: ['e1', 'e2'], fold: (a: number, b?: number) => b === undefined ? a : a + b },
	'-':        { params: ['e1', 'e2'], fold: (a: number, b?: number) => b === undefined ? -a : a - b },
	'*':        { params: ['e1', 'e2'], fold: (a: number, b: number) => a * b },
	'/':        { params: ['e1', 'e2'], fold: (a: number, b: number) => a / b },
	'^':        { params: ['e1', 'e2'], fold: (a: number, b: number) => a ** b },
	'**':       { params: ['e1', 'e2'], fold: (a: number, b: number) => a ** b },
	'%%':       { params: ['e1', 'e2'], fold: mod },
	'%/%':      { params: ['e1', 'e2'], fold: (a: number, b: number) => Math.floor(a / b) },
	/* rounding, each under the parameter names R documents */
	abs:        { params: ['x'], fold: Math.abs },
	sqrt:       { params: ['x'], fold: Math.sqrt },
	floor:      { params: ['x'], fold: Math.floor },
	ceiling:    { params: ['x'], fold: Math.ceil },
	trunc:      { params: ['x'], fold: Math.trunc },
	sign:       { params: ['x'], fold: Math.sign },
	round:      { params: ['x', 'digits'], fold: roundHalfEven },
	signif:     { params: ['x', 'digits'], fold: (x: number, digits = 6) => digits >= 1 && digits <= 21 ? Number(x.toPrecision(digits)) : undefined },
	/* exponentials and logarithms; `log` takes its base as a second argument, the rest are fixed */
	exp:        { params: ['x'], fold: Math.exp },
	expm1:      { params: ['x'], fold: Math.expm1 },
	log:        { params: ['x', 'base'], fold: (x: number, base?: number) => base === undefined ? Math.log(x) : Math.log(x) / Math.log(base) },
	log2:       { params: ['x'], fold: Math.log2 },
	log10:      { params: ['x'], fold: Math.log10 },
	log1p:      { params: ['x'], fold: Math.log1p },
	/* trigonometry and its hyperbolic counterparts */
	sin:        { params: ['x'], fold: Math.sin },
	cos:        { params: ['x'], fold: Math.cos },
	tan:        { params: ['x'], fold: Math.tan },
	asin:       { params: ['x'], fold: Math.asin },
	acos:       { params: ['x'], fold: Math.acos },
	atan:       { params: ['x'], fold: Math.atan },
	atan2:      { params: ['y', 'x'], fold: Math.atan2 },
	sinh:       { params: ['x'], fold: Math.sinh },
	cosh:       { params: ['x'], fold: Math.cosh },
	tanh:       { params: ['x'], fold: Math.tanh },
	asinh:      { params: ['x'], fold: Math.asinh },
	acosh:      { params: ['x'], fold: Math.acosh },
	atanh:      { params: ['x'], fold: Math.atanh },
	/* bit twiddling, which R defines on 32-bit integers just as JS does */
	bitwAnd:    { params: ['a', 'b'], fold: (a: number, b: number) => a & b },
	bitwOr:     { params: ['a', 'b'], fold: (a: number, b: number) => a | b },
	bitwXor:    { params: ['a', 'b'], fold: (a: number, b: number) => a ^ b },
	bitwNot:    { params: ['a'], fold: (a: number) => ~a },
	bitwShiftL: { params: ['a', 'n'], fold: (a: number, n: number) => a << n },
	bitwShiftR: { params: ['a', 'n'], fold: (a: number, n: number) => a >>> n }
} as const satisfies Record<string, NumericFn>;

/** an operand as the folds take it: one number, or a vector of them to map over */
type Operand = number | readonly number[];

/** the number an operand folds to, with a logical counting as its `0`/`1` just like R would coerce it */
function numeric(node: RNodeWithParent, args: BuiltInEvalHandlerArgs): Operand | undefined {
	const value = unliftRValue(Resolve.toValue(node, args));
	if(typeof value === 'boolean') {
		return Number(value);
	} else if(isRNumberValue(value)) {
		return value.complexNumber ? undefined : value.num;
	}
	/* a vector folds elementwise, so it only counts when every element is a plain number */
	if(!Array.isArray(value) || value.length === 0) {
		return undefined;
	}
	const nums = value.map(e => isRNumberValue(e) && !e.complexNumber ? e.num : undefined);
	return nums.every(n => n !== undefined) ? nums : undefined;
}

/** the name a node calls, whether it is written as an operator or as a plain call of the quoted operator */
function calledName(node: RNodeWithParent): string | undefined {
	switch(node.type) {
		case RType.UnaryOp:
		case RType.BinaryOp:
			return node.operator;
		case RType.FunctionCall:
			return node.named ? Identifier.getName(node.functionName.content) : undefined;
		default:
			return undefined;
	}
}

/** apply `fold` to the operands, mapping over the one vector among them (R recycles, we only fold equal lengths) */
function apply(fold: NumericFn['fold'], operands: readonly Operand[]): number | readonly number[] | undefined {
	const lengths = operands.filter(o => Array.isArray(o)).map(o => (o as readonly number[]).length);
	if(lengths.length === 0) {
		return fold(...operands as number[]);
	} else if(lengths.some(l => l !== lengths[0])) {
		return undefined;   // R would recycle the shorter one, which is too easy to get wrong to guess at
	}
	const out: number[] = [];
	for(let i = 0; i < lengths[0]; i++) {
		const value = fold(...operands.map(o => Array.isArray(o) ? o[i] as number : o as number));
		if(value === undefined || !Number.isFinite(value)) {
			return undefined;
		}
		out.push(value);
	}
	return out;
}

/**
 * Resolves any call of a {@link NumericFns} entry to a {@link Value}: the operators in prefix or infix form,
 * the unary `+`/`-`, and the named functions with their arguments in any order R accepts. An operand may be a
 * number, a logical (counting as its `0`/`1`), or a vector of numbers, which folds elementwise. Anything that
 * does not resolve, a result that is not finite, and a vector length mismatch all stay `Top`.
 */
export function resolveAsNumeric(args: BuiltInEvalHandlerArgs): Value {
	const name = calledName(args.node);
	const fn = name === undefined ? undefined : NumericFns[name as keyof typeof NumericFns] as NumericFn | undefined;
	if(fn === undefined) {
		return Top;
	}
	const nodes = matchCallArguments(args.node, fn.params) as (RNodeWithParent | undefined)[] | undefined;
	if(nodes === undefined || nodes[0] === undefined) {
		return Top;
	}
	const operands: Operand[] = [];
	for(const node of nodes) {
		if(node === undefined) {
			break;   // the parameters R gives a default are the trailing ones, so the fold sees a shorter prefix
		}
		const value = numeric(node, args);
		if(value === undefined) {
			return Top;
		}
		operands.push(value);
	}
	const folded = apply(fn.fold, operands);
	if(typeof folded === 'number') {
		return Number.isFinite(folded) ? intervalFrom(folded, folded) : Top;
	}
	/* a number is an exact interval everywhere else in the solver, so the elements are lifted the same way */
	return folded === undefined ? Top : vectorFrom(folded.map(n => intervalFrom(n, n)));
}
