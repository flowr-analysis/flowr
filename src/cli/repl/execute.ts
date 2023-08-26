import { log } from '../../util/log'
import cp from 'child_process'

/**
 * Run the given module with the presented arguments, and wait for it to exit.
 */
export async function waitOnScript(module: string, args: string[]): Promise<void> {
	log.info(`starting script ${module} with args ${JSON.stringify(args)}`)
	const child = cp.fork(module, args)
	child.on('exit', (code, signal) => {
		if (code) {
			console.error(`Script ${module} exited with code ${JSON.stringify(code)} and signal ${JSON.stringify(signal)}`)
			process.exit(code)
		}
	})
	await new Promise<void>(resolve => child.on('exit', resolve))
}
