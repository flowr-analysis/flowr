import { FlowrAnalyzerRoleFilePlugin, PathPart } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import { FileRole } from '../../context/flowr-file';

const TestPathPattern = /tests?/i;

/**
 * This plugin provides supports for the identification of test files.
 * If you use multiple plugins, this should be included *before* other plugins.
 */
export class FlowrAnalyzerMetaTestFilesPlugin extends FlowrAnalyzerRoleFilePlugin {
	public readonly name = 'flowr-analyzer-test-files-plugin';
	public readonly description = 'Loads test files.';
	public readonly version = new SemVer('0.1.0');
	protected readonly roles = [FileRole.Test];

	/**
	 * Creates a new instance of the TEST file plugin.
	 * @param pathPattern - The pathPattern to identify TEST files, see {@link TestPathPattern} for the default pathPattern.
	 */
	constructor(pathPattern: RegExp = TestPathPattern) {
		super(pathPattern, PathPart.Dirname);
	}
}
