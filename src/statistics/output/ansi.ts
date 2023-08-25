
// noinspection JSUnusedGlobalSymbols
export enum FontStyles {
	bold = 1,
	faint = 2,
	italic = 3
}

// noinspection JSUnusedGlobalSymbols
export enum Colors {
	black = 0,
	red = 1,
	green = 2,
	yellow = 3,
	blue = 4,
	magenta = 5,
	cyan = 6,
	white = 7
}

// noinspection JSUnusedGlobalSymbols
export enum ColorEffect {
	foreground = 30,
	background = 40,
}

export type FormatOptions = ColorFormatOptions | WeightFormatOptions | ColorFormatOptions & WeightFormatOptions

export interface ColorFormatOptions {
	color:  Colors
	effect: ColorEffect
}

export interface WeightFormatOptions {
	style: FontStyles
}

export interface OutputFormatter {
	format(input: string, options?: FormatOptions): string
}

export const voidFormatter: OutputFormatter = new class implements OutputFormatter {
	public format(input: string): string {
		return input
	}
}

/**
 * This does not work if the {@link setFormatter | formatter} is void. Tries to format the text with a bold font weight.
 */
export function italic(s: string, options?: FormatOptions): string {
	return formatter.format(s, { style: FontStyles.italic, ...options })
}

/**
 * This does not work if the {@link setFormatter | formatter} is void. Tries to format the text with an italic font shape.
 */
export function bold(s: string, options?: FormatOptions): string {
	return formatter.format(s, { style: FontStyles.bold, ...options })
}

export const escape = '\x1b['
const colorSuffix = 'm'
export const ansiFormatter = {
	reset(): string {
		return `${escape}0${colorSuffix}`
	},

	format(input: string, options?: FormatOptions): string {
		return `${this.getFormatString(options)}${input}${this.reset()}`
	},

	getFormatString(options?: FormatOptions): string {
		if(options === undefined) {
			return ''
		}
		const colorString = 'color' in options ? `${options.effect + options.color}` : ''
		const weightString = 'style' in options ? `${options.style}` : ''
		return `${escape}${colorString}${weightString !== "" ? ';' : ''}${weightString}${colorSuffix}`
	}
}

export let formatter: OutputFormatter = ansiFormatter

export function setFormatter(setFormatter: OutputFormatter): void {
	formatter = setFormatter
}
