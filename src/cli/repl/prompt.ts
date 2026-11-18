import { ColorEffect, Colors, formatter } from '../../util/text/ansi';

export const rawPrompt = 'R>';
// is a function as the 'formatter' is configured only after the cli options have been read
/** The colored REPL prompt, formatted lazily. */
export const prompt = () => `${formatter.format(rawPrompt, { color: Colors.Cyan, effect: ColorEffect.Foreground })} `;
