import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import {
	platformBasename
} from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';

const FileNamePattern = /license(\.md|\.txt)?$/i;

/**
 * This plugin provides supports for the identification of license files.
 */
export class FlowrAnalyzerLicenseFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-license-files-plugin';
	public readonly description = 'This plugin provides support for loading license files.';
	public readonly version = new SemVer('0.1.0');
	private readonly pathPattern: RegExp;

	/**
	 * Creates a new instance of the TEST file plugin.
	 * @param pathPattern - The pathPattern to identify TEST files, see {@link FileNamePattern} for the default pathPattern.
	 */
	constructor(pathPattern: RegExp = FileNamePattern) {
		super();
		this.pathPattern = pathPattern;
	}

	public applies(file: PathLike): boolean {
		return this.pathPattern.test(platformBasename(file.toString()));
	}

	/**
	 * Processes the given file, assigning it the {@link FileRole.License} role.
	 */
	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrFileProvider {
		file.assignRole(FileRole.License);
		return file;
	}
}