import { parentPort } from 'worker_threads';
import type { TaskName } from './task-registry';
import { workerTasks } from './task-registry';
import { dataflowLogger } from '../logger';

if(!parentPort){
	throw new Error('Worker started without Paren Port present');
}

parentPort.on(
	'message',
	(msg: {taskName: TaskName; payload: unknown}) => {
		(() => {
			const task = workerTasks[msg.taskName];

			if(!task){
				dataflowLogger.error(`no handler for task: ${msg.taskName} is registered. Aborting threadpool task.`);
				return;
			}

			if(!parentPort){
				throw new Error('Worker started without Paren Port present');
			}

			try {
				// @ts-expect-error - payload type depends on task choosen
				const result = task(msg.payload); // dispatch the task
				parentPort.postMessage(result);
			} catch(err){
				parentPort.postMessage({ __error: String(err) });
			}
		})();
	}
);