/**
 * Exits after draining stdout/stderr. When Node.js writes to a pipe it does so
 * asynchronously; calling process.exit() directly can truncate pending output.
 * Falls back to a forced exit after 1 min in case a drain callback never fires.
 */
export function exitSafe(code = 0): void {
	let pending = 2;
	const done = () => {
		if(--pending === 0) {
			process.exit(code);
		}
	};
	process.stdout.write('', done);
	process.stderr.write('', done);
	setTimeout(() => process.exit(code), 60_000).unref();
}
