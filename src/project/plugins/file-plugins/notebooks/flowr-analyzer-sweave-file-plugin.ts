import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerPatternFilePlugin } from '../flowr-analyzer-file-plugin';
import { FlowrSweaveFile } from '../files/flowr-sweave-file';


const SweavePattern = /\.Rnw$/i;

/**
 * The plugin provides support for Sweave (`.Rnw`) files
 */
export class FlowrAnalyzerSweaveFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name =    'sweave-file-plugin';
	public readonly description = 'Parses R Sweave files';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the Sweave file plugin.
	 * @param filePattern - The pattern to identify Sweave files, see {@link SweavePattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = SweavePattern) {
		super(filePattern);
	}

	protected process(_ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrSweaveFile {
		return FlowrSweaveFile.from(arg);
	}
}
