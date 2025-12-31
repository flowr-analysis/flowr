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

// TODO: mark that other laoders should still apply, ensure role stays, support multiple roles
// TODO: likewise a test loader
/**
 * This plugin provides supports the loading for Vignette files.
 * If you use multiple meta plugins, this should be included *before* other plugins.
 */
export class FlowrAnalyzerMetaVignetteFilesPlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-vignette-files-plugin';
	public readonly description = 'This plugin provides support for loading vignette files.';
	public readonly version = new SemVer('0.1.0');
	private readonly pathPattern: RegExp;

	/**
	 * Creates a new instance of the NAMESPACE file plugin.
	 * @param pathPattern - The pathPattern to identify NAMESPACE files, see {@link VignettePathPattern} for the default pathPattern.
	 */
	constructor(pathPattern: RegExp = VignettePathPattern) {
		super();
		this.pathPattern = pathPattern;
	}

	public applies(file: PathLike): boolean {
		return this.pathPattern.test(platformDirname(file.toString()));
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrFileProvider {
		// TODO: do we have to trigger other loads?
		file.assignRole(FileRole.Vignette);
		return file;
	}
}