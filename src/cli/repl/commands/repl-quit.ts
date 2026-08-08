import type { ReplCommand } from './repl-main';
import { log } from '../../../util/log';
import { exitSafe } from '../../../util/proc';

export const quitCommand: ReplCommand = {
	description:   'End the repl',
	isCodeCommand: false,
	aliases:       [ 'q', 'exit' ],
	usageExample:  ':quit',
	script:        false,
	fn:            () => {
		log.info('bye');
		exitSafe(0);
	}
};
