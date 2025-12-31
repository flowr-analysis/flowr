import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import {
	platformDirname
} from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';

const VignettePathPattern = /vignettes?/i;

/**
 * This plugin provides supports for the loading of Vignette files.
 * If you use multiple plugins, this should be included *before* other plugins.
 */
export class FlowrAnalyzerMetaVignetteFilesPlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-vignette-files-plugin';
	public readonly description = 'This plugin provides support for loading vignette files.';
	public readonly version = new SemVer('0.1.0');
	private readonly pathPattern: RegExp;

	/**
	 * Creates a new instance of the VIGNETTE file plugin.
	 * @param pathPattern - The pathPattern to identify VIGNETTE files, see {@link VignettePathPattern} for the default pathPattern.
	 */
	constructor(pathPattern: RegExp = VignettePathPattern) {
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
		file.assignRole(FileRole.Vignette);
		return [file, true];
	}
}