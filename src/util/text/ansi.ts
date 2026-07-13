
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
	/** render `text` as a link to `url` in whatever form this output supports (OSC 8, markdown, or plain text) */
	hyperlink(text: string, url: string): string
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

	public hyperlink(text: string, _url: string): string {
		return text;
	}
}();

export const markdownFormatter: OutputFormatter = new class implements OutputFormatter {
	public format(input: string, options?: FormatOptions): string {
		if(options && 'style' in options) {
			if(options.style === FontStyles.Bold) {
				input = `**${input}**`;
			} else if(options.style === FontStyles.Italic) {
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

	public hyperlink(text: string, url: string): string {
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

/**
 * Render `text` as a clickable link to `url` when the output supports it: an OSC 8 terminal hyperlink for the
 * ANSI formatter, a markdown link for the markdown/wiki formatter, and plain `text` when formatting is disabled
 * (the void formatter) so no escape codes leak into non-terminal output.
 */
export function hyperlink(text: string, url: string, f: OutputFormatter = formatter): string {
	return f.hyperlink(text, url);
}

/**
 * This does not work if the {@link setFormatter|formatter} is void. Tries to format the text as informational message.
 */
export function ansiInfo(s: string, f: OutputFormatter = formatter): string {
	return f.format(s, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const escape = '\x1b[';
const colorSuffix = 'm';
export const ansiFormatter = {
	reset(): string {
		return `${escape}0${colorSuffix}`;
	},

	hyperlink(text: string, url: string): string {
		return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
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
