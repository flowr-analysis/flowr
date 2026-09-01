import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { PathLike } from 'fs';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { platformBasename, platformDirname } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';

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
	public readonly description = 'Assigns the default .r/.R files, nothing else.';
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
/** Which part of a path a {@link FlowrAnalyzerPatternFilePlugin} matches its pattern against. */
export const PathPart = {
	/** The file name including its extension. */
	Basename: platformBasename,
	/** The directory portion of the path. */
	Dirname:  platformDirname,
	/** The whole path, for patterns that need both the folder and the file name. */
	Full:     (p: string) => p
} as const;

/**
 * Base class for all file plugins that select their files by a regular expression on the file path.
 * Subclasses only have to provide their metadata and {@link FlowrAnalyzerPlugin.process|process}.
 */
export abstract class FlowrAnalyzerPatternFilePlugin extends FlowrAnalyzerFilePlugin {
	protected readonly pattern: RegExp;
	private readonly part:      (p: string) => string;

	/**
	 * @param pattern - The pattern to identify the files of this plugin, see the respective subclass for its default.
	 * @param part    - The part of the path the pattern is matched against.
	 */
	constructor(pattern: RegExp, part: (p: string) => string = PathPart.Basename) {
		super();
		this.pattern = pattern;
		this.part = part;
	}

	public applies(file: PathLike): boolean {
		return this.pattern.test(this.part(file.toString()));
	}
}

/**
 * Base class for file plugins that do nothing but tag their files with a set of {@link FileRole|FileRoles}.
 * As the file may still need to be processed by other plugins, these plugins always continue the loader chain.
 */
export abstract class FlowrAnalyzerRoleFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	protected abstract readonly roles: readonly FileRole[];

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): [FlowrFileProvider, true] {
		for(const role of this.roles) {
			file.assignRole(role);
		}
		return [file, true];
	}
}
