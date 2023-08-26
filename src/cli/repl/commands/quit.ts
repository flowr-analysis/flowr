import { ReplCommand } from './main'
import { log } from '../../../util/log'

export const quitCommand: ReplCommand = {
	description:  'End the repl',
	usageExample: ':quit',
	script:       false,
	fn:           () => { log.info('bye'); process.exit(0) }
}
