import os from 'os';
import type { TaskName } from './task-registry';
import type { MessagePort } from 'node:worker_threads';
import { Piscina } from 'piscina';
import { dataflowLogger } from '../logger';
import { resolve } from 'node:path';
import { cloneConfig, defaultConfigOptions, type FlowrConfigOptions } from '../../config';
import type { workerStats, WorkerInternalState } from './worker';
import { isRegisterPortMessage, isSubtaskMessage, isWorkerLogMessage, SubtaskReceivedMessage, TaskReceivedMessage } from './pool-messages';


type WorkerTerminationReason = 'graceful' | 'idle-timeout' | 'error' | 'forced-shutdown' | 'unknown';

interface WorkerLifecycle {
    createdAt: number;
    destroyedAt?: number;
    portsOpened: number;
    portClosed: number;
    activeSubtasks: number;
    internalState?: WorkerInternalState;
    terminationReason?: WorkerTerminationReason;
}


export interface WorkerPoolSettings {
    /** Number of workers that should be started on pool creation */
    nofMinWorkers: number;
    /** Number of workers that can be alive simultaniously in the pool*/
    nofMaxWorkers: number;
    /** path to the the worker file to be loaded by the pool */
    workerPath: string;
    /** Timeout in milliseconds each worker can spend idle */
    idleTimeout: number;
    /** Amount of tasks each worker can compute */
    concurrentTasksPerWorker: number;
    /** Timeout for waiting on worker stats gathering */
    workerStatsTimeout: number;
    /**
     * Data that is given to each worker via the workerData
     * Important: data needs to be clonable and data is copied for each worker
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    workerData: {
    };
}

export type WorkerData = WorkerPoolSettings['workerData'] & { flowrConfig: FlowrConfigOptions };

export const WorkerpoolDefaultSettings: WorkerPoolSettings = {
    nofMinWorkers: 0,
    nofMaxWorkers: 2,
    workerPath: './worker.js',
    idleTimeout: 30_000, // 30 seconds timeout
    concurrentTasksPerWorker: 2,
    workerStatsTimeout: 5000, // 5 seconds
    workerData: {},
};

export interface WorkerPoolStats {
    workersCreated: number;
    workersDestroyed: number;
    workersDestroyedWithError: number;
    workersDestroyedWithTimeout: number;
    tasksExecuted: number;
    tasksFailed: number;
    subtasksStarted: number;
    subtasksCompleted: number;
    totalPortsOpened: number;
    totalPortsClosed: number;
}

export interface PoolLeakStats {
    poolStats: WorkerPoolStats;
    workerLifeStats: Map<number, WorkerLifecycle>;
}

export interface TaskResultWithStats<T = unknown> {
    result: T;
    workerId: number;
    stats: WorkerInternalState;
}

/**
 * Simple wrapper for piscina used for dataflow parallelization
 */
export class Workerpool {
    private readonly pool: Piscina;
    private workerPorts = new Map<number, MessagePort>();
    private destroyed = false;

    private readonly workerStats: WorkerPoolStats = {
        workersCreated: 0,
        workersDestroyed: 0,
        workersDestroyedWithError: 0,
        workersDestroyedWithTimeout: 0,
        tasksExecuted: 0,
        tasksFailed: 0,
        subtasksStarted: 0,
        subtasksCompleted: 0,
        totalPortsOpened: 0,
        totalPortsClosed: 0,
    };
    private readonly workerLifeStats = new Map<number, WorkerLifecycle>();
    private readonly portCleanup = new Map<number, () => void>();

    private shutdownTimeout: number; // ms

