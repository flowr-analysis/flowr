import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerPatternFilePlugin } from '../flowr-analyzer-file-plugin';
import { FlowrRSessionFile } from '../files/flowr-rsession-file';

/* `R CMD check` compares a test against its `.Rout.save` */
export const RSessionPattern = /\.(rout|rout\.save|rsession|rconsole)$/i;

/**
 * The plugin provides support for R console transcripts (`.Rout`, `.Rout.save`)
 */
export class FlowrAnalyzerRSessionFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name =    'rsession-file-plugin';
	public readonly description = 'Parses R console transcripts';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the transcript file plugin.
	 * @param filePattern - The pattern to identify transcripts, see {@link RSessionPattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = RSessionPattern) {
		super(filePattern);
	}

	protected process(_ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrRSessionFile {
		return FlowrRSessionFile.from(arg);
	}
}
