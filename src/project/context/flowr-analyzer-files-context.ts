import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type {
	RParseRequestFromText,
	RParseRequest,
	RParseRequestFromFile } from '../../r-bridge/retriever';
import { isParseRequest } from '../../r-bridge/retriever';
import { guard } from '../../util/assert';
import type {
	FlowrAnalyzerLoadingOrderContext,
	ReadOnlyFlowrAnalyzerLoadingOrderContext
} from './flowr-analyzer-loading-order-context';
import {
	FlowrAnalyzerProjectDiscoveryPlugin
} from '../plugins/project-discovery/flowr-analyzer-project-discovery-plugin';
import { FlowrAnalyzerFilePlugin } from '../plugins/file-plugins/flowr-analyzer-file-plugin';
import { type FilePath, FlowrFile, type FlowrFileProvider, FlowrTextFile, FileRole } from './flowr-file';
import type { FlowrDescriptionFile } from '../plugins/file-plugins/flowr-description-file';
import { log } from '../../util/log';
import fs from 'fs';

const fileLog = log.getSubLogger({ name: 'flowr-analyzer-files-context' });

/**
 * This is a request to process a folder as a project, which will be expanded by the registered {@link FlowrAnalyzerProjectDiscoveryPlugin}s.
 */
export interface RProjectAnalysisRequest {
    readonly request: 'project';
    /**
     * The path to the root folder (an absolute path is probably best here).
     */
    readonly content: string;
}

// TODO: also support a quick add-flowr-file which directly accests the FlowrFileProvider interface and adsigns the role based on plugins
// TODO: option to toggle that the files context auto loads from disk
export type RAnalysisRequest = RParseRequest | RProjectAnalysisRequest

export type RoleBasedFiles = {
    [FileRole.Description]: FlowrDescriptionFile[];
    /* currently no special support */
    [FileRole.Namespace]:   FlowrFileProvider[];
    [FileRole.Source]:      FlowrFileProvider[];
    [FileRole.Data]:        FlowrFileProvider[];
    [FileRole.Other]:       FlowrFileProvider[];
}

function obtainFileAndPath(file: string | FlowrFileProvider<string> | RParseRequestFromFile, role?: FileRole): FlowrFileProvider<string> {
	if(typeof file === 'string') {
		return new FlowrTextFile(file, role);
	} else if('request' in file) {
		return FlowrFile.fromRequest(file);
	} else {
		return file;
	}
}

/**
 * This is the read-only interface for the files context, which is used to manage all files known to the {@link FlowrAnalyzer}.
 * It prevents you from modifying the available files, but allows you to inspect them (which is probably what you want when using the {@link FlowrAnalyzer}).
 * If you are a {@link FlowrAnalyzerProjectDiscoveryPlugin} and want to modify the available files, you can use the {@link FlowrAnalyzerFilesContext} directly.
 */
export interface ReadOnlyFlowrAnalyzerFilesContext {
	/**
	 * The name of this context.
	 */
	readonly name:         string;
	/**
	 * The loading order context provides access to the loading order of script files in the project.
	 */
	readonly loadingOrder: ReadOnlyFlowrAnalyzerLoadingOrderContext;
	/**
	 * Get all requests that have been added to this context.
	 * @example If you want to obtain all description files, use
	 * ```ts
	 * getFilesByRole(SpecialFileRole.Description)
	 * ```
	 */
	getFilesByRole<Role extends FileRole>(role: Role): RoleBasedFiles[Role];
}

/**
 * This is the analyzer file context to be modified by all plugins that affect the files.
 * If you are interested in inspecting these files, refer to {@link ReadOnlyFlowrAnalyzerFilesContext}.
 * Plugins, however, can use this context directly to modify files.
 */
export class FlowrAnalyzerFilesContext extends AbstractFlowrAnalyzerContext<RProjectAnalysisRequest, (RParseRequest | FlowrFile<string>)[], FlowrAnalyzerProjectDiscoveryPlugin> implements ReadOnlyFlowrAnalyzerFilesContext {
	public readonly name = 'flowr-analyzer-files-context';

	public readonly loadingOrder: FlowrAnalyzerLoadingOrderContext;
	/* all project files etc., this contains *all* (non-inline) files, loading orders etc. are to be handled by plugins */
	private files:                Map<FilePath, FlowrFileProvider> = new Map<FilePath, FlowrFileProvider>();
	private inlineFiles:          FlowrFileProvider[] = [];
	private readonly fileLoaders: readonly FlowrAnalyzerFilePlugin[];
	/* files that are part of the analysis, e.g. source files */
	private byRole:        RoleBasedFiles = {
		[FileRole.Description]: [],
		[FileRole.Namespace]:   [],
		[FileRole.Source]:      [],
		[FileRole.Data]:        [],
		[FileRole.Other]:       []
	} satisfies Record<FileRole, FlowrFileProvider[]>;

