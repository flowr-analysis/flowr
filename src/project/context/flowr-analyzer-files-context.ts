import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { RParseRequest, RParseRequestFromFile } from '../../r-bridge/retriever';
import type { PathLike } from 'fs';
import fs from 'fs';
import { assertUnreachable, guard } from '../../util/assert';
import type { FlowrAnalyzerLoadingOrderContext } from './flowr-analyzer-loading-order-context';
import type {
	FlowrAnalyzerProjectDiscoveryPlugin
} from '../plugins/project-discovery/flowr-analyzer-project-discovery-plugin';
import { FlowrDescriptionFile } from '../plugins/file-plugins/flowr-analyzer-description-file-plugin';
import type { FlowrAnalyzerFilePlugin } from '../plugins/file-plugins/flowr-analyzer-file-plugin';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';

type FilePath = string;

export interface FlowrFileProvider<Content = unknown> {
    role?: SpecialFileRole;
    path(): PathLike;
    content(): Content;
}

export abstract class FlowrFile<Content = unknown> implements FlowrFileProvider {
	private contentCache:  Content | undefined;
	protected filePath:    PathLike;
	public readonly role?: SpecialFileRole;

	public constructor(filePath: PathLike, role?: SpecialFileRole) {
		this.filePath = filePath;
		this.role     = role;
	}

	public path(): PathLike {
		return this.filePath;
	}

	public content(): Content {
		if(this.contentCache === undefined) {
			this.contentCache = this.loadContent(); // fs.readFileSync(this.filePath, 'utf8');
		}
		return this.contentCache;
	}

    protected abstract loadContent(): Content;

    assignRole(role: SpecialFileRole): void {
    	guard(this.role === undefined || this.role === role, `File ${this.filePath.toString()} already has a role assigned: ${this.role}`);
    	(this as { role?: SpecialFileRole }).role = role;
    }
}

export class FlowrTextFile extends FlowrFile<string> {
	protected loadContent(): string {
		return fs.readFileSync(this.filePath, 'utf8');
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

export type SpecialFiles = {
    [SpecialFileRole.Description]: FlowrDescriptionFile[];
    /* currently no special support */
    [SpecialFileRole.Namespace]:   FlowrFileProvider[];
    [SpecialFileRole.Data]:        FlowrFileProvider[];
    [SpecialFileRole.Other]:       FlowrFileProvider[];
}

// TODO: type of project (library vs. user code etc.)
/**
 * This is the analyzer file context to be modified by all plugins that affect the files
 */
export class FlowrAnalyzerFilesContext extends AbstractFlowrAnalyzerContext<RProjectAnalysisRequest, RParseRequest[], FlowrAnalyzerProjectDiscoveryPlugin> {
	public readonly name = 'flowr-analyzer-files-context';

	public readonly loadingOrder: FlowrAnalyzerLoadingOrderContext;
	/* all project files etc, this contains *all* files, loading orders etc. are to be handled by plugins */
	private files:                Map<FilePath, FlowrFileProvider | RParseRequestFromFile> = new Map<FilePath, FlowrFileProvider | RParseRequestFromFile>();
	private fileLoaders:          readonly FlowrAnalyzerFilePlugin[] = [/* TODO */];
	/* files that are part of the analysis, e.g. source files */
	private specialFiles:        SpecialFiles = {
		[SpecialFileRole.Description]: [],
		[SpecialFileRole.Namespace]:   [],
		[SpecialFileRole.Data]:        [],
		[SpecialFileRole.Other]:       []
	};

	// TODO: file load plugins
	constructor(ctx: FlowrAnalyzerContext, loadingOrder: FlowrAnalyzerLoadingOrderContext, plugins: readonly FlowrAnalyzerProjectDiscoveryPlugin[]) {
		super(ctx, plugins);
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
		// TODO: decided by the plugins, this should not be fixed from the outside, this should ask the plugins whether they apply and aplly based on this
		switch(role) {
			case SpecialFileRole.Description:
				this.specialFiles[role].push(FlowrDescriptionFile.from(file));
				break;
			case SpecialFileRole.Namespace:
			case SpecialFileRole.Data:
			case SpecialFileRole.Other:
				this.specialFiles[role].push(file);
				break;
			default:
				assertUnreachable(role);
		}
	}

	public addFile(file: string | FlowrFileProvider | RParseRequestFromFile, role?: SpecialFileRole): void {
		let f: FlowrFileProvider | RParseRequestFromFile;
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

	public getFilesByRole<Role extends SpecialFileRole>(role: Role): SpecialFiles[Role] {
		return this.specialFiles[role];
	}
}