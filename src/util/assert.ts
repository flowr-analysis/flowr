/** use this to ensure that all cases are covered in case of a selection */

/* v8 ignore next */
import { flowrVersion } from './version';

export function assertUnreachable(x: never): never {
	throw new Error(`Unexpected object: ${JSON.stringify(x)}`);
}

export function isNotUndefined<T>(x: T | undefined): x is T {
	return x !== undefined;
}

export function isUndefined<T>(x: T | undefined): x is undefined {
	return x === undefined;
}

export function isNotNull<T>(x: T | null): x is T {
	return x !== null;
}

function prepareStack(stack: string | undefined): string {
	if(!stack) {
		return 'No stack trace available';
	}
	// remove the first line which is the error message
	let lines = stack.split('\n');
	lines.shift();
	lines.shift();
	// clip over 8
	if(lines.length > 8) {
		lines = [...lines.slice(0, 3),
			'...', ...lines.slice(lines.length - 5)];
	}
	return lines.map(l => l.replaceAll(/\(\/.*(src|test)/g, '(<>/$1')).join('\n');
}

function getGuardIssueUrl(message: string): string {
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

export type GuardMessage = string | (() => string)

/**
 * @param assertion - will be asserted
 * @param message - if a string, we will use it as the error message, if it is a function, we will call it to produce the error message (can be used to avoid costly message generations)
 * @throws GuardError - if the assertion fails
 */
export function guard(assertion: unknown | undefined, message: GuardMessage = 'Assertion failed'): asserts assertion {
	/* v8 ignore next 3 */
	if(!assertion) {
		throw new GuardError(typeof message === 'string' ? message : message());
	}
}
