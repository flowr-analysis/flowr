import type { ReplCommand, ReplOutput } from './repl-main';
import { ColorEffect, Colors, FontStyles, italic } from '../../../util/text/ansi';
import { RShell } from '../../../r-bridge/shell';
import type { KnownParser } from '../../../r-bridge/parser';
import type { FlowrConfigOptions } from '../../../config';

export async function tryExecuteRShellCommand(output: ReplOutput, parser: KnownParser, statement: string, allowRSessionAccess: boolean, _config: FlowrConfigOptions) {
	if(!allowRSessionAccess){
		output.stderr(`${output.formatter.format('You are not allowed to execute arbitrary R code.', { style: FontStyles.Bold, color: Colors.Red, effect: ColorEffect.Foreground })}\nIf you want to do so, please restart flowR with the ${output.formatter.format('--r-session-access', { style: FontStyles.Bold })} flag. Please be careful of the security implications of this action.`);
	} else if(parser instanceof RShell) {
		await executeRShellCommand(output, parser, statement);
	} else {
		output.stderr(`Executing arbitrary R code is only possible when using the r-shell engine as the default engine. Enable it using the configuration file or the ${output.formatter.format('--default-engine r-shell', { style: FontStyles.Bold })} command line option.`);
	}
}

async function executeRShellCommand(output: ReplOutput, shell: RShell, statement: string) {
	try {
		const result = await shell.sendCommandWithOutput(statement, {
			from:                    'both',
			automaticallyTrimOutput: true
		});
		output.stdout(`${italic(result.join('\n'), output.formatter)}\n`);
	} catch(e) {
		output.stderr(`Error while executing '${statement}': ${(e as Error).message}`);
	}
}

export const executeCommand: ReplCommand = {
	description:  'Execute the given code as R code (essentially similar to using now command). This requires the `--r-session-access` flag to be set and requires the r-shell engine.',
	usageExample: ':execute',
	aliases:      [ 'e', 'r' ],
	script:       false,
	fn:           tryExecuteRShellCommand
};
