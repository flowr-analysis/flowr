import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { PathLike } from 'fs';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';

/**
 * This is the base class for all plugins that load and possibly transform files when they are loaded.
 * Different from other plugins, these plugins trigger for each file that is loaded (if they {@link applies} to the file).
 * See the {@link FlowrAnalyzer.addFile} for more information on how files are loaded and managed.
 *
 * It is up to the construction to ensure that no two file plugins {@link applies} to the same file, otherwise, the loading order
 * of these plugins will determine which plugin gets to process the file.
 * On transforming a file, your plugin can indicate whether other plugins should still get to process the file,
 * by returning a tuple of `[transformedFile, <boolean>]` where a boolean `true` indicates that other plugins should still get to process the file.
 * One example of a plugin doing this is the {@link FlowrAnalyzerMetaVignetteFilesPlugin}.
 *
 * See {@link DefaultFlowrAnalyzerFilePlugin} for the no-op default implementation.
 */
export abstract class FlowrAnalyzerFilePlugin extends FlowrAnalyzerPlugin<FlowrFileProvider, FlowrFileProvider | [file: FlowrFileProvider, cont: boolean]> {
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
	public readonly description = 'This is the default file plugin that does nothing (but assigning default .r/.R files).';
	public readonly version = new SemVer('0.0.0');

	public applies(): boolean {
		return true;
	}

	public process(_ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrFileProvider {
		const path = arg.path().toString();
		if(/\.r$/i.test(path)) {
			// we just assign the role :D
			arg.assignRole(FileRole.Source);
		}
		return arg;
	}
}