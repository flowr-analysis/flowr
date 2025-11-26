import type { PathLike } from 'fs';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerFilePlugin } from '../flowr-analyzer-file-plugin';
import { platformBasename } from '../../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { FlowrJupyterFile } from './flowr-jupyter-file';

const IpynbPattern = /\.ipynb$/i;

/**
 * The plugin provides support for Jupyter (`.ipynb`) files
 */
export class FlowrAnalyzerJupyterFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name =    'ipynb-file-plugin';
	public readonly description = 'Parses Jupyter files';
	public readonly version = new SemVer('0.1.0');
	private readonly pattern: RegExp;

	/**
	 * Creates a new instance of the Jupyter file plugin.
	 * @param filePattern - The pattern to identify Jupyter files, see {@link IpynbPattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = IpynbPattern) {
		super();
		this.pattern = filePattern;
	}

	public applies(file: PathLike): boolean {
		return this.pattern.test(platformBasename(file.toString()));
	}

	protected process(_ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrJupyterFile {
		return FlowrJupyterFile.from(arg);
	}
}
