/**
 * Tasked with parallelize the benchmarking by calling the given script in an executor-pool style fashion
 * @module parallel
 */
import * as cp from 'child_process'
import { log } from '../util/log'
import { guard } from '../util/assert'

type Arguments = string[]
type WorkingQueue = Arguments[]


/**
 * Given the arguments, this can decide if the job is still to be run or if it can be skipped!
 * Return `true` if the job should be run, `false` if it should be skipped.
 */
export type RunPredicate = (args: Arguments) => boolean

/**
 * This is not really generic but written especially for the benchmarking script
 */
export class LimitBenchmarkPool {
	private readonly workingQueue: WorkingQueue
	private readonly limit:        number
	private readonly parallel:     number
	private readonly module:       string
	private counter = 0
	private skipped:               Arguments[] = []
	private currentlyRunning:      Arguments[] = []
	private reportingInterval:     NodeJS.Timer | undefined = undefined
	private readonly predicate:    RunPredicate

	/**
   * Create a new parallel helper that runs the given `module` once for each list of {@link Arguments} in the `queue`.
   * The `limit` stops the execution if `<limit>` number of runs exited successfully.
   * The `parallel` parameter limits the number of parallel executions.
   */
	constructor(module: string, queue: WorkingQueue, limit: number, parallel: number, predicate: RunPredicate = () => true) {
		this.workingQueue = queue
		this.limit = limit
		this.module = module
		this.parallel = parallel
		this.predicate = predicate
	}

	public async run(): Promise<void> {
		this.reportingInterval = setInterval(() => {
			console.log(`Waiting for: ${JSON.stringify(this.currentlyRunning)}`)
		}, 20000)
		const promises: Promise<void>[] = []
		// initial run, runNext will schedule itself recursively we use the limit too if there are more cores than limit :D
		while(this.currentlyRunning.length < Math.min(this.parallel, this.limit) && this.workingQueue.length > 0) {
			promises.push(this.runNext())
		}
		await Promise.all(promises)
		clearInterval(this.reportingInterval as NodeJS.Timeout)
	}

	public getStats(): { counter: number, skipped: Arguments[]} {
		return { counter: this.counter, skipped: this.skipped }
	}

	private async runNext(): Promise<void> {
		if(this.counter + this.currentlyRunning.length >= this.limit || this.workingQueue.length <= 0) {
			console.log(`Skip running next as counter: ${this.counter} and currently running: ${this.currentlyRunning.length} beat ${this.limit} or ${this.workingQueue.length}`)
			return
		}


		const args = this.workingQueue.pop()
		guard(args !== undefined, () => `arguments should not be undefined in ${JSON.stringify(this.workingQueue)}`)

		if(!this.predicate(args)) {
			return await new Promise<void>(resolve => resolve()).then(() => this.runNext())
		}

		this.currentlyRunning.push(args)

		console.log(`[${this.counter}/${this.limit}] Running next, currently running: ${this.currentlyRunning.length}, queue: ${this.workingQueue.length} [args: ${JSON.stringify(args)}]`)

		const child = cp.fork(this.module, args)

		child.on('exit', (code, signal) => {
			if(code === 0) {
				this.counter++
			} else {
				log.error(`Benchmark for ${JSON.stringify(args)} exited with code ${JSON.stringify(code)} (signal: ${JSON.stringify(signal)})`)
				this.skipped.push(args)
			}
			this.currentlyRunning.splice(this.currentlyRunning.findIndex(a => a === args), 1)
		})

		// schedule re-schedule
		await new Promise<void>(resolve => child.on('exit', resolve)).then(() => this.runNext())
	}


}
