import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerPatternFilePlugin } from '../flowr-analyzer-file-plugin';
import { FlowrJupyterFile } from '../files/flowr-jupyter-file';

const IpynbPattern = /\.ipynb$/i;

/**
 * The plugin provides support for Jupyter (`.ipynb`) files
 */
export class FlowrAnalyzerJupyterFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name =    'ipynb-file-plugin';
	public readonly description = 'Parses Jupyter files';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the Jupyter file plugin.
	 * @param filePattern - The pattern to identify Jupyter files, see {@link IpynbPattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = IpynbPattern) {
		super(filePattern);
	}

	protected process(_ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrJupyterFile {
		return FlowrJupyterFile.from(arg);
	}
}
