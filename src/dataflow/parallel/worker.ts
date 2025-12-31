import { parentPort, MessageChannel, threadId, workerData } from 'node:worker_threads';
import type { TaskName } from './task-registry';
import { SetParserEngine, workerTasks } from './task-registry';
import type { TaskReceivedMessage, WorkerData, WorkerLogLevel } from './threadpool';
import { isPortRegisteredMessage, isSubtaskResponseMessage } from './threadpool';
import { dataflowLogger } from '../logger';
import { retrieveEngineInstances } from '../../engines';
import { cloneConfig, defaultConfigOptions } from '../../config';

const typedWorkerData = workerData as WorkerData;

type PendingEntry<T> = {
	resolve: (value: T | PromiseLike<T>) => void;
	reject:  (reason: unknown) => void;
}

export interface LogScope {
	taskName?:  string;
	taskId?:    number;
	subtaskId?: number;
}

function createLogger(scope: LogScope = {}) {
	function send(
		level: WorkerLogLevel,
		message: string,
		data?: unknown[],
		stack = false
	) {
		parentPort?.postMessage({
			type:        'worker-log',
			level,
			timestamp:   Date.now(),
			hrtime:      process.hrtime(),
			message,
			data,
			stack:       stack ? new Error().stack : undefined,
			correlation: {
				workerId: threadId,
				...scope,
			},
		});
	}

	return {
		debug: (msg: string, ...data: unknown[]) =>
			send('debug', msg, data),
		info: (msg: string, ...data: unknown[]) =>
			send('info', msg, data),
		warn: (msg: string, ...data: unknown[]) =>
			send('warn', msg, data),
		error: (msg: string, ...data: unknown[]) =>
			send('error', msg, data, true),

		/** create nested correlation */
		child(extra: Partial<LogScope>) {
			return createLogger({ ...scope, ...extra });
		},
	};
}


const pending = new Map<number,PendingEntry<unknown>>();


const { port1: workerPort, port2: mainPort } = new MessageChannel();
const rootLog = createLogger();

let portRegisteredResolve: () => void;
const portRegistered = new Promise<void>(res => (portRegisteredResolve = res));

if(!parentPort) {
	/** This 'should' never happen, as this port is provided natively by piscina */
	dataflowLogger.error('Worker started without parentPort present, Aborting worker');
	process.exit(1);
}

rootLog.info(`Worker ${threadId} registering port to main thread.`);
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
	if(isSubtaskResponseMessage(msg)) {
		const { id, result, error } = msg;
		const logger = rootLog.child({ subtaskId: id });
		logger.info('got response for subtask request');
		const entry = pending.get(id);
		if(!entry) {
			return;
		}

		pending.delete(id);

		if(error !== undefined) {
			logger.error(`subtask failed with error: ${error}`);
			entry.reject(error);
		} else {
			logger.info('subtask completed successfully');
			entry.resolve(result);
		}
	}
});


async function runSubtask<TInput, TOutput>(taskName: TaskName, taskPayload: TInput): Promise<TOutput> {
	const id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
	const logger = rootLog.child({ taskName, taskId: id });
	//return undefined as unknown as TOutput;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
		logger.info(`submitting subtask ${taskName} with ${id} from ${threadId}`);
		// submit the subtask to main thread
		workerPort.postMessage({
			type: 'subtask',
			id,
			taskName,
			taskPayload,
		});
	});
}

async function initialize() {
	await portRegistered;

	const config = typedWorkerData.flowrConfig ?? cloneConfig(defaultConfigOptions);
	const engines = await retrieveEngineInstances(config, true);
	SetParserEngine(engines.engines[engines.default]);

	return (msg: TaskReceivedMessage) => {
		const { taskName, taskPayload } = msg;
		const logger = rootLog.child({ taskName });
		const taskHandler = workerTasks[taskName];
		if(!taskHandler) {
			logger.error(`Requested unknown task (${taskName})`);
			return undefined;
		}
		return taskHandler(taskPayload as never, runSubtask);
	};
}

module.exports = initialize();
