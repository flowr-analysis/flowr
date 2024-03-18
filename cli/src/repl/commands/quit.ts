import type { ReplCommand } from './main'
import { log } from '../../../../src/util/log'

export const quitCommand: ReplCommand = {
	description:  'End the repl',
	aliases:      [ 'q', 'exit' ],
	usageExample: ':quit',
	script:       false,
	fn:           () => {
		log.info('bye'); process.exit(0) 
	}
}
