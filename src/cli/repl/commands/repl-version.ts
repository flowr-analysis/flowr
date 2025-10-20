import type { ReplCommand } from './repl-main';
import { printVersionInformation } from '../../../util/version';

export const versionCommand: ReplCommand = {
	description:   'Prints the version of flowR as well as the current version of R',
	isCodeCommand: false,
	aliases:       [],
	usageExample:  ':version',
	script:        false,
	fn:            ({ output, analyzer }) => printVersionInformation(output, analyzer)
};
