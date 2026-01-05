import os from 'os';
import type { TaskName } from './task-registry';
import type { MessagePort } from 'node:worker_threads';
import { Piscina } from 'piscina';
import { dataflowLogger } from '../logger';
import { resolve } from 'node:path';
import { cloneConfig, defaultConfigOptions, type FlowrConfigOptions } from '../../config';


export interface RegisterPortMessage {
	type:     'register-port';
	workerId: number;
	port:     MessagePort;
}

export interface TaskReceivedMessage {
    type:        'task';
    taskName:    TaskName;
    taskPayload: unknown;
}

export interface SubtaskReceivedMessage{
	type:        'subtask';
	id:          number;
	taskName:    TaskName;
	taskPayload: unknown;
}

export interface SubtaskResponseMessage {
	type:    'subtask-response';
	id:      number;
	result?: unknown;
	error?:  string;
}

export interface PortRegisteredMessage {
    type: 'port-registered';
}

export interface LogCorrelation {
	workerId:   number;
	taskName?:  string;
	taskId?:    number;
	subtaskId?: number;
}

export type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkerLogMessage {
	type:  'worker-log';
	level: WorkerLogLevel;

	timestamp: number;
	hrtime:    [number, number];

	message: string;
	data?:   unknown[];
	stack?:  string;

	correlation: LogCorrelation;
}


/**
 *
 */
export function isRegisterPortMessage(msg: unknown): msg is RegisterPortMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as RegisterPortMessage).type === 'register-port' &&
        typeof (msg as RegisterPortMessage).workerId === 'number' &&
        typeof (msg as RegisterPortMessage).port === 'object'
	);
}

/**
 *
 */
export function isSubtaskMessage(msg: unknown): msg is SubtaskReceivedMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as SubtaskReceivedMessage).type === 'subtask' &&
        typeof (msg as SubtaskReceivedMessage).id === 'number' &&
        typeof (msg as SubtaskReceivedMessage).taskName === 'string'
	);
}

/**
 *
 */
export function isSubtaskResponseMessage(msg: unknown): msg is SubtaskResponseMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as SubtaskResponseMessage).type === 'subtask-response' &&
        typeof (msg as SubtaskResponseMessage).id === 'number'
	);
}


/**
 *
 */
export function isPortRegisteredMessage(msg: unknown): msg is PortRegisteredMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as PortRegisteredMessage).type === 'port-registered'
	);
}

/**
 *
 */
export function isWorkerLogMessage(msg: unknown): msg is WorkerLogMessage {
	return (
		typeof msg === 'object' &&
		msg !== null &&
		(msg as WorkerLogMessage).type === 'worker-log'
	);
}


export interface WorkerPoolSettings{
    /** Number of workers that should be started on pool creation */
    nofMinWorkers:            number;
    /** Number of workers that can be alive simultaniously in the pool*/
    nofMaxWorkers:            number;
    /** path to the the worker file to be loaded by the pool */
    workerPath:               string;
    /** Timeout in milliseconds each worker can spend idle */
    idleTimeout:              number;
    /** Amount of tasks each worker can compute */
    concurrentTasksPerWorker: number;
    /**
     * Data that is given to each worker via the workerData
     * Important: data needs to be clonable and data is copied for each worker
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    workerData: {
    };
}

export type WorkerData = WorkerPoolSettings['workerData'] & {flowrConfig: FlowrConfigOptions};

export const WorkerpoolDefaultSettings: WorkerPoolSettings = {
	nofMinWorkers:            0,
	nofMaxWorkers:            0,
	workerPath:               './worker.js',
	idleTimeout:              30_000, // 30 seconds timeout
	concurrentTasksPerWorker: 4,
	workerData:               {},
};

/**
 * Simple wrapper for piscina used for dataflow parallelization
 */
export class Workerpool {
	private readonly pool: Piscina;
	private workerPorts = new Map<number, MessagePort>();
	private destroyed = false;

