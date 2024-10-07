import type { ReplCommand } from './repl-main';
import { log } from '../../../util/log';

export const quitCommand: ReplCommand = {
	description:  'End the repl',
	aliases:      [ 'q', 'exit' ],
	usageExample: ':quit',
	script:       false,
	fn:           () => {
		log.info('bye'); process.exit(0);
	}
};
