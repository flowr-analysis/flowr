import { FlowrAnalyzerPatternFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';

const FileNamePattern = /license(\.md|\.txt)?$/i;

/**
 * This plugin provides supports for the identification of license files.
 */
export class FlowrAnalyzerLicenseFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-license-files-plugin';
	public readonly description = 'Loads license files.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the LICENSE file plugin.
	 * @param pathPattern - The pathPattern to identify LICENSE files, see {@link FileNamePattern} for the default pathPattern.
	 */
	constructor(pathPattern: RegExp = FileNamePattern) {
		super(pathPattern);
	}

	/**
	 * Processes the given file, assigning it the {@link FileRole.License} role.
	 */
	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrFileProvider {
		file.assignRole(FileRole.License);
		return file;
	}
}