	constructor(settings: WorkerPoolSettings = WorkerpoolDefaultSettings, flowrConfig = cloneConfig(defaultConfigOptions)) {
		console.log('hey', __dirname, process.env.NODE_ENV, settings.workerPath);
		let workers = settings.nofMaxWorkers;
		if(workers <= 0){
			// use available core
			workers = Math.max(1, os.cpus().length); // may be problematic, as this returns SMT threads as cpu cores
		}
		const finalPath = process.env.NODE_ENV === 'test' ?
			resolve('dist', 'src', 'dataflow', 'parallel', 'worker.js') :
			resolve(__dirname, settings.workerPath);

		console.log(finalPath);
		// create tiny pool instance
		this.pool = new Piscina({
			minThreads:               Math.max(settings.nofMinWorkers, 0),
			maxThreads:               workers,
			filename:                 finalPath,
			concurrentTasksPerWorker: settings.concurrentTasksPerWorker,
			idleTimeout:              settings.idleTimeout, // 30 seconds idle timeout
			workerData:               {
				...settings.workerData,
				flowrConfig: flowrConfig,
			},
		});

		this.pool.on('message', (msg: unknown) => {
			if(!msg) {
				return;
			}

			if(this.tryReplayWorkerLog(msg)) {
				return;
			}

			// Worker sends initial port registration
			if(isRegisterPortMessage(msg)) {
				const { workerId, port } = msg;
				this.workerPorts.set(workerId, port);
				console.log(`Port registered for ${workerId}`);

				// Confirm Registration
				port.postMessage({ type: 'port-registered' });

				// Listen for subtasks from this worker
				port.on('message', (subMsg: unknown) => {
					if(isSubtaskMessage(subMsg)) {
						void this.handleSubtask(workerId, subMsg);
					}
				});
				return;
			}
		});
	}

	private assertAlive() {
		if(this.destroyed) {
			throw new Error('Workerpool used after destruction');
		}
	}

	private tryReplayWorkerLog(msg: unknown): boolean {
		if(!isWorkerLogMessage(msg)) {
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

		if(stack) {
			console.error(stack);
		}

		return true;
	}


	private async handleSubtask(workerId: number, msg: SubtaskReceivedMessage) {
		this.assertAlive();
		const { id, taskName, taskPayload } = msg;
		const port = this.workerPorts.get(workerId);
		console.log(`got subtask ${id} from ${workerId}`);
		if(!port) {
			dataflowLogger.error(`subtask submitted from worker ${workerId} has no corresponding message port. Aborting subtask`);
			return;
		}


		try {
			const result = await this.submitTask(taskName, taskPayload);
			console.log(`resolving subtask ${taskName} @ ${id} for ${workerId}`);
			port.postMessage({ type: 'subtask-response', id, result });
		} catch(err: unknown) {
			port.postMessage({
				type:  'subtask-response',
				id,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async submitTask<TInput, TOutput>(taskName: TaskName, taskPayload: TInput): Promise<TOutput>{
		this.assertAlive();
		const msg = { type: 'task', taskName, taskPayload } as TaskReceivedMessage;

		return this.pool.run(msg) as Promise<TOutput>;
	}

	async submitTasks<TInput, TOutput>(taskName: TaskName, taskPayload: TInput[]): Promise<TOutput[]> {
		this.assertAlive();
		// Tinypool.run returns a Promise, so we can fully parallelize:
		return await Promise.all(taskPayload.map(t => this.submitTask<TInput, TOutput>(taskName, t)));
	}

	/**
	 * Stops all worker and rejects the promises for pending tasks
	 * @returns Promise, that is fullfilled when all workers are stopped
	 */
	async destroyPool(): Promise<void> {
		if(this.destroyed) {
			return;
		}
		this.destroyed = true;

		this.closeMessagePorts();

		await this.pool.destroy();
	}

	/**
	 * Stops all workers gracefully
	 * @param abortUnqueued - aborts non-running taks if true
	 * @returns Promise, that is fullfilled when all threads are finished
	 */
	async closePool(abortUnqueued: boolean = false): Promise<void>{
		if(this.destroyed) {
			return;
		}
		this.destroyed = true;
		console.log('Closing threadpool');
		this.closeMessagePorts();

		await this.pool.close({ force: abortUnqueued });
	}

	private closeMessagePorts(): void {
		for(const port of this.workerPorts.values()){
			port.close();
		}
		this.workerPorts.clear();
	}
}