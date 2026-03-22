import type { PathLike } from 'fs';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import { type FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerFilePlugin } from '../flowr-analyzer-file-plugin';
import { platformBasename } from '../../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { FlowrSweaveFile } from '../files/flowr-sweave-file';


const SweavePattern = /\.Rnw$/i;

/**
 * The plugin provides support for Sweave (`.Rnw`) files
 */
export class FlowrAnalyzerSweaveFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name =    'sweave-file-plugin';
	public readonly description = 'Parses R Sweave files';
	public readonly version = new SemVer('0.1.0');
	private readonly pattern: RegExp;

	/**
	 * Creates a new instance of the Sweave file plugin.
	 * @param filePattern - The pattern to identify Sweave files, see {@link SweavePattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = SweavePattern) {
		super();
		this.pattern = filePattern;
	}

	public applies(file: PathLike): boolean {
		return this.pattern.test(platformBasename(file.toString()));
	}

	protected process(_ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrSweaveFile {
		return FlowrSweaveFile.from(arg);
	}
}
