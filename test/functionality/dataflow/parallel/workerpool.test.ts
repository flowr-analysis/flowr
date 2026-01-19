import { describe, expect, test } from 'vitest';
import type { WorkerPoolSettings } from '../../../../src/dataflow/parallel/threadpool';
import { Workerpool, WorkerpoolDefaultSettings } from '../../../../src/dataflow/parallel/threadpool';
import { withLeakCheck } from '../../_helper/leak-detection';

const createPool = (overrideSettings?: Partial<WorkerPoolSettings>) => {
	return new Workerpool({
		...WorkerpoolDefaultSettings,
		nofMinWorkers: 0,
		nofMaxWorkers: 2,
		...overrideSettings,
	});
};

describe.sequential('Worker Pool Leak Tests', () => {
	test('Worker and Pool Lifecycle Data Test', async() => {
		const settings = {
			nofMaxWorkers: 1,
		};

		const pool = createPool(settings);

		await pool.submitTask('__spawnSubtasks', 2);

		await pool.closePool();

		const stats = pool.getLeakStats();

		expect(stats.workerLifeStats.size).toBeGreaterThan(0);

		console.log(stats);

		const workerStats = Array.from(stats.workerLifeStats.values())[0];
		if(!workerStats) {
			throw new Error('No stats for worker 0 found');
		}

		const internalState = workerStats.internalState;
		console.log('Internal State:', internalState);


		expect(workerStats.activeSubtasks).toBe(0);
		expect(workerStats.terminationReason).toBe('graceful');

		if(!internalState) {
			return;
		}
		expect(internalState.pendingSubtasks).toBe(0);
		expect(internalState.subtasksStarted).toBe(2);
		expect(internalState.subtasksCompleted).toBe(2);
	});

	test('normal execution leaves no leaks', async() => {
		const result = await withLeakCheck(async() => {
			const pool = createPool();

			const res = await pool.submitTask('__fastTask', 42);
			expect(res).toBe(42);

			await pool.closePool();

			const { poolStats, workerLifeStats } = pool.getLeakStats();

			expect(poolStats.workersCreated).toBe(poolStats.workersDestroyed);
			expect(poolStats.totalPortsOpened).toBe(poolStats.totalPortsClosed);

			for(const [, lc] of workerLifeStats) {
				expect(lc.activeSubtasks).toBe(0);
				expect(lc.portsOpened).toBe(lc.portClosed);
				expect(lc.internalState).toBeDefined();

				if(!lc.internalState) {
					continue;
				}
				expect(lc.internalState.pendingSubtasks).toBe(0);
				expect(lc.internalState.subtasksStarted)
					.toBe(lc.internalState.subtasksCompleted);
			}
		});

		expect(result.portLeak.ok).toBe(true);
		expect(result.handleLeak.ok).toBe(true);
		expect(result.memoryStable.ok).toBe(true);
	});

	test('destroy does not wait for worker completion (best-effort)', async() => {
		const result = await withLeakCheck(async() => {
			const pool = createPool();

			const promise = pool.submitTask('__slowTask', 1000);

			// Immediately destroy
			await pool.destroyPool();

			await expect(promise).rejects.toThrow();

			const { workerLifeStats } = pool.getLeakStats();

			for(const [, lc] of workerLifeStats) {
				expect(lc.destroyedAt).toBeDefined();
				expect(lc.internalState).toBeUndefined(); /** should be undefined, as no job was ever completed */

				if(!lc.internalState) {
					continue;
				}

				// IMPORTANT: these may differ
				expect(lc.internalState.pendingSubtasks)
					.toBeGreaterThanOrEqual(0);

				expect(
					lc.internalState.subtasksStarted >=
                    lc.internalState.subtasksCompleted
				).toBe(true);
			}
		});

		// Even forced shutdown must not leak ports
		expect(result.portLeak.ok).toBe(true);
		expect(result.handleLeak.ok).toBe(true);
	});

	test('idle timeout shutdown preserves best-effort stats', async() => {
		const result = await withLeakCheck(async() => {
			const pool = createPool({
				idleTimeout: 10,
			});

			await pool.submitTask('__fastTask', 1);
			await new Promise(r => setTimeout(r, 50));

			await pool.closePool();

			const { workerLifeStats } = pool.getLeakStats();

			console.log(workerLifeStats);

			for(const [, lc] of workerLifeStats) {
				expect(lc.terminationReason).toBe('idle-timeout');
				expect(lc.internalState).toBeDefined();
			}
		});

		expect(result.portLeak.ok).toBe(true);
	});

	test('repeated pool creation does not leak MessagePorts', async() => {
		const result = await withLeakCheck(async() => {
			for(let i = 0; i < 10; i++) {
				const pool = createPool();
				await pool.submitTask('__fastTask', i);
				await pool.closePool();
			}
		});

		expect(result.portLeak.ok).toBe(true);
		expect(result.diff.messagePorts).toBe(0);
	});

	test('subtask-heavy workload leaves no leaks', async() => {
		const result = await withLeakCheck(async() => {
			const pool = createPool();

			await pool.submitTask('__spawnSubtasks', {
				count: 100,
			});

			await pool.closePool();
		}, {
			memoryThresholdBytes: 10 * 1024 * 1024,
		});

		expect(result.portLeak.ok).toBe(true);
		expect(result.memoryStable.ok).toBe(true);
	});


});


