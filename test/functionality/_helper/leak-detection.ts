import { MessagePort } from 'node:worker_threads';

/** Internal Node handle type */
export type NodeHandle = unknown;

/** Get active handles in the process (internal Node.js API) */
export function getActiveHandles(): NodeHandle[] {
	const maybeFn = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles;
	if(typeof maybeFn === 'function') {
		return maybeFn();
	}
	return [];
}

/** Filter only MessagePorts */
export function getActiveMessagePorts(): MessagePort[] {
	return getActiveHandles().filter((h): h is MessagePort => h instanceof MessagePort);
}

/** Count active MessagePorts */
export function countActiveMessagePorts(): number {
	return getActiveMessagePorts().length;
}

/** Snapshot of process handles, message ports, and memory usage */
export interface LeakSnapshot {
    handles:      number;
    messagePorts: number;
    memoryUsage:  NodeJS.MemoryUsage;
}

/** Take a snapshot for leak detection */
export function takeLeakSnapshot(): LeakSnapshot {
	return {
		handles:      getActiveHandles().length,
		messagePorts: countActiveMessagePorts(),
		memoryUsage:  process.memoryUsage(),
	};
}

/** Diff two snapshots */
export function diffLeakSnapshots(before: LeakSnapshot, after: LeakSnapshot): LeakSnapshot {
	return {
		handles:      after.handles - before.handles,
		messagePorts: after.messagePorts - before.messagePorts,
		memoryUsage:  {
			rss:          after.memoryUsage.rss - before.memoryUsage.rss,
			heapTotal:    after.memoryUsage.heapTotal - before.memoryUsage.heapTotal,
			heapUsed:     after.memoryUsage.heapUsed - before.memoryUsage.heapUsed,
			external:     after.memoryUsage.external - before.memoryUsage.external,
			arrayBuffers: after.memoryUsage.arrayBuffers - before.memoryUsage.arrayBuffers,
		},
	};
}


export interface LeakCheckResult {
    ok:      boolean;
    reason?: string;
}

/** Assert no MessagePort leaks */
export function assertNoPortLeaks(before: LeakSnapshot, after: LeakSnapshot): LeakCheckResult {
	const diff = diffLeakSnapshots(before, after);
	if(diff.messagePorts > 0) {
		return { ok: false, reason: `Detected leaked MessagePorts (${diff.messagePorts})` };
	}
	return { ok: true };
}

/** Assert no handle leaks */
export function assertNoHandleLeaks(before: LeakSnapshot, after: LeakSnapshot): LeakCheckResult {
	const diff = diffLeakSnapshots(before, after);
	if(diff.handles > 0) {
		return { ok: false, reason: `Detected leaked Handles (${diff.handles})` };
	}
	return { ok: true };
}

/** Assert no memory leaks */
export function assertNoMemoryLeaks(
	before: LeakSnapshot,
	after: LeakSnapshot,
	thresholdBytes: number = 5 * 1024 * 1024
): LeakCheckResult {
	const diff = diffLeakSnapshots(before, after);
	if(diff.memoryUsage.heapUsed > thresholdBytes) {
		return { ok: false, reason: `Heap Used increased by ${diff.memoryUsage.heapUsed} bytes` };
	}
	return { ok: true };
}

/** Trigger GC if available */
export async function forceGarbageCollection(): Promise<void> {
	if(typeof global.gc === 'function') {
		global.gc();
		await new Promise<void>(r => setImmediate(r));
	}
}

/** Dump WTFNode handles (if installed) */
export async function dumpWTF(reason?: string) {
	try {
		const wtfnode = await import('wtfnode'); // dynamic import, avoids forbidden require()
		if(reason) {
			console.warn(`[WTF NODE] ${reason}`);
		}
		wtfnode.dump({ fullStacks: true });
	} catch{
		// silently ignore if not installed
	}
}

/** Run function and measure leaks before/after */
export async function withLeakCheck(
	fn: () => Promise<void>,
	opts?: { memoryThresholdBytes?: number }
) {
	await forceGarbageCollection();
	const before = takeLeakSnapshot();

	await fn();

	await forceGarbageCollection();
	const after = takeLeakSnapshot();

	return {
		before,
		after,
		diff:         diffLeakSnapshots(before, after),
		portLeak:     assertNoPortLeaks(before, after),
		handleLeak:   assertNoHandleLeaks(before, after),
		memoryStable: assertNoMemoryLeaks(before, after, opts?.memoryThresholdBytes),
	};
}
