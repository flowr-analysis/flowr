import { FlowrAnalyzerPatternFilePlugin, PathPart } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';
import { FlowrSysdataFile } from './files/flowr-sysdata-file';

/** a source package keeps its system data in `R/sysdata.rda`, an installed one in `R/sysdata.rdx` */
const SysdataFilePattern = /(^|[\\/])R[\\/]sysdata\.(rda|rdx)$/i;

/**
 * This plugin provides support for a package's system data, the objects R lazy-loads into the package namespace.
 * It has to run before the {@link FlowrAnalyzerRdaFilePlugin}, which would otherwise claim the `.rda`.
 * @see https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Data-in-packages
 */
export class FlowrAnalyzerSysdataFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-sysdata-file-plugin';
	public readonly description = 'Reads R/sysdata.rda into the objects it lazy-loads into the package namespace.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * @param filePattern - The pattern to identify system data files, matched against the whole path.
	 */
	constructor(filePattern: RegExp = SysdataFilePattern) {
		super(filePattern, PathPart.Full);
	}

	/**
	 * Processes the given file, assigning it the {@link FileRole.Data} role.
	 */
	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrSysdataFile {
		return FlowrSysdataFile.from(file, FileRole.Data);
	}
}