describe.sequential('Worker Pool Heavy Load and Leak Tests', () => {
	test('massive parallel subtask execution does not leak ports or memory', async() => {
		const result = await withLeakCheck(async() => {
			const pool = createPool({ nofMaxWorkers: 4 });

			await pool.submitTask('__spawnSubtasks', 200);

			await pool.closePool();
		}, { memoryThresholdBytes: 20 * 1024 * 1024 });

		expect(result.portLeak.ok).toBe(true);
		expect(result.handleLeak.ok).toBe(true);
		expect(result.memoryStable.ok).toBe(true);
	});

	test('continuous task submission over multiple pools', async() => {
		const result = await withLeakCheck(async() => {
			for(let i = 0; i < 5; i++) {
				const pool = createPool({ nofMaxWorkers: 2 });
				await pool.submitTask('__spawnSubtasks', 50);
				await pool.closePool();
			}
		}, { memoryThresholdBytes: 15 * 1024 * 1024 });

		expect(result.portLeak.ok).toBe(true);
		expect(result.handleLeak.ok).toBe(true);
		expect(result.memoryStable.ok).toBe(true);
		expect(result.diff.messagePorts).toBe(0);
	});

	test('subtask-heavy workload leaves no leaks', async() => {
		const result = await withLeakCheck(async() => {
			const pool = createPool({ nofMaxWorkers: 3 });

			await pool.submitTask('__spawnSubtasks', 500);

			await pool.closePool();
		}, { memoryThresholdBytes: 25 * 1024 * 1024 });

		expect(result.portLeak.ok).toBe(true);
		expect(result.handleLeak.ok).toBe(true);
		expect(result.memoryStable.ok).toBe(true);
	});

	test('mix of fast and slow tasks under heavy load', async() => {
		const result = await withLeakCheck(async() => {
			const pool = createPool({ nofMaxWorkers: 3 });

			const fastTasks = Array.from({ length: 50 }, () => pool.submitTask('__fastTask', 1));
			const slowTasks = Array.from({ length: 10 }, () => pool.submitTask('__slowTask', 50));

			await Promise.all([...fastTasks, ...slowTasks]);

			await pool.closePool();
		}, { memoryThresholdBytes: 15 * 1024 * 1024 });

		expect(result.portLeak.ok).toBe(true);
		expect(result.handleLeak.ok).toBe(true);
		expect(result.memoryStable.ok).toBe(true);
	});

});