    constructor(settings: WorkerPoolSettings = WorkerpoolDefaultSettings, flowrConfig = cloneConfig(defaultConfigOptions)) {
        console.log('workerPool: ', __dirname, process.env.NODE_ENV, settings.workerPath);
        let workers = settings.nofMaxWorkers;
        if (workers <= 0) {
            // use available core
            workers = Math.max(1, os.cpus().length); // may be problematic, as this returns SMT threads as cpu cores
        }
        const finalPath = process.env.NODE_ENV === 'test' ?
            resolve('dist', 'src', 'dataflow', 'parallel', 'worker.js') :
            resolve(__dirname, settings.workerPath);

        console.log(finalPath);
        this.shutdownTimeout = settings.workerStatsTimeout;
        // create tiny pool instance
        this.pool = new Piscina({
            minThreads: Math.max(settings.nofMinWorkers, 0),
            maxThreads: workers,
            filename: finalPath,
            concurrentTasksPerWorker: settings.concurrentTasksPerWorker,
            idleTimeout: settings.idleTimeout, // 30 seconds idle timeout
            workerData: {
                ...settings.workerData,
                flowrConfig: flowrConfig,
            },
        });

        this.pool.on('message', (msg: unknown) => {
            if (this.destroyed) {
                console.warn('Received message after destruction of workerPool.');
                return;
            }
            if (!msg) {
                return;
            }

            if (this.tryReplayWorkerLog(msg)) {
                return;
            }

            // Worker sends initial port registration
            if (isRegisterPortMessage(msg)) {
                const { workerId, port } = msg;

                this.workerStats.totalPortsOpened++;
                const lsStats = this.ensureWorkerLifeCycle(workerId);
                if (lsStats) {
                    lsStats.portsOpened++;
                }

                if (this.destroyed) {
                    try {
                        port.close();
                    } catch (err: unknown) {
                        console.warn('Could not close port: ', err);
                    }
                    return;
                }
                if (this.workerPorts.has(workerId)) {
                    this.cleanupWorker(workerId, 're-use of worker');
                }

                const onSubtaskMessage = (subMsg: unknown) => {
                    if (isSubtaskMessage(subMsg)) {
                        void this.handleSubtask(workerId, subMsg);
                    }
                };

                // Listen for subtasks from this worker
                port.on('message', onSubtaskMessage);

                this.portCleanup.set(workerId, () => {
                    port.off('message', onSubtaskMessage);
                });

                this.workerPorts.set(workerId, port);
                console.log(`Port registered for ${workerId}`);

                // Confirm Registration
                port.postMessage({ type: 'port-registered' });
                return;
            }
        });

        this.pool.on('workerCreate', (worker: { id: number }) => {
            console.log(`Worker ${worker.id} created`);
            this.workerStats.workersCreated++;
            this.ensureWorkerLifeCycle(worker.id); // create lifecycle if necessary
        });

        this.pool.on('workerDestroy', (worker: { id: number }) => {
            this.workerStats.workersDestroyed++;
            const lcStats = this.ensureWorkerLifeCycle(worker.id);

            lcStats.destroyedAt = Date.now();
            lcStats.terminationReason = this.destroyed ? 'graceful' : 'idle-timeout';

            this.cleanupWorker(worker.id, 'worker destroyed');
        });

        this.pool.on('error', (err) => {
            this.workerStats.workersDestroyedWithError++;
            console.error('Workerpool worker encountered error:', err);
        });
    }

    private assertAlive() {
        if (this.destroyed) {
            throw new Error('Workerpool used after destruction');
        }
    }

    private tryReplayWorkerLog(msg: unknown): boolean {
        if (!isWorkerLogMessage(msg)) {
            return false;
        }

        const {
            level,
            message,
            data,
            timestamp,
            correlation,
            stack,
        } = msg;

        const time = new Date(timestamp).toISOString();

        const prefix =
            `[${time}]` +
            `[worker:${correlation.workerId}]` +
            (correlation.taskId ? `[task:${correlation.taskId}]` : '') +
            (correlation.subtaskId ? `[subtask:${correlation.subtaskId}]` : '') +
            (correlation.taskName ? `[${correlation.taskName}]` : '');

        console[level](prefix, message, ...(data ?? []));

        if (stack) {
            console.error(stack);
        }

        return true;
    }


