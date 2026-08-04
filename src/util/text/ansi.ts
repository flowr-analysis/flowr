
// noinspection JSUnusedGlobalSymbols
export const enum FontStyles {
	Bold = 1,
	Faint = 2,
	Italic = 3,
	Underline = 4,
}

// noinspection JSUnusedGlobalSymbols
export const enum Colors {
	Black = 0,
	Red = 1,
	Green = 2,
	Yellow = 3,
	Blue = 4,
	Magenta = 5,
	Cyan = 6,
	White = 7
}

// noinspection JSUnusedGlobalSymbols
export enum ColorEffect {
	Foreground = 30,
	Background = 40,
}

export type FormatOptions = ColorFormatOptions | WeightFormatOptions | ColorFormatOptions & WeightFormatOptions;

export interface ColorFormatOptions {
	color:   Colors
	effect:  ColorEffect
	/** use the high-intensity variant */
	bright?: boolean
}

export interface WeightFormatOptions {
	style: FontStyles | readonly FontStyles[]
}

export interface OutputFormatter {
	format(input: string, options?: FormatOptions): string
	getFormatString(options?: FormatOptions): string
	reset(): string
	/**
	 * Render `text` as a link to `url` in whatever form this output supports (OSC 8, markdown, or plain text).
	 * When a live hyperlink cannot be rendered, the raw `url` is shown so the target is not lost; pass
	 * `force` to always emit just the short `text` label instead.
	 */
	hyperlink(text: string, url: string, force?: boolean): string
}

export const voidFormatter: OutputFormatter = new class implements OutputFormatter {
	public format(input: string): string {
		return input;
	}

	public getFormatString(_options?: FormatOptions): string {
		return '';
	}

	public reset(): string {
		return '';
	}

	public hyperlink(text: string, url: string, force = false): string {
		return force ? text : url;
	}
}();

export const markdownFormatter: OutputFormatter = new class implements OutputFormatter {
	public format(input: string, options?: FormatOptions): string {
		if(options && 'style' in options) {
			if(options.style === FontStyles.Bold) {
				input = `**${input}**`;
			} else if(options.style === FontStyles.Italic || options.style === FontStyles.Faint) {
				input = `_${input}_`;
			} else {
				throw new Error(`Unsupported font style: ${String(options.style)}`);
			}
		}

		let source = input.replaceAll(/\\"/g, '\'').replaceAll(/\\/g, '\\\\').replaceAll(/\n/g, '\\\n');
		/* repeatedly replace all spaces but only at the beginning of a line */
		let target = source;
		do{
			source = target;
			/* or replace back to front */
			target = source.replace(/^(?<leading>(&nbsp;)*) /m, '$<leading>&nbsp;');
		} while(target !== source);
		return target;
	}

	public getFormatString(_options?: FormatOptions): string {
		return '';
	}

	public reset(): string {
		return '';
	}

	public hyperlink(text: string, url: string, _force = false): string {
		return `[${text}](${url})`;
	}
}();

/**
 * This does not work if the {@link setFormatter|formatter} is void. Tries to format the text with a bold font weight.
 */
export function italic(s: string, f: OutputFormatter = formatter, options?: FormatOptions): string {
	return f.format(s, { style: FontStyles.Italic, ...options });
}

/**
 * This does not work if the {@link setFormatter|formatter} is void. Tries to format the text with an italic font shape.
 */
export function bold(s: string, f: OutputFormatter = formatter, options?: FormatOptions): string {
	return f.format(s, { style: FontStyles.Bold, ...options });
}

/**
 * Color the text in the given foreground color.
 */
export function color(s: string, c: Colors, f: OutputFormatter = formatter, opts?: { bright?: boolean, style?: FontStyles | readonly FontStyles[] }): string {
	return f.format(s, { color: c, effect: ColorEffect.Foreground, ...opts });
}

/** Faint/dim ("grayed out") text. */
export function faint(s: string, f: OutputFormatter = formatter, options?: FormatOptions): string {
	return f.format(s, { style: FontStyles.Faint, ...options });
}

/**
 * This does not work if the {@link setFormatter|formatter} is void. Tries to format the text as informational message.
 */
export function ansiInfo(s: string, f: OutputFormatter = formatter): string {
	return f.format(s, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const escape = '\x1b[';
const colorSuffix = 'm';
let hyperlinkSupport: boolean | undefined;
/** best-effort, env-based OSC 8 hyperlink support (`FORCE_HYPERLINK`/`NO_HYPERLINK` override; unknown terminals are treated as unsupported) */
export function supportsHyperlinks(): boolean {
	if(hyperlinkSupport !== undefined) {
		return hyperlinkSupport;
	}
	const env = process.env;
	if(env.FORCE_HYPERLINK !== undefined) {
		return (hyperlinkSupport = env.FORCE_HYPERLINK !== '' && env.FORCE_HYPERLINK !== '0');
	}
	if(env.NO_HYPERLINK !== undefined || !process.stdout.isTTY) {
		return (hyperlinkSupport = false);
	}
	const known = Boolean(env.WT_SESSION || env.KITTY_WINDOW_ID || env.KONSOLE_VERSION || env.DOMTERM)
		|| (env.TERM_PROGRAM !== undefined && ['iTerm.app', 'WezTerm', 'vscode', 'ghostty', 'Hyper', 'rio'].includes(env.TERM_PROGRAM))
		|| (env.VTE_VERSION !== undefined && Number(env.VTE_VERSION) >= 5000)
		|| (env.TERM !== undefined && /kitty|wezterm|ghostty/i.test(env.TERM));
	return (hyperlinkSupport = known);
}

export const ansiFormatter = {
	reset(): string {
		return `${escape}0${colorSuffix}`;
	},

	hyperlink(text: string, url: string, force = false): string {
		if(supportsHyperlinks()) {
			return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
		}
		return force ? text : url;
	},

	format(input: string, options?: FormatOptions): string {
		return `${this.getFormatString(options)}${input}${this.reset()}`;
	},

	getFormatString(options?: FormatOptions): string {
		if(options === undefined) {
			return '';
		}
		const params: number[] = [];
		if('style' in options) {
			const styles: readonly FontStyles[] = Array.isArray(options.style) ? options.style as readonly FontStyles[] : [options.style as FontStyles];
			params.push(...styles);
		}
		if('color' in options) {
			params.push((options.bright ? options.effect + 60 : options.effect) + options.color);
		}
		return params.length === 0 ? '' : `${escape}${params.join(';')}${colorSuffix}`;
	}
};

export let formatter: OutputFormatter = ansiFormatter;

/**
 * (Globally) sets the output formatter used by the utility functions in this module.
 */
export function setFormatter(setFormatter: OutputFormatter): void {
	formatter = setFormatter;
}
