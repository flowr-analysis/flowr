/** use this to ensure that all cases are covered in case of a selection */

/* v8 ignore next */
import { flowrVersion } from './version';

/**
 * Verifies, that the given code path is never reached.
 * @example
 * ```ts
 * type Shape = Circle | Square;
 * function area(s: Shape): number {
 *   switch(s.type) {
 *     case 'circle': return Math.PI * s.radius ** 2;
 *     case 'square': return s.sideLength ** 2;
 *     default:       return assertUnreachable(s); // ensures that all cases are covered
 *   }
 * }
 * ```
 */
export function assertUnreachable(x: never): never {
	throw new Error(`Unexpected object: ${JSON.stringify(x)}`);
}

/**
 * Verifies that the given value is not undefined.
 * This especially helps with a `.filter`
 * @example
 * ```ts
 * const values: (number | undefined)[] = [1, 2, undefined, 4];
 * const definedValues: number[] = values.filter(isNotUndefined);
 * // definedValues is now of type number[]
 * ```
 * @see {@link isUndefined}
 * @see {@link isNotNull}
 */
export function isNotUndefined<T>(this: void, x: T | undefined): x is T {
	return x !== undefined;
}

/**
 * Verifies that the given value is undefined.
 * This especially helps with a `.filter`
 * @example
 * ```ts
 * const values: (number | undefined)[] = [1, 2, undefined, 4];
 * const undefinedValues: undefined[] = values.filter(isUndefined);
 * // undefinedValues is now of type undefined[]
 * ```
 * @see {@link isNotUndefined}
 * @see {@link isNotNull}
 */
export function isUndefined<T>(this: void, x: T | undefined): x is undefined {
	return x === undefined;
}

/**
 * Verifies that the given value is not null.
 * This especially helps with a `.filter`
 * @example
 * ```ts
 * const values: (number | null)[] = [1, 2, null, 4];
 * const nonNullValues: number[] = values.filter(isNotNull);
 * // nonNullValues is now of type number[]
 * ```
 * @see {@link isUndefined}
 * @see {@link isNotUndefined}
 */
export function isNotNull<T>(this: void, x: T | null): x is T {
	return x !== null;
}

function prepareStack(this: void, stack: string | undefined): string {
	if(!stack) {
		return 'No stack trace available';
	}
	// remove the first line which is the error message
	let lines = stack.split('\n');
	lines.shift();
	lines.shift();
	lines.shift();
	// clip over 8
	if(lines.length > 8) {
		lines = [...lines.slice(0, 3),
			'...', ...lines.slice(lines.length - 5)];
	}
	return lines.map(l => l.replaceAll(/\(\/.*(src|test)/g, '(<>/$1')).join('\n');
}

/**
 * Generates a GitHub issue URL for reporting guard errors
 */
export function getGuardIssueUrl(message: string): string {
	const body = encodeURIComponent(`<!-- Please describe your issue in more detail below! -->


<!-- Automatically generated issue metadata, please do not edit or delete content below this line -->
---

flowR version: ${flowrVersion().toString()}
node version: ${process.version}
node arch: ${process.arch}
node platform: ${process.platform}
message: \`${message}\`
stack trace:\n\`\`\`\n${prepareStack(new Error().stack)}\n\`\`\`

---
	`).replaceAll('(', '%28').replaceAll(')', '%29').replaceAll('-', '%2D');
	return `https://github.com/flowr-analysis/flowr/issues/new?body=${body}`;
}

class GuardError extends Error {
	constructor(message: string) {
		super(message + '\n Report a Bug: ' + getGuardIssueUrl(message));
		this.name = 'GuardError';
	}
}

export type GuardMessage = string | (() => string);

/**
 * @param assertion   - will be asserted
 * @param message     - if a string, we will use it as the error message, if it is a function, we will call it to produce the error message (can be used to avoid costly message generations)
 * @throws GuardError - if the assertion fails
 */
export function guard(assertion: unknown | undefined, message: GuardMessage = 'Assertion failed'): asserts assertion {
	/* v8 ignore next 3 */
	if(!assertion) {
		throw new GuardError(typeof message === 'string' ? message : message());
	}
}
