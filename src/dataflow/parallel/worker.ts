import { parentPort, MessageChannel, workerData } from 'node:worker_threads';
import type { TaskName } from './task-registry';
import { workerTasks } from './task-registry';
import type { SubtaskReceivedMessage } from './threadpool';
import { isSubtaskResponseMessage } from './threadpool';
import { dataflowLogger } from '../logger';

type PendingEntry<T> = {
	resolve: (value: T | PromiseLike<T>) => void;
	reject:  (reason: unknown) => void;
}

const pending = new Map<
        number,
        PendingEntry<unknown>
    >();

const { port1: workerPort, port2: mainPort } = new MessageChannel();

if(!parentPort){
	dataflowLogger.error('Worker started without parentPort present, Aborting worker');
} else {
	parentPort.postMessage({
		type:     'register-port',
		workerId: typeof workerData === 'object' &&
					workerData !== null &&
					typeof (workerData as { id?: number }).id === 'number'
			? (workerData as { id: number }).id : Math.floor(Math.random() * 1e9),
		port: mainPort,
	},
	[mainPort] // transfer port to main thread
	);
}


workerPort.on('message', (msg: unknown) => {
	if(isSubtaskResponseMessage(msg)){
		const { id, result, error } = msg;
		const entry = pending.get(id);
		if(!entry) {
			return;
		}

		pending.delete(id);

		if(error !== undefined){
			entry.reject(error);
		} else {
			entry.resolve(result);
		}
	}
});



async function runSubtask<TInput, TOutput>(taskName: TaskName, taskPayload: TInput): Promise<TOutput> {
	console.log('Entering subtask emitter');
	const id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
	//return undefined as unknown as TOutput;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve: resolve as (value: unknown) => void, reject });

		// submit the subtask to main thread
		workerPort.postMessage({
			type: 'subtask',
			id,
			taskName,
			taskPayload,
		});
	});
}

export default(msg: SubtaskReceivedMessage) => {
	const { type, taskName, taskPayload } = msg;
	console.log(type);
	const taskHandler = workerTasks[taskName];
	console.log(taskHandler);
	console.log(taskName);
	if(!taskHandler){
		console.log(`Requested unknown task (${taskName})`);
		return undefined;
	}
	console.log('Hello from worker thread');
	return taskHandler(taskPayload as never, runSubtask);
};