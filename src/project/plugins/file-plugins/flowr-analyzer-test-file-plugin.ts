import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import {
	platformDirname
} from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';

const TestPathPattern = /tests?/i;

/**
 * This plugin provides supports the loading for Test files.
 * If you use multiple plugins, this should be included *before* other plugins.
 */
export class FlowrAnalyzerMetaTestFilesPlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-test-files-plugin';
	public readonly description = 'This plugin provides support for loading test files.';
	public readonly version = new SemVer('0.1.0');
	private readonly pathPattern: RegExp;

	/**
	 * Creates a new instance of the NAMESPACE file plugin.
	 * @param pathPattern - The pathPattern to identify NAMESPACE files, see {@link TestPathPattern} for the default pathPattern.
	 */
	constructor(pathPattern: RegExp = TestPathPattern) {
		super();
		this.pathPattern = pathPattern;
	}

	public applies(file: PathLike): boolean {
		return this.pathPattern.test(platformDirname(file.toString()));
	}

	/**
	 * Processes the given file, assigning it the {@link FileRole.Vignette} role.
	 * Given that the file may still need to be processed by other plugins, this method returns the `true` flag for that purpose.
	 */
	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): [FlowrFileProvider, true] {
		file.assignRole(FileRole.Test);
		return [file, true];
	}
}