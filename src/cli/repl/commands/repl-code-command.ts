import type { ReplCodeCommand, ReplCodeCommandInformation } from './repl-main';
import { handleString } from '../core';
import { ReplClipboard } from './repl-clipboard';

/** A code command whose code is everything after the command, as for most analysis commands. */
export function codeCommand(description: string, usageExample: string, aliases: string[], fn: ReplCodeCommand['fn']): ReplCodeCommand {
	return { description, isCodeCommand: true, usageExample, aliases, script: false, argsParser: (args: string) => handleString(args), fn };
}

/** A code command that prints `text` of the given `type` (and copies it to the clipboard), mentioning the timing of the pipeline `step` if given. */
export function clipboardCommand(description: string, usageExample: string, aliases: string[], produce: (analyzer: ReplCodeCommandInformation['analyzer']) => Promise<{ readonly text: string, readonly type: string, readonly step?: string, readonly timing?: number }>): ReplCodeCommand {
	return codeCommand(description, usageExample, aliases, async({ output, analyzer }) => {
		const { text, type, step, timing } = await produce(analyzer);
		await ReplClipboard.print(output, text, ReplClipboard.note(output, type, step, timing));
	});
}
