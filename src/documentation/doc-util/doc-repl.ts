import type { ReplCommand, ReplOutput } from '../../cli/repl/commands/repl-main';
import { getReplCommands } from '../../cli/repl/commands/repl-commands';
import { getReplCommand } from './doc-cli-option';
import { textWithTooltip } from './doc-hover-over';
import type { RShell } from '../../r-bridge/shell';
import { replProcessAnswer } from '../../cli/repl/core';
import { voidFormatter } from '../../util/ansi';
import { DockerName } from './doc-docker';
import { rawPrompt } from '../../cli/repl/prompt';
import { codeBlock } from './doc-code';

function printHelpForScript(script: [string, ReplCommand], starredVersion?: ReplCommand): string {
	let base = `| **${getReplCommand(script[0], false, starredVersion !== undefined)}** | ${script[1].description}`;
	if(starredVersion) {
		base += ` (star: ${starredVersion.description})`;
	}
	if(script[1].aliases.length === 0) {
		return base;
	}
	const aliases = script[1].aliases;
	return `${base} (alias${aliases.length > 1 ? 'es' : ''}: ${
		aliases.map(a => '**:' + textWithTooltip(a, `Alias of ':${script[0]}'. ${script[1].description}`) + '**').join(', ')
	}) |`;
}

export function printReplHelpAsMarkdownTable(): string {
	const scriptHelp = [];
	const cmds = getReplCommands();
	for(const c of Object.entries(cmds)) {
		if(c[1].script || c[0].endsWith('*')) {
			continue;
		}
		const starred =  cmds[c[0] + '*'];
		scriptHelp.push(printHelpForScript(c, starred));
	}

	return `
| Command | Description |
| ------- | ----------- |
${scriptHelp.sort().join('\n')}
`;
}

interface Collect {
	command: DocumentReplCommand;
	lines:   string[];
}

export interface DocumentReplSessionOptions {
	/** defaults to false and shows starting the repl */
	hideEntry?:           boolean;
	/** defaults to false and allows access to the R session */
	allowRSessionAccess?: boolean;
}

export interface DocumentReplCommand {
	command:     string;
	description: string;
}

export async function documentReplSession(shell: RShell, commands: readonly DocumentReplCommand[], options?: DocumentReplSessionOptions): Promise<string> {
	const collect: Collect[] = [];


	for(const command of commands) {
		const entry: Collect = { command, lines: [] };
		const collectingOutput: ReplOutput = {
			formatter: voidFormatter,
			stdout(msg: string) {
				entry.lines.push(msg);
			},
			stderr(msg: string) {
				entry.lines.push(msg);
			}
		};
		await replProcessAnswer(collectingOutput, command.command, shell, options?.allowRSessionAccess ?? false);
		collect.push(entry);
	}

	let result = '';
	let cache = options?.hideEntry ?  '' : `docker run -it --rm ${DockerName}\n`;

	for(const { command, lines } of collect) {
		if(lines.length === 0) {
			cache += rawPrompt + ' ' + command.command + '\n';
			continue;
		}
		result += `
${codeBlock('shell', cache + rawPrompt + ' ' + command.command)}
<details>
<summary style='color:gray'>Output</summary>

${command.description}

${codeBlock('text', lines.join('\n'))}

</details>

`;
		cache = '';
	}

	return result;
}
