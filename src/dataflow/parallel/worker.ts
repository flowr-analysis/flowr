import { parentPort } from "worker_threads";
import { TaskName, workerTasks } from "./task-registry";
import { dataflowLogger } from "../logger";

parentPort!.on(
    "message",
    async (msg: {taskName: TaskName; payload: unknown}) => {
        const task = workerTasks[msg.taskName];

        if(!task){
            dataflowLogger.error(`no handler for task: ${msg.taskName} is registered. Aborting threadpool task.`);
            return;           
        }

        try {
            // @ts-expect-error - payload type depends on task choosen
            const result = await task(msg.payload); // dispatch the task
            parentPort!.postMessage(result);
        } catch (err){
            parentPort!.postMessage({__error: String(err)});
        }
    }
);