	constructor(
		loadingOrder: FlowrAnalyzerLoadingOrderContext,
		plugins: readonly FlowrAnalyzerProjectDiscoveryPlugin[],
		fileLoaders: readonly FlowrAnalyzerFilePlugin[]
	) {
		super(loadingOrder.getAttachedContext(), FlowrAnalyzerProjectDiscoveryPlugin.defaultPlugin(), plugins);
		this.fileLoaders = [...fileLoaders, FlowrAnalyzerFilePlugin.defaultPlugin()];
		this.loadingOrder = loadingOrder;
	}

	public reset(): void {
		this.loadingOrder.reset();
		this.files = new Map<FilePath, FlowrFileProvider>();
	}

	/**
	 * Add multiple requests to the context. This is just a convenience method that calls {@link addRequest} for each request.
	 */
	public addRequests(requests: readonly RAnalysisRequest[]): void {
		for(const request of requests) {
			this.addRequest(request);
		}
	}

	/**
	 * Add a request to the context. If the request is of type `project`, it will be expanded using the registered {@link FlowrAnalyzerProjectDiscoveryPlugin}s.
	 */
	private addRequest(request: RAnalysisRequest): void {
		if(request.request !== 'project') {
			this.loadingOrder.addRequest(request);
			if(request.request === 'file') {
				this.files.set(request.content, new FlowrTextFile(request.content));
			}
			return;
		}

		const expandedRequests = this.applyPlugins(request).flat();
		for(const req of expandedRequests) {
			if(isParseRequest(req)) {
				this.addRequest(req);
			} else {
				this.addFile(req, req.role);
			}
		}
	}

	/**
	 * Add multiple files to the context. This is just a convenience method that calls {@link addFile} for each file.
	 */
	public addFiles(...files: (string | FlowrFileProvider<string> | RParseRequestFromFile)[]): void {
		for(const file of files) {
			this.addFile(file);
		}
	}

	/**
	 * Add a file to the context. If the file has a special role, it will be added to the corresponding list of special files.
	 * This method also applies any registered {@link FlowrAnalyzerFilePlugin}s to the file before adding it to the context.
	 */
	public addFile(file: string | FlowrFileProvider<string> | RParseRequestFromFile, role?: FileRole): void {
		const f = this.fileLoadPlugins(obtainFileAndPath(file, role));

		if(f.path() === FlowrFile.INLINE_PATH) {
			this.inlineFiles.push(f);
		} else {
			const exist = this.files.get(f.path());
			guard(exist === undefined || exist === f, `File ${f.path()} already added to the context.`);
			this.files.set(f.path(), f);
		}

		if(f.role) {
			this.byRole[f.role].push(f as typeof this.byRole[FileRole.Description][number]);
		}
	}

	private fileLoadPlugins(f: FlowrFileProvider<string>) {
		let fFinal: FlowrFileProvider = f;
		for(const loader of this.fileLoaders) {
			if(loader.applies(f.path())) {
				fileLog.debug(`Applying file loader ${loader.name} to file ${f.path()}`);
				fFinal = loader.processor(this.ctx, f);
				break;
			}
		}
		return fFinal;
	}

	/**
	 * Until parsers support multiple request types from the virtual context system,
	 * we resolve their contents.
	 */
	public resolveRequest(r: RParseRequest): { r: RParseRequestFromText, path?: string } {
		if(r.request === 'text') {
			return { r };
		}

		const file = this.files.get(r.content);
		// TODO: load from disk fallback (flowR context)
		if(file === undefined && this.ctx.config.project.resolveUnknownPathsOnDisk) {
			fileLog.debug(`File ${r.content} not found in context, trying to load from disk.`);
			if(fs.existsSync(r.content)) {
				const loadedFile = new FlowrTextFile(r.content);
				this.addFile(loadedFile);
				return {
					r: {
						request: 'text',
						content: loadedFile.content(),
					},
				};
			}
		}
		guard(file !== undefined && file !== null, `File ${r.content} not found in context.`);

		// TODO: check R source

		const content = file.content();
		return {
			r: {
				request: 'text',
				content: typeof content === 'string' ? content : '',
			},
			path: file.path()
		};
	}

	/**
	 * Get all requests that have been added to this context.
	 * This is a convenience method that calls {@link FlowrAnalyzerLoadingOrderContext.getLoadingOrder}.
	 */
	public computeLoadingOrder(): readonly RParseRequest[] {
		return this.loadingOrder.getLoadingOrder();
	}

	public getFilesByRole<Role extends FileRole>(role: Role): RoleBasedFiles[Role] {
		return this.byRole[role];
	}
}