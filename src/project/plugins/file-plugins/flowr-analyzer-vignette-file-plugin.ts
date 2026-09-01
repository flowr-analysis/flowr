import { FlowrAnalyzerRoleFilePlugin, PathPart } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import { FileRole } from '../../context/flowr-file';

const VignettePathPattern = /vignettes?/i;

/**
 * This plugin provides supports for the loading of Vignette files.
 * If you use multiple plugins, this should be included *before* other plugins.
 */
export class FlowrAnalyzerMetaVignetteFilesPlugin extends FlowrAnalyzerRoleFilePlugin {
	public readonly name = 'flowr-analyzer-vignette-files-plugin';
	public readonly description = 'Loads vignette files.';
	public readonly version = new SemVer('0.1.0');
	protected readonly roles = [FileRole.Vignette];

	/**
	 * Creates a new instance of the VIGNETTE file plugin.
	 * @param pathPattern - The pathPattern to identify VIGNETTE files, see {@link VignettePathPattern} for the default pathPattern.
	 */
	constructor(pathPattern: RegExp = VignettePathPattern) {
		super(pathPattern, PathPart.Dirname);
	}
}
