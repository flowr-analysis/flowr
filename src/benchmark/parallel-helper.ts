/**
 * Tasked with parallelize the benchmarking by calling the given script in an executor-pool style fashion
 * @module parallel
 */
import * as cp from 'child_process'
import { log } from '../util/log'

type Arguments = string[]
type WorkingQueue = Arguments[]


/**
 * This is not really generic but written especially for the benchmarking script
 */
export class LimitBenchmarkPool {
  private readonly workingQueue: WorkingQueue
  private readonly limit:        number
  private readonly module:       string
  private counter = 0
  private currentlyRunning  = 0

  constructor(module: string, queue: WorkingQueue, limit: number) {
    this.workingQueue = queue
    this.limit = limit
    this.module = module
  }


  public async run() {
    const promises: Promise<void>[] = []
    while(this.currentlyRunning < this.limit && this.workingQueue.length > 0) {
      promises.push(this.runNext())
    }
    return await Promise.all(promises)
  }

  private async runNext() {
    const args = this.workingQueue.pop()
    if(args === undefined) {
      return
    }
    const child = cp.fork(this.module, args)

    this.currentlyRunning += 1

    child.on('exit', (code, signal) => {
      if(code === 0) {
        this.counter++
      } else {
        log.error(`Benchmark for ${JSON.stringify(args)} exited with code ${JSON.stringify(code)} (signal: ${JSON.stringify(signal)})`)
      }
      this.currentlyRunning -= 1
    })

    await new Promise<void>(resolve => child.on('exit', resolve))
  }


}
