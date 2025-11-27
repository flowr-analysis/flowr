import Tinypool from 'tinypool';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const _dirname = typeof __dirname !== 'undefined' ? __dirname
	: path.dirname(fileURLToPath(import.meta.url));


/**
 * Simple warpper for tinypool used for dataflow parallelization
 */
export class Threadpool {
	readonly pool: Tinypool;


	constructor(numThreads = 0, workerPath = './worker.ts') {
		if(numThreads <= 0){
			// use avalaible core
			numThreads = Math.max(1, os.cpus().length); // may be problematic, as this returns SMT threads as cores
		}

		const workerFile = path.resolve(_dirname, workerPath);

		// create tiny pool instance
		this.pool = new Tinypool({
			minThreads: 1,
			maxThreads: numThreads,
			filename:   workerFile,
		});
	}

	async submitTask<TInput, TOutput>(taskName: string, taskPayload: TInput): Promise<TOutput>{
		return this.pool.run({ taskName, taskPayload }) as Promise<TOutput>;
	}

	async submitTasks<TInput, TOutput>(taskName: string, taskPayload: TInput[]): Promise<TOutput[]> {
		// Tinypool.run returns a Promise, so we can fully parallelize:
		return await Promise.all(taskPayload.map(t => this.submitTask<TInput, TOutput>(taskName, t)));
	}

	destroyPool(): void {
		void this.pool.destroy();
	}

	clearAllPendingTasks(): void{
		void this.pool.cancelPendingTasks();
	}
}