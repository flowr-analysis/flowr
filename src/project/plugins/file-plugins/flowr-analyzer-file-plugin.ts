import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { PathLike } from 'fs';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';

/**
 * This is the base class for all plugins that load and possibly transform files when they are loaded.
 * Different from other plugins, these plugins trigger for each file that is loaded (if they {@link applies} to the file).
 * See the {@link FlowrAnalyzerFilesContext.addFile} for more information on how files are loaded and managed.
 *
 * It is upt to the construction to ensure that no two file plugins {@link applies} to the same file, otherwise, the loading order
 * of these plugins will determine which plugin gets to process the file.
 *
 * See {@link DefaultFlowrAnalyzerFilePlugin} for the no-op default implementation.
 */
export abstract class FlowrAnalyzerFilePlugin extends FlowrAnalyzerPlugin<FlowrFileProvider<string>, FlowrFileProvider> {
	public readonly type = PluginType.FileLoad;

	/**
	 * Determine whether this plugin applies to the given file.
	 */
	public abstract applies(file: PathLike): boolean;

	public static override defaultPlugin(): FlowrAnalyzerFilePlugin {
		return new DefaultFlowrAnalyzerFilePlugin();
	}
}

class DefaultFlowrAnalyzerFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'default-file-plugin';
	public readonly description = 'This is the default file plugin that does nothing.';
	public readonly version = new SemVer('0.0.0');

	public applies(): boolean {
		return true;
	}

	public process(_context: FlowrAnalyzerContext, args: FlowrFileProvider<string>): FlowrFileProvider {
		return args;
	}
}