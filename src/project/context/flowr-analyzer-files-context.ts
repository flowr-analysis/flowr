import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { RParseRequest, RParseRequestFromFile } from '../../r-bridge/retriever';
import { isParseRequest } from '../../r-bridge/retriever';
import { guard } from '../../util/assert';
import type { FlowrAnalyzerLoadingOrderContext } from './flowr-analyzer-loading-order-context';
import {
	FlowrAnalyzerProjectDiscoveryPlugin
} from '../plugins/project-discovery/flowr-analyzer-project-discovery-plugin';
import { FlowrAnalyzerFilePlugin } from '../plugins/file-plugins/flowr-analyzer-file-plugin';
import type { FilePath, FlowrFile, FlowrFileProvider } from './flowr-file';
import {  FlowrTextFile , SpecialFileRole } from './flowr-file';
import type { FlowrDescriptionFile } from '../plugins/file-plugins/flowr-description-file';
import { log } from '../../util/log';

const fileLog = log.getSubLogger({ name: 'flowr-analyzer-files-context' });

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
 * This is the analyzer file context to be modified by all plugins that affect the files
 */
export class FlowrAnalyzerFilesContext extends AbstractFlowrAnalyzerContext<RProjectAnalysisRequest, (RParseRequest | FlowrFile<string>)[], FlowrAnalyzerProjectDiscoveryPlugin> {
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

	public addRequests(requests: readonly RAnalysisRequest[]): void {
		for(const request of requests) {
			this.addRequest(request);
		}
	}

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

	public addFiles(...files: (string | FlowrFileProvider<string> | RParseRequestFromFile)[]): void {
		for(const file of files) {
			this.addFile(file);
		}
	}

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

	public computeLoadingOrder(): readonly RParseRequest[] {
		return this.loadingOrder.getLoadingOrder();
	}

	public getFilesByRole<Role extends SpecialFileRole>(role: Role): SpecialFiles[Role] {
		return this.specialFiles[role];
	}
}