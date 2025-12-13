import os from 'os';
import type { TaskName } from './task-registry';
import type { MessagePort } from 'node:worker_threads';
import { Piscina } from 'piscina';
import { dataflowLogger } from '../logger';
import { resolve } from 'node:path';


export interface RegisterPortMessage {
	type:     'register-port';
	workerId: number;
	port:     MessagePort;
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
 * Simple warpper for piscina used for dataflow parallelization
 */
export class Threadpool {
	private readonly pool: Piscina;
	private workerPorts = new Map<number, MessagePort>();

	constructor(numThreads = 0, workerPath = '/worker.ts') {
		if(numThreads <= 0){
			// use avalaible core
			numThreads = Math.max(1, os.cpus().length); // may be problematic, as this returns SMT threads as cores
		}

		console.log(`worker filename: ${resolve(__dirname, './worker.ts')}`);

		// create tiny pool instance
		this.pool = new Piscina({
			//minThreads:               2,
			maxThreads:               numThreads,
			filename:                 resolve(__dirname, workerPath),
			concurrentTasksPerWorker: 5,
			idleTimeout:              30 * 1000, // 30 seconds idle timeout
			workerData:               {
				fullPath: resolve(__dirname, './worker.ts')
			},
		});

		this.pool.on('message', (msg: unknown) => {
			if(!msg) {
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

	private async handleSubtask(workerId: number, msg: SubtaskReceivedMessage) {
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
		console.log(`Threadpool called with task: ${taskName}`);
		console.log('Payload keys:', Object.keys(taskPayload as object));
		console.log('Contains function?', Object.values(taskPayload as object).some(v => typeof v === 'function'));

		return this.pool.run({ type: 'task', taskName, taskPayload }) as Promise<TOutput>;
	}

	async submitTasks<TInput, TOutput>(taskName: TaskName, taskPayload: TInput[]): Promise<TOutput[]> {
		// Tinypool.run returns a Promise, so we can fully parallelize:
		return await Promise.all(taskPayload.map(t => this.submitTask<TInput, TOutput>(taskName, t)));
	}

	/**
	 *
	 */
	destroyPool(): void {
		this.closeMessagePorts();
		void this.pool.destroy();
	}

	/**
	 *
	 */
	closePool(): void{
		this.closeMessagePorts();
		void this.pool.close();
	}

	private closeMessagePorts(): void {
		for(const port of this.workerPorts.values()){
			port.close();
		}
	}
}