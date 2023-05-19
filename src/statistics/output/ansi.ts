export enum FontWeights {
  bold = 1,
  faint = 2,
  italic = 3
}

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
  weight: FontWeights
}

export interface OutputFormatter {
  format(input: string, options?: FormatOptions): string
}

export const voidFormatter: OutputFormatter = new class implements OutputFormatter {
  public format(input: string): string {
    return input
  }
}

const escape = '\x1b['
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
    const weightString = 'weight' in options ? `${options.weight}` : ''
    return `${escape}${colorString}${weightString !== "" ? ';' : ''}${weightString}${colorSuffix}`
  }
}

export let formatter: OutputFormatter = ansiFormatter

export function setFormatter(setFormatter: OutputFormatter): void {
  formatter = setFormatter
}
