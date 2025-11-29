import { parentPort, MessageChannel, MessagePort, workerData } from "node:worker_threads"
import { SourceFilePayload, TaskName, TaskType, workerTasks } from "./task-registry";


export type SubtaskRequestMessage = {
    type: "subtask";
    requestId: number;
    taskName: string;
    taskPayload: unknown;
};

export type SubtaskResponseMessage =
    | { requestId: number; type: "subtaskResult"; result: unknown }
    | { requestId: number; type: "subtaskError"; error: string };


    
const pending = new Map<
        string, 
        {resolve: (v: any) => void; reject: (e: any) => void}
    >();

const { port1: workerPort, port2: mainPort } = new MessageChannel();
    
parentPort!.postMessage({
        type: 'register-port',
        workerId: workerData?.id ?? Math.random(),
        port: mainPort,
    },
    [mainPort] // transfer port to main thread
);

workerPort.on("message", (msg: any) => {
    if(msg?.type === "subtask-response"){
        const {id, result, error} = msg;
        const entry = pending.get(id);
        if(!entry)return;

        pending.delete(id);

        if(error !== undefined)entry.reject(error);
        else entry.resolve(result);
    }
});



async function runSubtask<TInput, TOutput>(taskName: TaskName, taskPayload: any)
    : Promise<TOutput> {
    console.log('Entering subtask emitter');
    const id = Math.random().toString(36).slice(2);
    //return undefined as unknown as TOutput;
    return new Promise((resolve, reject) => {
        pending.set(id, {resolve, reject });

        // submit the subtask to main thread
        workerPort.postMessage({
            type: "subtask",
            id,
            taskName,
            taskPayload,
        })
    });
}

export default ({type, taskName, taskPayload}: {type: TaskType, taskName: TaskName, taskPayload: any}) => {
    console.log(type);

    const taskHandler = workerTasks[taskName];
    console.log(taskHandler);
    console.log(taskName);
    if(!taskHandler){
        console.log(`Requested unknown task (${taskName as TaskName})`);
        return undefined;
    }
    console.log('Hello from worker thread');
    return taskHandler(taskPayload, runSubtask);
}