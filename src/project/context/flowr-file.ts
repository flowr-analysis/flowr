import type { PathLike } from 'fs';
import fs from 'fs';
import { guard } from '../../util/assert';

/**
 * Just a readable alias for file paths, mostly for documentation purposes.
 * We separate {@link PathLike} types from string paths that are used for project paths.
 */
export type FilePath = string;

/**
 * Some files have a special meaning in R projects, e.g., the `DESCRIPTION` file in R packages.
 * This list may be extended in the future and reflects files that the {@link FlowrAnalyzer} can do something interesting with.
 * If you add an interesting file that is only part of your plugin infrastructure, please use the `other` role.
 */
export enum FileRole {
	/** The `DESCRIPTION` file in R packages, this is the only currently supported special file. */
	Description = 'description',
	/** The `NAMESPACE` file in R packages, currently not specially supported. */
	Namespace   = 'namespace',
	/** Data files, e.g., `R/sysdata.rda`, currently not specially supported. */
	Data        = 'data',
	/**
	 * Catch-all for any file that provides usable R source code to incorporate into the analysis.
	 * Please note, that the loading order/inclusion and even potential relevance of these source files
	 * is determined by the loading order plugins (cf. {@link PluginType.LoadingOrder})
	 * in the {@link FlowrAnalyzerLoadingOrderContext}.
	 */
	Source      = 'source',
	/** Other special files that are not specifically supported by flowR but may be interesting for some analyses. */
	Other       = 'other'
}

/**
 * This is the basic interface for all files known to the FlowrAnalyzer.
 * You can implement this interface to provide custom file loading mechanisms.
 * Mostly, we will be interested in text files (or decorations thereof).
 * If you want to load other file types, you either have to transform them into a presentation supported by flowR
 * or add your own file loader plugin (similar to the {@link FlowrAnalyzerDescriptionFilePlugin}).
 *
 * See {@link FlowrFile} for a basic single-cache implementation and {@link FlowrTextFile} for a text-file specific implementation.
 * If you want to pass in inline text files, see {@link FlowrInlineTextFile}.
 * @typeParam Content - The type of the content returned by the `content()` method.
 */
export interface FlowrFileProvider<Content = unknown> {
	/**
	 * The role of this file, if any, in general your file should _not_ decide for itself what role it has in the project context,
	 * this is for the loaders plugins to decide (cf. {@link PluginType}) as they can, e.g., respect ignore files, updated mappings, etc.
	 * However, they will 1) set this role as soon as they decide on it (using {@link assignRole}) and 2) try to respect an already assigned role (however, user configurations may override this).
	 */
    role?: FileRole;

	/**
	 * The path to the file, this is used for identification and logging purposes.
	 * If the file does not exist on disk, this can be a virtual path (e.g. for inline files).
	 * Even though this is a getter, please make sure that the operation is cheap and deterministic (some decorators may overwrite the path, e.g., because they support other protocols).
	 */
    path(): PathLike;

	/**
	 * The content of the file, this may be cached by the implementation and does not have to be expensive.
	 * You can used stream based implementations but right now there is no external, project-wide expressions of life cycles for files.
	 * So make sure your implementation closes the resource as soon as possible.
	 */
    content(): Content;

	/**
	 * Assign a role to this file, this should be done by the loader plugins (cf. {@link PluginType}).
	 * **Do not call this method yourself unless you are a file-loader plugin and/or really know what you are doing, this may break plugin assumptions!**
	 */
    assignRole(role: FileRole): void;
}

/**
 * A basic implementation of the {@link FlowrFileProvider} interface that caches the content after the first load (i.e., updates on disk are ignored).
 *
 * See {@link FlowrTextFile} for a text-file specific implementation and {@link FlowrInlineTextFile} for inline text files.
 */
export abstract class FlowrFile<Content = unknown> implements FlowrFileProvider<Content> {
	private contentCache:  Content | undefined;
	protected filePath:    PathLike;
	public readonly role?: FileRole;

	public constructor(filePath: PathLike, role?: FileRole) {
		this.filePath = filePath;
		this.role     = role;
	}

	public path(): PathLike {
		return this.filePath;
	}

	public content(): Content {
		if(this.contentCache === undefined) {
			this.contentCache = this.loadContent();
		}
		return this.contentCache;
	}

	protected abstract loadContent(): Content;

	public assignRole(role: FileRole): void {
		guard(this.role === undefined || this.role === role, `File ${this.filePath.toString()} already has a role assigned: ${this.role}`);
		(this as { role?: FileRole }).role = role;
	}
}

/**
 * A basic implementation of the {@link FlowrFileProvider} interface for text files that caches the content after the first load (i.e., updates on disk are ignored).
 */
export class FlowrTextFile extends FlowrFile<string> {
	protected loadContent(): string {
		return fs.readFileSync(this.filePath, 'utf8');
	}
}

/**
 * A basic implementation of the {@link FlowrFileProvider} interface for (constant) inline text files.
 * This is also useful for "special" files like the `DESCRIPTION` file in R packages that you want to pass in directly.
 * These will be handled by the {@link FlowrAnalyzerDescriptionFilePlugin} (e.g., by using the {@link FlowrDescriptionFile#from} method decorator).
 */
export class FlowrInlineTextFile extends FlowrFile<string> {
	private readonly contentStr: string;

	constructor(path: PathLike, content: string) {
		super(path);
		this.contentStr = content;
	}

	protected loadContent(): string {
		return this.contentStr;
	}
}
