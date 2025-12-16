import { parentPort, MessageChannel, threadId, workerData } from 'node:worker_threads';
import type { TaskName } from './task-registry';
import { SetParserEngine, workerTasks } from './task-registry';
import type { SubtaskReceivedMessage, WorkerData } from './threadpool';
import { isPortRegisteredMessage, isSubtaskResponseMessage } from './threadpool';
import { dataflowLogger } from '../logger';
import { retrieveEngineInstances } from '../../engines';
import { cloneConfig, defaultConfigOptions } from '../../config';

const typedWorkerData = workerData as WorkerData;

type PendingEntry<T> = {
	resolve: (value: T | PromiseLike<T>) => void;
	reject:  (reason: unknown) => void;
}

const pending = new Map<
        number,
        PendingEntry<unknown>
    >();


const { port1: workerPort, port2: mainPort } = new MessageChannel();

let portRegisteredResolve: () => void;
const portRegistered = new Promise<void>(res => (portRegisteredResolve = res));

if(!parentPort){
	/** This 'should' never happen, as this port is provided natively by piscina */
	dataflowLogger.error('Worker started without parentPort present, Aborting worker');
	process.exit(1);
}

console.log(`Worker ${threadId} registering port to main thread.`);
console.log(threadId);
parentPort.postMessage({
	type:     'register-port',
	workerId: threadId,
	port:     mainPort,
},
[mainPort] // transfer port to main thread
);
// Listen for confirmation from main thread
workerPort.on('message', (msg: unknown) => {
	if(isPortRegisteredMessage(msg)) {
		portRegisteredResolve();
	}
});


workerPort.on('message', (msg: unknown) => {
	if(isSubtaskResponseMessage(msg)){
		const { id, result, error } = msg;
		console.log(`got response for ${id}`);
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
		console.log(`submitting subtask with ${id} from ${threadId}`);
		// submit the subtask to main thread
		workerPort.postMessage({
			type: 'subtask',
			id,
			taskName,
			taskPayload,
		});
	});
}

async function initialize(){
	await portRegistered;

	const config = typedWorkerData.flowrConfig ?? cloneConfig(defaultConfigOptions);
	const engines = await retrieveEngineInstances(config, true);
	SetParserEngine(engines.engines[engines.default]);

	return (msg: SubtaskReceivedMessage) => {
		const { taskName, taskPayload } = msg;
		const taskHandler = workerTasks[taskName];
		if(!taskHandler){
			dataflowLogger.error(`Requested unknown task (${taskName})`);
			return undefined;
		}
		console.log('Hello from worker thread');
		return taskHandler(taskPayload as never, runSubtask);
	};
}

module.exports = initialize();