    private async handleSubtask(workerId: number, msg: SubtaskReceivedMessage) {
        this.assertAlive();

        this.workerStats.subtasksStarted++;
        const lcStats = this.workerLifeStats.get(workerId);
        if (lcStats) {
            lcStats.activeSubtasks++;
        }

        const { id, taskName, taskPayload } = msg;
        const port = this.workerPorts.get(workerId);
        console.log(`got subtask ${id} from ${workerId}`);
        if (!port) {
            dataflowLogger.error(`subtask submitted from worker ${workerId} has no corresponding message port. Aborting subtask`);
            return;
        }


        try {
            const result = await this.submitTask(taskName, taskPayload);
            console.log(`resolving subtask ${taskName} @ ${id} for ${workerId}`);
            port.postMessage({ type: 'subtask-response', id, result });
        } catch (err: unknown) {
            port.postMessage({
                type: 'subtask-response',
                id,
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            this.workerStats.subtasksCompleted++;
            if (lcStats) {
                lcStats.activeSubtasks--;
            }
        }
    }

    async submitTask<TInput, TOutput>(taskName: TaskName, taskPayload: TInput): Promise<TOutput> {
        this.assertAlive();
        this.workerStats.tasksExecuted++;
        try {
            /** build task payload message */
            const msg = { type: 'task', taskName, taskPayload } as TaskReceivedMessage;
            /** submit and wait for result */
            const result = await (this.pool.run(msg) as Promise<TaskResultWithStats<TOutput>>);

            /** get lifecycle stats for worker */
            const lc = this.ensureWorkerLifeCycle(result.workerId);
            /** update stats */
            lc.internalState = result.stats;
            /** return actual task result */
            return result.result;
        } catch (err: unknown) {
            this.workerStats.tasksFailed++;
            throw err;
        }
    }

    async submitTasks<TInput, TOutput>(taskName: TaskName, taskPayload: TInput[]): Promise<TOutput[]> {
        this.assertAlive();
        // Tinypool.run returns a Promise, so we can fully parallelize:
        return await Promise.all(taskPayload.map(t => this.submitTask<TInput, TOutput>(taskName, t)));
    }

    getLeakStats(): PoolLeakStats {
        return {
            poolStats: this.workerStats,
            workerLifeStats: this.workerLifeStats,
        };
    }

    private initClosing() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;

        for (const lc of this.workerLifeStats.values()) {
            if (!lc.terminationReason && !lc.destroyedAt) {
                lc.terminationReason = 'graceful'; /** normal shutdown, initiated by the user */
            }
        }
        //this.closeMessagePorts();
    }

    /**
     * Stops all worker and rejects the promises for pending tasks
     * @returns Promise, that is fullfilled when all workers are stopped
     */
    async destroyPool(): Promise<void> {
        if (this.destroyed) {
            return;
        }
        this.initClosing();

        await this.pool.destroy();
        this.assertNoLeaks();
    }

    /**
     * Stops all workers gracefully
     * @param abortUnqueued - aborts non-running taks if true
     * @returns Promise, that is fullfilled when all threads are finished
     */
    async closePool(abortUnqueued: boolean = false): Promise<void> {
        if (this.destroyed) {
            return;
        }
        this.initClosing();

        await this.pool.close({ force: abortUnqueued });
        this.assertNoLeaks();
    }

    private closeMessagePorts(): void {
        for (const [workerId] of this.workerPorts.entries()) {
            this.cleanupWorker(workerId, 'pool is closing');
        }
        if (this.workerPorts.size > 0) {
            throw new Error('Failed to cleanup all worker ports');
        }
    }

    private assertNoLeaks() {
        for (const [workerId, lcStats] of this.workerLifeStats.entries()) {
            if (!lcStats.internalState) {
                console.warn(`Worker ${workerId} never transmitted internal state (${lcStats.terminationReason}).`);
            }
            if (lcStats.portsOpened !== lcStats.portClosed) {
                console.warn(`Worker ${workerId} has leaked ports: opened ${lcStats.portsOpened}, closed ${lcStats.portClosed}`);
            }
            if (lcStats.activeSubtasks !== 0) {
                console.warn(`Worker ${workerId} has leaked subtasks: active ${lcStats.activeSubtasks}`);
            }
            if (!lcStats.destroyedAt) {
                console.warn(`Worker ${workerId} was not destroyed properly.`);
            }
        }
        if (this.workerPorts.size > 0) {
            console.warn('There are still worker ports open in the pool:');
            for (const workerId of this.workerPorts.keys()) {
                console.warn(`Worker ${workerId} still has an open message port.`);
            }
        }
    }

    /**
     * Best effort to ensure lifecycle stats exist for a worker
     * @param workerId - thread id of worker
     * @returns LifeCycle stats of the worker
     */
    private ensureWorkerLifeCycle(workerId: number): WorkerLifecycle {
        let lc = this.workerLifeStats.get(workerId);
        if (!lc) {
            lc = {
                createdAt: Date.now(),
                portsOpened: 0,
                portClosed: 0,
                activeSubtasks: 0,
            };
            this.workerLifeStats.set(workerId, lc);
        }
        return lc;
    }

    private cleanupWorker(workerId: number, reason?: unknown) {


        this.portCleanup.get(workerId)?.();
        this.portCleanup.delete(workerId);

        const port = this.workerPorts.get(workerId);
        if (!port) {
            return;
        } // already cleaned up

        try {
            port.close();
        } catch (err: unknown) {
            console.warn(`Failed to close port for worker ${workerId}:`, err);
        }
        this.workerPorts.delete(workerId);
        console.log(`Cleaned up port for worker ${workerId}`);

        this.workerStats.totalPortsClosed++;
        const lcStats = this.workerLifeStats.get(workerId);
        if (lcStats) {
            lcStats.portClosed++;
        }

        console.warn(
            `Closing port for worker ${workerId}`,
            {
                destroyedAt: lcStats?.destroyedAt,
            }
        );
        console.warn(
            `Worker ${workerId} cleaned up\n reason: `,
            reason instanceof Error ? reason.message : reason
        );
    }
}