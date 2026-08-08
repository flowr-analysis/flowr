/**
 * Handling of repl inputs that name a file, shared by every command that takes R code.
 * @module
 */
import fs from 'fs';
import { fileProtocol } from '../../r-bridge/retriever';
import type { FlowrConfig } from '../../config';
import type { ReplOutput } from './commands/repl-main';
import { ansiInfo, bold } from '../../util/text/ansi';

/** Prefix of an input that is to be re-analyzed whenever the file changes, the counterpart of {@link fileProtocol}. */
export const watchProtocol = 'watch://';

/** Whether `s` looks like a filesystem path the user likely meant to load via {@link fileProtocol}. */
function looksLikePath(s: string): boolean {
	if(s.startsWith(fileProtocol) || s.startsWith(watchProtocol)) {
		return false;
	}
	if(/^(~|\.{0,2}\/|[a-zA-Z]:[\\/])/.test(s)) {
		return true;
	}
	// a single path-like token (a separator, no R-code punctuation) that actually exists on disk
	return /^[^\s()]+\/[^\s()]+$/.test(s) && fs.existsSync(s);
}

/** The input to analyze: one that looks like a path gets the {@link fileProtocol}, unless the repl config says not to. */
export function handlePathLikeInput(output: ReplOutput, input: string, config: FlowrConfig): string {
	if(!looksLikePath(input)) {
		return input;
	}
	const asFile = fileProtocol + input;
	if(config.repl.autoUseFileProtocol) {
		output.stdout(ansiInfo(`'${input}' looks like a path, analyzing ${bold(asFile, output.formatter)} (${bold('repl.autoUseFileProtocol', output.formatter)} is set).`));
		return asFile;
	}
	output.stdout(ansiInfo(`'${input}' looks like a path. To analyze it, use ${bold(asFile, output.formatter)} (or ${bold(watchProtocol + input, output.formatter)} to re-run on changes), or re-enable ${bold('repl.autoUseFileProtocol', output.formatter)} to have flowR do this for you. Use ${bold(':help', output.formatter)} for more.`));
	return input;
}
