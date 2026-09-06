import { FlowrAnalyzerRoleFilePlugin, PathPart } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import { FileRole } from '../../context/flowr-file';

const InstPathPattern = /(^|\/)inst(\/|$)/;

/**
 * This plugin provides supports for the identification of installed files (files below an `inst/` folder).
 * If you use multiple plugins, this should be included *before* other plugins.
 */
export class FlowrAnalyzerMetaInstFilesPlugin extends FlowrAnalyzerRoleFilePlugin {
	public readonly name = 'flowr-analyzer-inst-files-plugin';
	public readonly description = 'Loads installed files.';
	public readonly version = new SemVer('0.1.0');
	protected readonly roles = [FileRole.Install];

	/**
	 * Creates a new instance of the INST file plugin.
	 * @param pathPattern - The pathPattern to identify INST files, see {@link InstPathPattern} for the default pathPattern.
	 */
	constructor(pathPattern: RegExp = InstPathPattern) {
		super(pathPattern, PathPart.Dirname);
	}
}
