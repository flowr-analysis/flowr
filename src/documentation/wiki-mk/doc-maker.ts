import type { PathLike } from 'fs';
import type { GeneralWikiContext } from './wiki-context';
import type { RShell } from '../../r-bridge/shell';
import type { TreeSitterExecutor } from '../../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { AsyncOrSync } from 'ts-essentials';


// TODO: write output file for git
export interface DocMakerArgs {
	/** Overwrite existing wiki files, even if nothing changes */
	readonly force?:     boolean;
	readonly ctx:        GeneralWikiContext;
	readonly shell:      RShell,
	readonly treeSitter: TreeSitterExecutor
}

export interface DocMakerOutputArgs {
	writeFileSync(path: PathLike, data: string): void;
	readFileSync(path: PathLike): string | Buffer<ArrayBufferLike> | undefined;
}

export enum WikiChangeType {
	Changed,
	UnimportantChange,
	Identical
}

export interface DocMakerLike {
	make(args: DocMakerArgs & DocMakerOutputArgs): Promise<boolean>;
	getTarget(): string;
	getProducer(): string;
}


const DefaultReplacementPatterns: Array<[RegExp, string]> = [
	// eslint-disable-next-line no-irregular-whitespace -- we may produce it in output
	[/[0-9]+(\.[0-9]+)?( |\s*)?ms/g, ''],
	[/tmp[%A-Za-z0-9-]+/g, ''],
	[/"(timing|searchTimeMs|processTimeMs)":\s*[0-9]+(\.[0-9])?,?/g, ''],
	[/"format":"compact".+/g, '']
];

/**
 * Abstract base class for generating wiki files.
 * **Please make sure to register your WikiMaker implementation in the CLI wiki tool to have it executed:
 * `src/cli/wiki.ts`.**
 */
export abstract class DocMaker implements DocMakerLike {
	private readonly target:      PathLike;
	private readonly filename:    string;
	private readonly purpose:     string;
	private readonly printHeader: boolean;

	/**
	 * Creates a new WikiMaker instance.
	 * @param target      - The target path where the wiki file will be generated.
	 * @param filename    - The name of the file being generated. Probably use `module.filename`.
	 * @param purpose     - The purpose of the file, e.g., 'wiki context for types'.
	 * @param printHeader - Whether to print the auto-generation header. Default is `true`. Only mark this `false` if you plan to add it yourself.
	 * @protected
	 */
	protected constructor(target: PathLike, filename: string, purpose: string, printHeader = true) {
		this.filename = filename;
		this.purpose = purpose;
		this.target = target;
		this.printHeader = printHeader;
	}

	/**
	 * Gets the target path where the wiki file will be generated.
	 */
	public getTarget(): string {
		return this.target.toString();
	}

	/**
	 * Gets the name of the producer of this wiki file.
	 */
	public getProducer(): string {
		return this.filename;
	}

	/**
	 * Generates or updates the wiki file at the given target location.
	 * @returns `true` if the file was created or updated, `false` if it was identical and not changed.
	 */
	public async make(
		args: DocMakerArgs & DocMakerOutputArgs
	): Promise<boolean> {
		const newText = (this.printHeader ? (await args.ctx.header(this.filename, this.purpose)) + '\n': '') + await this.text(args);
		if(args.force || this.didUpdate(newText, args.readFileSync(this.target)?.toString()) === WikiChangeType.Changed) {
			args.writeFileSync(this.target, newText);
			return true;
		}
		return false;
	}

	/**
	 * Normalizes the given wiki text for comparison.
	 */
	protected normalizeText(text: string): string {
		// drop first two meta lines
		let result = text.split('\n').slice(2).join('\n');
		for(const [pattern, replacement] of DefaultReplacementPatterns) {
			result = result.replace(pattern, replacement);
		}
		return result.trim();
	}

	/**
	 * Determines the type of change between the old and new text.
	 */
	protected didUpdate(newText: string, oldText: string | undefined): WikiChangeType {
		if(oldText === newText) {
			return WikiChangeType.Identical;
		}
		const normOld = this.normalizeText(oldText ?? '');
		const normNew = this.normalizeText(newText);
		return normOld === normNew ? WikiChangeType.UnimportantChange : WikiChangeType.Changed;
	}

	/**
	 * Generates the wiki text for the given arguments.
	 * The text will be automatically prefixed with metadata including filename and purpose.
	 */
	protected abstract text(args: DocMakerArgs): AsyncOrSync<string>;
}