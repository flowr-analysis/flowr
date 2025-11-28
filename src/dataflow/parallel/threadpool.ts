import Tinypool from 'tinypool';
import os from 'os';

/**
 * Simple warpper for tinypool used for dataflow parallelization
 */
export class Threadpool {
	readonly pool: Tinypool;


	constructor(numThreads = 0, workerPath = 'worker') {
		if(numThreads <= 0){
			// use avalaible core
			numThreads = Math.max(1, os.cpus().length); // may be problematic, as this returns SMT threads as cores
		}

		const workerFile = `${__dirname}/${workerPath}.js`;
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