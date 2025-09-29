import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { RParseRequest, RParseRequestFromFile } from '../../r-bridge/retriever';
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
import type { FilePath, FlowrFile, FlowrFileProvider } from './flowr-file';
import { FlowrTextFile, SpecialFileRole } from './flowr-file';
import type { FlowrDescriptionFile } from '../plugins/file-plugins/flowr-description-file';
import { log } from '../../util/log';

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

export type RAnalysisRequest = RParseRequest | RProjectAnalysisRequest

export type SpecialFiles = {
    [SpecialFileRole.Description]: FlowrDescriptionFile[];
    /* currently no special support */
    [SpecialFileRole.Namespace]:   FlowrFileProvider[];
    [SpecialFileRole.Data]:        FlowrFileProvider[];
    [SpecialFileRole.Other]:       FlowrFileProvider[];
}

function obtainFileAndPath(file: string | FlowrFileProvider<string> | RParseRequestFromFile, role?: SpecialFileRole): { f: FlowrFileProvider<string> | RParseRequestFromFile, p: string } {
	let f: FlowrFileProvider<string> | RParseRequestFromFile;
	let p: FilePath;
	if(typeof file === 'string') {
		f = new FlowrTextFile(file, role);
		p = file;
	} else if('request' in file) {
		f = file;
		p = file.content;
	} else {
		f = file;
		p = file.path().toString();
	}
	return { f, p };
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
	 *
	 * @example If you want to obtain all description files, use
	 * ```ts
	 * getFilesByRole(SpecialFileRole.Description)
	 * ```
	 */
	getFilesByRole<Role extends SpecialFileRole>(role: Role): SpecialFiles[Role];
}

/**
 * This is the analyzer file context to be modified by all plugins that affect the files.
 * If you are interested in inspecting these files, refer to {@link ReadOnlyFlowrAnalyzerFilesContext}.
 * Plugins, however, can use this context directly to modify files.
 */
export class FlowrAnalyzerFilesContext extends AbstractFlowrAnalyzerContext<RProjectAnalysisRequest, (RParseRequest | FlowrFile<string>)[], FlowrAnalyzerProjectDiscoveryPlugin> implements ReadOnlyFlowrAnalyzerFilesContext {
	public readonly name = 'flowr-analyzer-files-context';

	public readonly loadingOrder: FlowrAnalyzerLoadingOrderContext;
	/* all project files etc., this contains *all* files, loading orders etc. are to be handled by plugins */
	private files:                Map<FilePath, FlowrFileProvider | RParseRequestFromFile> = new Map<FilePath, FlowrFileProvider | RParseRequestFromFile>();
	private readonly fileLoaders: readonly FlowrAnalyzerFilePlugin[];
	/* files that are part of the analysis, e.g. source files */
	private specialFiles:        SpecialFiles = {
		[SpecialFileRole.Description]: [],
		[SpecialFileRole.Namespace]:   [],
		[SpecialFileRole.Data]:        [],
		[SpecialFileRole.Other]:       []
	} satisfies Record<SpecialFileRole, FlowrFileProvider[]>;

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
		this.files = new Map<FilePath, FlowrFileProvider | RParseRequestFromFile>();
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
	public addRequest(request: RAnalysisRequest): void {
		if(request.request !== 'project') {
			this.loadingOrder.addRequest(request);
			if(request.request === 'file') {
				this.files.set(request.content, request);
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
	public addFile(file: string | FlowrFileProvider<string> | RParseRequestFromFile, role?: SpecialFileRole): void {
		const { f, p } = obtainFileAndPath(file, role);
		const { f: fA, p: pA } = this.fileLoadPlugins(f, p);

		const exist = this.files.get(pA);
		guard(exist === undefined || exist === fA, `File ${pA} already added to the context.`);
		this.files.set(pA, fA);

		if(!isParseRequest(fA) && fA.role) {
			this.specialFiles[fA.role].push(fA as typeof this.specialFiles[SpecialFileRole.Description][number]);
		}
	}


	private fileLoadPlugins(f: FlowrFileProvider<string> | RParseRequestFromFile, p: string) {
		let fFinal: FlowrFileProvider | RParseRequestFromFile = f;
		let pFinal: string = p;
		if(!isParseRequest(f)) { // we have to change the types when we integrate the adapters
			for(const loader of this.fileLoaders) {
				if(loader.applies(p)) {
					fileLog.debug(`Applying file loader ${loader.name} to file ${p}`);
					fFinal = loader.processor(this.ctx, f);
					pFinal = f.path().toString();
					break;
				}
			}
		}
		return { f: fFinal, p: pFinal };
	}

	/**
	 * Get all requests that have been added to this context.
	 * This is a convenience method that calls {@link FlowrAnalyzerLoadingOrderContext.getLoadingOrder}.
	 */
	public computeLoadingOrder(): readonly RParseRequest[] {
		return this.loadingOrder.getLoadingOrder();
	}

	public getFilesByRole<Role extends SpecialFileRole>(role: Role): SpecialFiles[Role] {
		return this.specialFiles[role];
	}
}