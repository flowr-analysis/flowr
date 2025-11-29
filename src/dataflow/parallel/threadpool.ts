import os from 'os';
import { TaskName, TaskMessage } from './task-registry';
import { MessagePort } from 'node:worker_threads';
import Piscina from 'piscina';


/**
 * Simple warpper for piscina used for dataflow parallelization
 */
export class Threadpool {
	private readonly pool: Piscina;
    private workerPorts = new Map<number, MessagePort>();

	constructor(numThreads = 0, workerPath = 'worker') {
		if(numThreads <= 0){
			// use avalaible core
			numThreads = Math.max(1, os.cpus().length); // may be problematic, as this returns SMT threads as cores
		}

        console.log(numThreads);

        // create tiny pool instance
        this.pool = new Piscina({
            minThreads: 1,
            maxThreads: numThreads,
            filename:   `${__dirname}/${workerPath}.js`,
            concurrentTasksPerWorker: 1,
        });

        this.pool.on('message', (msg: any) => {
            if (!msg) return;  
            // Worker sends initial port registration
            if (msg.type === 'register-port') {
                const { workerId, port } = msg;
                this.workerPorts.set(workerId, port);
            
            
                // Listen for subtasks from this worker
                port.on('message', (subMsg: any) => {
                    if (subMsg?.type === 'subtask') {
                        this.handleSubtask(workerId, subMsg);
                    }
                });
                return;
            }
        });
	}

    private async handleSubtask(workerId: number, msg: any) {
        const { id, taskName, taskPayload } = msg;
        const port = this.workerPorts.get(workerId);
        if (!port) return;


        try {
            const result = await this.submitTask(taskName, taskPayload);
            port.postMessage({ type: 'subtask-response', id, result });
        } catch (err: any) {
            port.postMessage({
                type: 'subtask-response',
                id,
                error: err?.message ?? String(err),
            });
        }
    }

	async submitTask<TInput, TOutput>(taskName: TaskName, taskPayload: TInput): Promise<TOutput>{
        console.log(`Threadpool called with task: ${taskName}`);
        return this.pool.run({type: "task", taskName, taskPayload }) as Promise<TOutput>;
	}

	async submitTasks<TInput, TOutput>(taskName: TaskName, taskPayload: TInput[]): Promise<TOutput[]> {
		// Tinypool.run returns a Promise, so we can fully parallelize:
		return await Promise.all(taskPayload.map(t => this.submitTask<TInput, TOutput>(taskName, t)));
	}

    /**
     * 
     */
	destroyPool(): void {
		void this.pool.destroy();
	}

	clearAllPendingTasks(): void{

    }
}