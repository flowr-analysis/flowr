
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
	color:  Colors
	effect: ColorEffect
}

export interface WeightFormatOptions {
	style: FontStyles
}

export interface OutputFormatter {
	format(input: string, options?: FormatOptions): string
	getFormatString(options?: FormatOptions): string
	reset(): string
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
}();

export const markdownFormatter: OutputFormatter = new class implements OutputFormatter {
	public format(input: string, options?: FormatOptions): string {
		if(options && 'style' in options) {
			if(options.style === FontStyles.Bold) {
				input = `**${input}**`;
			} else if(options.style === FontStyles.Italic) {
				input = `_${input}_`;
			} else {
				throw new Error(`Unsupported font style: ${options.style}`);
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

	format(input: string, options?: FormatOptions): string {
		return `${this.getFormatString(options)}${input}${this.reset()}`;
	},

	getFormatString(options?: FormatOptions): string {
		if(options === undefined) {
			return '';
		}
		const colorString = 'color' in options ? `${options.effect + options.color}` : '';
		const weightString = 'style' in options ? `${options.style}` : '';
		return `${escape}${colorString}${weightString !== '' ? ';' : ''}${weightString}${colorSuffix}`;
	}
};

export let formatter: OutputFormatter = ansiFormatter;

/**
 * (Globally) sets the output formatter used by the utility functions in this module.
 */
export function setFormatter(setFormatter: OutputFormatter): void {
	formatter = setFormatter;
}
