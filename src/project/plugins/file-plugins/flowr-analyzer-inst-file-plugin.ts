import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import {
	platformDirname
} from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';

const InstPathPattern = /(^|\/)inst(\/|$)/;

/**
 * This plugin provides supports for the identification of installed files (files below an `inst/` folder).
 * If you use multiple plugins, this should be included *before* other plugins.
 */
export class FlowrAnalyzerMetaInstFilesPlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-inst-files-plugin';
	public readonly description = 'Loads installed files.';
	public readonly version = new SemVer('0.1.0');
	private readonly pathPattern: RegExp;

	/**
	 * Creates a new instance of the INST file plugin.
	 * @param pathPattern - The pathPattern to identify INST files, see {@link InstPathPattern} for the default pathPattern.
	 */
	constructor(pathPattern: RegExp = InstPathPattern) {
		super();
		this.pathPattern = pathPattern;
	}

	public applies(file: PathLike): boolean {
		return this.pathPattern.test(platformDirname(file.toString()));
	}

	/**
	 * Processes the given file, assigning it the {@link FileRole.Install} role.
	 * Given that the file may still need to be processed by other plugins, this method returns the `true` flag for that purpose.
	 */
	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): [FlowrFileProvider, true] {
		file.assignRole(FileRole.Install);
		return [file, true];
	}
}
