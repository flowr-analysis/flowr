import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { RParseRequest, RParseRequestFromFile } from '../../r-bridge/retriever';
import type { PathLike } from 'fs';
import fs from 'fs';
import { guard } from '../../util/assert';
import type { FlowrAnalyzerLoadingOrderContext } from './flowr-analyzer-loading-order-context';

type FilePath = string;

export interface FlowrFileProvider {
    role?: SpecialFileRole;
    path(): PathLike;
    content(): string;
    readLines(cb: (line: string) => void): void
}

export class FlowrFile implements FlowrFileProvider {
	private contentCache:  string | undefined;
	protected filePath:    PathLike;
	public readonly role?: SpecialFileRole;

	public constructor(filePath: PathLike, role?: SpecialFileRole) {
		this.filePath = filePath;
		this.role     = role;
	}

	public path(): PathLike {
		return this.filePath;
	}

	public content(): string {
		if(this.contentCache === undefined) {
			this.contentCache = fs.readFileSync(this.filePath, 'utf8');
		}
		return this.contentCache;
	}

	public readLines(cb: (line: string) => void): void {
		/* smarter implementations can use the readline module, but for now this is sufficient */
		const content = this.content();
		const lines = content.split(/\r?\n/);
		for(const line of lines) {
			cb(line);
		}
	}

	assignRole(role: SpecialFileRole): void {
		guard(this.role === undefined || this.role === role, `File ${this.filePath.toString()} already has a role assigned: ${this.role}`);
		(this as { role?: SpecialFileRole }).role = role;
	}

}

export enum SpecialFileRole {
    Description = 'description',
    Namespace   = 'namespace',
    Data        = 'data',
    Other       = 'other'
}



export interface RProjectAnalysisRequest {
    readonly request: 'project';
    /**
     * The path to the root folder (an absolute path is probably best here).
     */
    readonly content: string;
}

export type RAnalysisRequest = RParseRequest | RProjectAnalysisRequest


/**
 * This is the analyzer file context to be modified by all plugins that affect the files
 */
export class FlowrAnalyzerFilesContext extends AbstractFlowrAnalyzerContext {
	public readonly name = 'flowr-analyzer-files-context';

	private loadingOrder: FlowrAnalyzerLoadingOrderContext;
	/* all project files etc, this contains *all* files, loading orders etc. are to be handled by plugins */
	private files:        Map<FilePath, FlowrFileProvider | RParseRequestFromFile> = new Map<FilePath, FlowrFileProvider | RParseRequestFromFile>();
	/* files that are part of the analysis, e.g. source files */
	private specialFiles: Map<SpecialFileRole, FlowrFileProvider[]> = new Map<SpecialFileRole, FlowrFileProvider[]>();

	// TODO: file discovery plugins
	constructor(loadingOrder: FlowrAnalyzerLoadingOrderContext) {
		super();
		this.loadingOrder = loadingOrder;
	}


	public addRequests(requests: readonly RAnalysisRequest[]): void {
		for(const request of requests) {
			this.addRequest(request);
		}
	}


	public addRequest(request: RAnalysisRequest): void {
		this.loadingOrder.addRequest(request);
		if(request.request === 'file') {
			this.files.set(request.content, request);
		}
	}

	private addSpecialFile(file: FlowrFileProvider, role: SpecialFileRole): void {
		if(!this.specialFiles.has(role)) {
			this.specialFiles.set(role, []);
		}
		this.specialFiles.get(role)?.push(file);
	}

	public addFile(file: string | FlowrFileProvider | RParseRequestFromFile, role?: SpecialFileRole): void {
		let f: FlowrFileProvider | RParseRequestFromFile;
		let p: FilePath;
		if(typeof file === 'string') {
			f = new FlowrFile(file, role);
			p = file;
		} else if('request' in file) {
			f = file;
			p = file.content;
		} else {
			f = file;
			p = file.path().toString();
		}

		const exist = this.files.get(p);
		guard(exist === undefined || exist === f, `File ${p} already added to the context.`);
		this.files.set(p, f);
		if(role !== undefined) {
			guard(!('request' in f), `Cannot assign role to RParseRequestFromFile: ${p}`);
			this.addSpecialFile(f, role);
		}
	}


	public calculateLoadingOrder(): readonly RParseRequest[] {
		return this.loadingOrder.getLoadingOrder();
	}
}