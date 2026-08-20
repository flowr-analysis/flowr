import type readline from 'readline';
import type { EventEmitter } from 'events';
import type { FlowrConfig } from '../../config';

export const defaultReplHint = ':help · Tab completes · :query @config +repl.hints=false to hide';

/** ANSI that draws the dimmed `hint` and restores the cursor to where it was. */
export function ghostHintShowSequence(hint: string): string {
	return `\x1b7\x1b[2m${hint}\x1b[0m\x1b8`;
}

export const ghostHintClearSequence = '\x1b[0K';

export interface GhostHintIO {
	stdin:  EventEmitter & { isTTY?: boolean };
	stdout: { isTTY?: boolean, columns?: number, write(s: string): unknown };
}

export interface GhostHintOptions {
	hint?:    string;
	suggest?: (line: string) => string;
}

export interface GhostHintController {
	show(): void;
	clear(): void;
}

const noopController: GhostHintController = { show: () => {}, clear: () => {} };

/** Whether hints may be shown: enabled in the config and on an interactive TTY (honoring `NO_COLOR`/`TERM=dumb`). */
export function ghostHintEnabled(
	config: FlowrConfig,
	env: NodeJS.ProcessEnv = process.env,
	stdout: { isTTY?: boolean } = process.stdout,
	stdin: { isTTY?: boolean } = process.stdin
): boolean {
	return Boolean(config.repl.hints && stdout.isTTY && stdin.isTTY && !env.NO_COLOR && env.TERM !== 'dumb');
}

/**
 * Installs an opt-out ghost hint on the REPL prompt: a dim placeholder on the empty prompt and, as the user
 * types, a dim preview of the best Tab-completion. A no-op on non-interactive terminals (see
 * {@link ghostHintEnabled}) and whenever the text would not fit the line, so it can never wrap or corrupt output.
 */
export function installGhostHint(
	rl: readline.Interface,
	config: FlowrConfig,
	{ hint = defaultReplHint, suggest }: GhostHintOptions = {},
	io: GhostHintIO = { stdin: process.stdin, stdout: process.stdout }
): GhostHintController {
	if(!ghostHintEnabled(config, process.env, io.stdout, io.stdin)) {
		return noopController;
	}
	const state = rl as unknown as { line?: string, cursor?: number };
	const getLine = () => state.line ?? '';
	const cursorAtEnd = () => state.cursor === undefined || state.cursor === getLine().length;
	const fits = (text: string) => getLine().length + text.length + 6 < (io.stdout.columns ?? 80);

	let shown = false;
	const clear = () => {
		if(shown) {
			io.stdout.write(ghostHintClearSequence);
			shown = false;
		}
	};
	const render = (text: string) => {
		clear();
		if(text && fits(text)) {
			io.stdout.write(ghostHintShowSequence(text));
			shown = true;
		}
	};
	const update = () => {
		if(!config.repl.hints) {
			clear();
			return;
		}
		const line = getLine();
		if(line.length === 0) {
			render(hint);
		} else if(cursorAtEnd()) {
			render(suggest?.(line) ?? '');
		} else {
			clear();
		}
	};

	io.stdin.prependListener('keypress', clear);
	io.stdin.on('keypress', (_s: string, key?: { name?: string }) => {
		if(!isSubmitKey(key)) {
			update();
		}
	});
	return { show: update, clear };
}

function isSubmitKey(key?: { name?: string }): boolean {
	return key?.name === 'return' || key?.name === 'enter';
}
