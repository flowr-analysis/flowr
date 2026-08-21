import type { ReplOutput } from './repl-main';

/** Output that the user most likely wants on their clipboard as well. */
export const ReplClipboard = {
	name: 'ReplClipboard',
	/** Prints `text` and, if the output allows it, copies it to the clipboard and reports `note` afterwards. */
	async print(this: void, output: ReplOutput, text: string, note: string): Promise<void> {
		output.stdout(text);
		if(output.allowClipboard !== false) {
			try {
				const clipboard = await import('clipboardy');
				clipboard.default.writeSync(text);
				output.stdout(note);
			} catch{ /* do nothing this is a service thing */ }
		}
	}
} as const;
