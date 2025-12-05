import type { PathLike } from 'fs';
import type { GeneralDocContext } from './doc-context';
import type { RShell } from '../../r-bridge/shell';
import type { TreeSitterExecutor } from '../../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { AsyncOrSync } from 'ts-essentials';

export interface DocMakerArgs {
	/** Overwrite existing wiki files, even if nothing changes */
	readonly force?:     boolean;
	/**
	 * The general documentation context to use for generating links and headers
	 */
	readonly ctx:        GeneralDocContext;
	/**
	 * The RShell engine to use for R code execution and retrieval
	 */
	readonly shell:      RShell,
	/**
	 * The TreeSitter engine to use for R code parsing
	 */
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
	getWrittenSubfiles(): Set<string>;
}


const DefaultReplacementPatterns: Array<[RegExp, string]> = [
	// eslint-disable-next-line no-irregular-whitespace -- we may produce it in output
	[/[0-9]+(\.[0-9]+)?( |\s*)?ms/g, ''],
	[/tmp[%A-Za-z0-9-]+/g, ''],
	[/"(timing|searchTimeMs|processTimeMs|id|treeSitterId)":\s*[0-9]+(\.[0-9])?,?/g, ''],
	[/"format":"compact".+/gmius, ''],
	[/%%\s*\d*-+/g, ''],
	[/"[rR]": "\d+\.\d+\.\d+.*?"/g, ''],
	[/R\s*\d+\.\d+\.\d+/g, ''],
	[/v\d+\.\d+\.\d+/g, ''],
	// async wrapper depends on whether the promise got forfilled already
	[/async|%20/g, '']
];

/**
 * Abstract base class for generating wiki files.
 * **Please make sure to register your WikiMaker implementation in the CLI wiki tool to have it executed:
 * `src/cli/wiki.ts`.**
 *
 * If this wiki page produces multiple pages ("sub files"), you can use `writeSubFile` inside the `text` method
 * to write those additional files.
 */
export abstract class DocMaker implements DocMakerLike {
	private readonly target:      PathLike;
	private readonly filename:    string;
	private readonly purpose:     string;
	private readonly printHeader: boolean;
	private currentArgs?:         DocMakerArgs & DocMakerOutputArgs;
	private writtenSubfiles:      Set<string> = new Set();

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
	 * Gets the set of subfiles written during the last `make` call.
	 */
	public getWrittenSubfiles(): Set<string> {
		return this.writtenSubfiles;
	}

	/**
	 * Generates or updates the wiki file at the given target location.
	 * @returns `true` if the file was created or updated, `false` if it was identical and not changed.
	 */
	public async make(
		args: DocMakerArgs & DocMakerOutputArgs
	): Promise<boolean> {
		this.currentArgs = args;
		this.writtenSubfiles = new Set();
		const newText = (this.printHeader ? (await args.ctx.header(this.filename, this.purpose)) + '\n': '') + await this.text(args);
		if(args.force || this.didUpdate(this.target, newText, args.readFileSync(this.target)?.toString()) === WikiChangeType.Changed) {
			args.writeFileSync(this.target, newText);
			return true;
		}
		return this.writtenSubfiles.size > 0;
	}

	/**
	 * Please note that for subfiles you have to always add your own header
	 */
	protected writeSubFile(path: PathLike, data: string): boolean {
		if(!this.currentArgs) {
			throw new Error('DocMaker: writeSubFile called outside of make()');
		}
		if(this.currentArgs.force || this.didUpdate(path, data, this.currentArgs.readFileSync(path)?.toString()) === WikiChangeType.Changed) {
			this.currentArgs.writeFileSync(path.toString(), data);
			this.writtenSubfiles.add(path.toString());
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
	protected didUpdate(path: PathLike, newText: string, oldText: string | undefined): WikiChangeType {
		if(oldText === newText) {
			return WikiChangeType.Identical;
		}
		const normOld = this.normalizeText(oldText ?? '');
		const normNew = this.normalizeText(newText);
		const same = normOld === normNew;
		if(!same) {
			// find first diff
			for(let i = 0; i < Math.min(normOld.length, normNew.length); i++) {
				if(normOld[i] !== normNew[i]) {
					const contextOld = normOld.slice(Math.max(0, i - 20), Math.min(normOld.length, i + 20));
					const contextNew = normNew.slice(Math.max(0, i - 20), Math.min(normNew.length, i + 20));
					console.log(`      [${path.toString()}] First diff at pos ${i}:\n      - Old: ...${contextOld}...\n      + New: ...${contextNew}...`);
					break;
				}
			}
		}
		return same ? WikiChangeType.UnimportantChange : WikiChangeType.Changed;
	}

	/**
	 * Generates the wiki text for the given arguments.
	 * The text will be automatically prefixed with metadata including filename and purpose.
	 */
	protected abstract text(args: DocMakerArgs): AsyncOrSync<string>;
}