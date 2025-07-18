import type { ReplCommand, ReplCommandInformation, ReplOutput } from './repl-main';
import { ColorEffect, Colors, FontStyles, italic } from '../../../util/text/ansi';
import { RShell } from '../../../r-bridge/shell';

export async function tryExecuteRShellCommand({ output, parser, allowRSessionAccess, remainingLine }: ReplCommandInformation) {
	if(!allowRSessionAccess){
		output.stderr(`${output.formatter.format('You are not allowed to execute arbitrary R code.', { style: FontStyles.Bold, color: Colors.Red, effect: ColorEffect.Foreground })} 
If you want to do so, please restart flowR with the ${output.formatter.format('--r-session-access', { style: FontStyles.Bold })} flag${ parser.name !== 'r-shell' ? '. Additionally, please enable the r-shell engine, e.g., with ' + output.formatter.format('--default-engine r-shell', { style: FontStyles.Bold }) : ''}. Please be careful of the security implications of this action. When running flowR with npm, you have to use an extra ${output.formatter.format('--', { style: FontStyles.Bold })} to separate flowR from npm arguments.`);
	} else if(parser instanceof RShell) {
		await executeRShellCommand(output, parser, remainingLine);
	} else {
		output.stderr(`Executing arbitrary R code is only possible when using the r-shell engine as the default engine. Enable it using the configuration file or the ${output.formatter.format('--default-engine r-shell', { style: FontStyles.Bold })} command line option. When running flowR with npm, you have to use an extra ${output.formatter.format('--', { style: FontStyles.Bold })} to separate flowR from npm arguments.`);
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
