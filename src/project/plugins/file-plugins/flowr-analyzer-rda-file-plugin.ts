import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';
import { platformBasename } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { FlowrRDAFile } from './files/flowr-rda-file';

const RdaFilePattern = /\.(rda|rdata)$/i;

/**
 * This plugin provides support for R workspace files (`.rda`/`.RData`), exposing their top-level objects.
 * @see https://rdrr.io/r/base/load.html
 */
export class FlowrAnalyzerRdaFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-rda-file-plugin';
	public readonly description = 'Reads RDA/RData workspace files into their contained R objects.';
	public readonly version = new SemVer('0.1.0');
	private readonly pattern: RegExp;

	/**
	 * Creates a new instance of the RDA file plugin.
	 * @param filePattern - The pattern to identify RDA files, see {@link RdaFilePattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = RdaFilePattern) {
		super();
		this.pattern = filePattern;
	}

	public applies(file: PathLike): boolean {
		return this.pattern.test(platformBasename(file.toString()));
	}

	/**
	 * Processes the given file, assigning it the {@link FileRole.Data} role.
	 */
	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrRDAFile {
		return FlowrRDAFile.from(file, FileRole.Data);
	}
}
