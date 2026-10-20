/**
 * flowR's secure mode, for analyzing untrusted code (e.g., on a server that accepts arbitrary projects).
 *
 * Once enabled, it stays enabled for the lifetime of the process: there is deliberately no way to disable it.
 * Instead of trying to find every path that may lead to a dangerous operation, the operations themselves
 * (starting R or any other process, accessing the network, using the clipboard) check {@link SecureMode.guard}, so
 * code added later is covered as well. Configuration is restricted on top (see {@link FlowrConfig.fromFile}).
 *
 * Enable it with `--secure` on the command line, the environment variable {@link SecureMode.EnvVar}, or {@link SecureMode.enable}.
 */

/** Environment variable that enables {@link SecureMode} when flowR is loaded. */
const EnvVar = 'FLOWR_SECURE_MODE';

/** What the secure mode forbids, named in the error it throws. */
export type SecureModeOperation = 'starting R' | 'starting a process' | 'network access' | 'clipboard access';

/** Thrown by {@link SecureMode.guard} if a forbidden operation is attempted in secure mode. */
export class SecureModeError extends Error {
	constructor(public readonly operation: SecureModeOperation, detail?: string) {
		super(`flowR runs in secure mode, which forbids ${operation}${detail ? ` (${detail})` : ''}`);
		this.name = 'SecureModeError';
	}
}

/** Whether `value` (of an environment variable) switches something on. */
export function isTruthyEnvValue(value: string | undefined): boolean {
	const v = value?.trim().toLowerCase();
	return v !== undefined && v !== '' && v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

let enabled = typeof process !== 'undefined' && isTruthyEnvValue(process.env?.[EnvVar]);

/**
 * The process-wide secure mode, see the module documentation.
 * @helper security
 */
export const SecureMode = {
	EnvVar,
	/** Enables the secure mode for the rest of the process's lifetime (there is no way back). */
	enable(this: void): void {
		enabled = true;
		if(typeof process !== 'undefined' && process.env) {
			// inherited by every child process flowR may (legitimately) start before, e.g., a worker
			process.env[EnvVar] = '1';
		}
	},
	/**
	 * In secure mode, decompressing a file of the analyzed project must not yield more than this many bytes,
	 * so a decompression bomb cannot exhaust the memory. Use {@link SecureMode.decompressionLimit}.
	 */
	MaxDecompressedBytes: 512 * 1024 * 1024,
	/** The maximum number of bytes decompressing a project file may yield, `undefined` (no limit) outside the secure mode. */
	decompressionLimit(this: void): number | undefined {
		return enabled ? SecureMode.MaxDecompressedBytes : undefined;
	},
	/** Whether the secure mode is enabled. */
	isEnabled(this: void): boolean {
		return enabled;
	},
	/**
	 * Call this right before performing the given operation.
	 * @throws a {@link SecureModeError} if the secure mode is enabled
	 */
	guard(this: void, operation: SecureModeOperation, detail?: string): void {
		if(enabled) {
			throw new SecureModeError(operation, detail);
		}
	}
} as const;
