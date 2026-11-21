import type { ReplOutput } from './repl-main';
import { SecureMode } from '../../../util/secure-mode';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';

/**
 * Output that the user most likely wants on their clipboard as well.
 * @helper output
 */
export const ReplClipboard = {
	name: 'ReplClipboard',
	/** The note that `type` was copied, mentioning how long the given pipeline `step` took if known. */
	note(this: void, output: ReplOutput, type: string, step?: string, timing?: number): string {
		return output.formatter.format(`Copied ${type} to clipboard${step === undefined ? '' : ` (${step}: ${timing}ms)`}.`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
	},
	/** Prints `text` and, if the output allows it, copies it to the clipboard and reports `note` afterwards. */
	async print(this: void, output: ReplOutput, text: string, note: string): Promise<void> {
		output.stdout(text);
		if(output.allowClipboard !== false && !SecureMode.isEnabled()) {
			try {
				const clipboard = await import('clipboardy');
				clipboard.default.writeSync(text);
				output.stdout(note);
			} catch{ /* do nothing this is a service thing */ }
		}
	}
} as const;
