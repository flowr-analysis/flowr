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
import type { FlowrDescriptionFile } from '../plugins/file-plugins/files/flowr-description-file';
import { log } from '../../util/log';
import fs from 'fs';
import path from 'path';
import type { FlowrNewsFile } from '../plugins/file-plugins/files/flowr-news-file';
import type { FlowrNamespaceFile } from '../plugins/file-plugins/files/flowr-namespace-file';
import type { FlowrRProjectFile } from '../plugins/file-plugins/files/flowr-rproject-file';
import { ProjectKind } from './project-kind';

const fileLog = log.getSubLogger({ name: 'flowr-analyzer-files-context' });

const notebookExtension = /\.(ipynb|rmd|qmd|rnw)$/;
const shinyDescriptionTypes = new Set(['shiny', 'shiny-app', 'shinyapp']);
/** the (lower-cased) file names a shiny app is assembled from; the app is `app.r`, or the `ui.r`+`server.r` pair */
const shinyEntryFiles = new Set(['app.r', 'ui.r', 'server.r', 'global.r']);
/**
 * Evidence that a file actually is part of a shiny app rather than just sharing a name: a load of the shiny stack
 * or a call to one of its entry points. Kept broad enough to also catch `bslib`/`shinydashboard`/`golem` apps.
 */
const shinyUsage = /(?:library|require|requireNamespace|loadNamespace)\s*\(\s*['"]?(?:shiny|bslib|shinydashboard|shinyMobile|golem|flexdashboard)\b|\b(?:shinyApp|shinyServer|shinyUI|runApp|fluidPage|fluidRow|navbarPage|bootstrapPage|fillPage|dashboardPage|page_fluid|page_sidebar|page_navbar|pageWithSidebar)\s*\(/;

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

export type RAnalysisRequest = RParseRequest | RProjectAnalysisRequest;

export type RoleBasedFiles = {
	[FileRole.Description]: FlowrDescriptionFile[];
	[FileRole.News]:        FlowrNewsFile[];
	[FileRole.Namespace]:   FlowrNamespaceFile[];
	[FileRole.Manifest]:    FlowrRProjectFile[];
	/* currently no special support */
	[FileRole.Vignette]:    FlowrFileProvider[];
	[FileRole.Test]:        FlowrFileProvider[];
	[FileRole.Install]:     FlowrFileProvider[];
	[FileRole.License]:     FlowrFileProvider[];
	[FileRole.VirtualEnv]:  FlowrFileProvider[];
	[FileRole.Source]:      FlowrFileProvider[];
	[FileRole.Data]:        FlowrFileProvider[];
	[FileRole.Other]:       FlowrFileProvider[];
};

function wrapFile(file: string | FlowrFileProvider | RParseRequestFromFile, roles?: readonly FileRole[]): FlowrFileProvider {
	if(typeof file === 'string') {
		return new FlowrTextFile(file, roles);
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

	/**
	 * Get all files known to this context.
	 * @returns An array of all files.
	 */
	getAllFiles(): FlowrFileProvider[];
	/**
	 * Get a file by its path.
	 * Checks both disk-backed files and inline files.
	 * However, this will not load new files that have not yet been requested by flowR.
	 * @param path - The exact path of the file.
	 * @returns The file if found, otherwise `undefined`.
	 */
	getFileByPath(path: string): FlowrFileProvider | undefined;
	/**
	 * Check if the context has a cached file with the given path.
	 * @param path - The path to the file.
	 */
	hasCached(path: string): boolean;
	/**
	 * Check if the context has a file with the given path.
	 * Please note, that this may also check the file system, depending on the configuration
	 * (see {@link FlowrConfig.project.resolveUnknownPathsOnDisk}).
	 * @param path - The path to the file.
	 *
	 * If you do not know the exact path or, e.g., casing of the file, use {@link exists} instead.
	 */
	hasFile(path: string): boolean;
	/**
	 * Check if a file exists at the given path, optionally ignoring case.
	 * @param path - The path to the file.
	 * @param ignoreCase - Whether to ignore case when checking for the file.
	 *
	 * Please note that this method checks the file system based on the configuration (see {@link FlowrConfig.project.resolveUnknownPathsOnDisk}).
	 * @returns The actual path of the file if it exists, otherwise `undefined`.
	 */
	exists(path: string, ignoreCase: boolean): string | undefined;
	/**
	 * Until parsers support multiple request types from the virtual context system,
	 * we resolve their contents.
	 */
	resolveRequest(r: RParseRequest): { r: RParseRequestFromText, path?: string };
	/**
	 * Get all files that have been considered during dataflow analysis.
	 */
	consideredFilesList(): readonly string[];
	/**
	 * Classify the {@link ProjectKind} of the project from its files. A {@link ProjectKind.ShinyApp | shiny app}
	 * is detected first, as apps commonly ship a `DESCRIPTION` too. The finer distinctions rely on the source
	 * files, which are only known once the dataflow ran; before that a non-package project reports
	 * {@link ProjectKind.Unknown}. The result is cached and invalidated whenever the files change.
	 */
	projectKind(): ProjectKind;
}

/**
 * This is the analyzer file context to be modified by all plugins that affect the files.
 * If you are interested in inspecting these files, refer to {@link ReadOnlyFlowrAnalyzerFilesContext}.
 * Plugins, however, can use this context directly to modify files.
 */
export class FlowrAnalyzerFilesContext extends AbstractFlowrAnalyzerContext<RProjectAnalysisRequest, (RParseRequest | FlowrFile<string>)[], FlowrAnalyzerProjectDiscoveryPlugin> implements ReadOnlyFlowrAnalyzerFilesContext {
	public readonly name = 'flowr-analyzer-files-context';

	public readonly loadingOrder:      FlowrAnalyzerLoadingOrderContext;
	/* all project files etc., this contains *all* (non-inline) files, loading orders etc. are to be handled by plugins */
	private files:                     Map<FilePath, FlowrFileProvider> = new Map<FilePath, FlowrFileProvider>();
	private inlineFiles:               FlowrFileProvider[] = [];
	private readonly fileLoaders:      readonly FlowrAnalyzerFilePlugin[];
	/** these are all the paths of files that have been considered by the dataflow graph (even if not added) */
	private readonly consideredFiles:  string[] = [];
	/** User-registered project discovery plugins; if non-empty, they replace the default. */
	private readonly discoveryPlugins: readonly FlowrAnalyzerProjectDiscoveryPlugin[];

	/* files that are part of the analysis, e.g. source files */
	private byRole:           RoleBasedFiles = Object.fromEntries<FlowrFileProvider[]>(Object.values(FileRole).map(k => [k, []])) as RoleBasedFiles;
	/** cached {@link projectKind}, invalidated whenever the files change (added or reset) */
	private projectKindCache: ProjectKind | undefined = undefined;

	constructor(
		loadingOrder: FlowrAnalyzerLoadingOrderContext,
		plugins: readonly FlowrAnalyzerProjectDiscoveryPlugin[],
		fileLoaders: readonly FlowrAnalyzerFilePlugin[]
	) {
		super(loadingOrder.getAttachedContext(), FlowrAnalyzerProjectDiscoveryPlugin.defaultPlugin(), []);
		this.discoveryPlugins = plugins;
		this.fileLoaders = [...fileLoaders, FlowrAnalyzerFilePlugin.defaultPlugin()];
		this.loadingOrder = loadingOrder;
	}

	public reset(): void {
		this.loadingOrder.reset();
		this.files = new Map<FilePath, FlowrFileProvider>();
		this.consideredFiles.length = 0;
		this.inlineFiles.length = 0;
		this.byRole = Object.fromEntries<FlowrFileProvider[]>(Object.values(FileRole).map(k => [k, []])) as RoleBasedFiles;
		this.projectKindCache = undefined;
	}

	/**
	 * Record that a file has been considered during dataflow analysis.
	 */
	public addConsideredFile(path: string): void {
		this.consideredFiles.push(path);
		this.projectKindCache = undefined;
	}

	/**
	 * Get all files that have been considered during dataflow analysis.
	 */
	public consideredFilesList(): readonly string[] {
		return this.consideredFiles;
	}

	public projectKind(): ProjectKind {
		return this.projectKindCache ??= this.classifyProject();
	}

	private classifyProject(): ProjectKind {
		const descriptions = this.getFilesByRole(FileRole.Description);
		// an explicit `Type: shiny` in the DESCRIPTION settles it without looking at any source
		if(descriptions.some(d => shinyDescriptionTypes.has(d.type() ?? ''))) {
			return ProjectKind.ShinyApp;
		}
		// the readable entry files by (lower-cased) name, plus every known file name for the coarser checks below
		const entries = new Map<string, FlowrFileProvider>();
		const names = new Set<string>();
		for(const f of this.getAllFiles()) {
			const name = path.basename(f.path()).toLowerCase();
			names.add(name);
			if(shinyEntryFiles.has(name)) {
				entries.set(name, f);
			}
		}
		const pending = this.loadingOrder.getUnorderedRequests()
			.filter(r => r.request === 'file').map(r => r.content);
		for(const p of [...pending, ...this.consideredFiles]) {
			const name = path.basename(p).toLowerCase();
			names.add(name);
			if(shinyEntryFiles.has(name) && !entries.has(name)) {
				entries.set(name, this.getFileByPath(p) ?? new FlowrTextFile(p));
			}
		}
		if(this.isShinyApp(names, entries)) {
			return ProjectKind.ShinyApp;
		}
		if(descriptions.length > 0) {
			return ProjectKind.Package;
		}
		if(names.size === 0) {
			return ProjectKind.Unknown;
		}
		for(const name of names) {
			if(notebookExtension.test(name)) {
				return ProjectKind.Notebook;
			}
		}
		let rSources = 0;
		for(const name of names) {
			if(name.endsWith('.r')) {
				rSources++;
			}
		}
		return rSources <= 1 ? ProjectKind.Script : ProjectKind.Project;
	}

	/**
	 * Whether the project is a shiny app: it has the canonical entry files (a single `app.R`, or the `ui.R`+`server.R`
	 * pair -- a lone `server.R` is not enough) and one of them actually loads or calls the shiny stack. The usage
	 * check keeps a coincidental `ui.R`/`server.R` pair from being mistaken for an app; only when none of the entry
	 * files can be read do we fall back to trusting the file names alone.
	 */
	private isShinyApp(names: ReadonlySet<string>, entries: ReadonlyMap<string, FlowrFileProvider>): boolean {
		if(!names.has('app.r') && !(names.has('ui.r') && names.has('server.r'))) {
			return false;
		}
		let couldRead = false;
		for(const f of entries.values()) {
			let content: string;
			try {
				content = f.content().toString();
			} catch{
				continue;
			}
			couldRead = true;
			if(shinyUsage.test(content)) {
				return true;
			}
		}
		return !couldRead;
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
	 * User-registered discovery plugins replace the built-in default; if none are registered, the default runs.
	 */
	private addRequest(request: RAnalysisRequest): void {
		if(request.request !== 'project') {
			this.loadingOrder.addRequest(request);
			this.projectKindCache = undefined;
			return;
		}

		const active = this.discoveryPlugins.length > 0
			? this.discoveryPlugins
			: [FlowrAnalyzerProjectDiscoveryPlugin.defaultPlugin()];
		const expandedRequests = active.flatMap(p => p.processor(this.ctx, request));
		for(const req of expandedRequests) {
			if(isParseRequest(req)) {
				this.addRequest(req);
			} else {
				this.addFile(req, req.roles);
			}
		}
	}

	/**
	 * Add multiple files to the context. This is just a convenience method that calls {@link addFile} for each file.
	 */
	public addFiles(files: (string | FlowrFileProvider | RParseRequestFromFile)[]): void {
		for(const file of files) {
			this.addFile(file);
		}
	}

	/**
	 * Add a file to the context. If the file has a special role, it will be added to the corresponding list of special files.
	 * This method also applies any registered {@link FlowrAnalyzerFilePlugin}s to the file before adding it to the context.
	 */
	public addFile(file: string | FlowrFileProvider | RParseRequestFromFile, roles?: readonly FileRole[]) {
		const f = this.fileLoadPlugins(wrapFile(file, roles));

		if(f.path() === FlowrFile.INLINE_PATH) {
			this.inlineFiles.push(f);
		} else {
			const exist = this.files.get(f.path());
			guard(exist === undefined || exist === f, `File ${f.path()} already added to the context.`);
			this.files.set(f.path(), f);
		}

		if(f.roles) {
			for(const r of f.roles) {
				this.byRole[r].push(f as never);
			}
		}

		this.projectKindCache = undefined;
		return f;
	}

	public hasCached(path: string): boolean {
		return this.files.has(path);
	}

	public hasFile(path: string): boolean {
		return this.hasCached(path) || (this.ctx.config.project.resolveUnknownPathsOnDisk && fs.existsSync(path));
	}

	public exists(p: string, ignoreCase: boolean): string | undefined {
		try {
			if(!ignoreCase) {
				return this.hasFile(p) ? p : undefined;
			}
			if(this.hasFile(p)) {
				return p;
			}
			// walk the directory and find the first match
			const dir = path.dirname(p);
			const dirLower = dir.toLowerCase();
			const file = path.basename(p).toLowerCase();
			// try to find in local known files first
			for(const f of this.files.keys()) {
				if(path.dirname(f).toLowerCase() !== dirLower) {
					continue;
				}
				const lf = path.basename(f).toLowerCase();
				if(file === lf) {
					return f;
				}
			}
			if(this.ctx.config.project.resolveUnknownPathsOnDisk) {
				let files: string[] | undefined;
				if(fs.existsSync(dir)) {
					files = fs.readdirSync(dir);
				} else {
					// try to find a dir in parent
					const parentDir = path.dirname(dir);
					if(fs.existsSync(parentDir)) {
						const parentFiles = fs.readdirSync(parentDir);
						const foundDir = parentFiles.find(f => f.toLowerCase() === path.basename(dir).toLowerCase());
						if(foundDir) {
							files = fs.readdirSync(path.join(parentDir, foundDir));
						}
					}
				}
				const found = files?.find(f => f.toLowerCase() === file);
				return found ? path.join(dir, found) : undefined;
			}
			return undefined;
		} catch{
			return undefined;
		}
	}

	private fileLoadPlugins(f: FlowrFileProvider) {
		let fFinal: FlowrFileProvider = f;
		for(const loader of this.fileLoaders) {
			if(loader.applies(f.path())) {
				fileLog.debug(`Applying file loader ${loader.name} to file ${f.path()}`);
				const res = loader.processor(this.ctx, fFinal);
				if(Array.isArray(res)) {
					fFinal = res[0];
					if(!res[1]) {
						break;
					}
				} else {
					fFinal = res;
					break;
				}
			}
		}
		return fFinal;
	}

	public resolveRequest(r: RParseRequest): { r: RParseRequestFromText, path?: string } {
		if(r.request === 'text') {
			return { r };
		}

		const file = this.files.get(r.content);
		if(file === undefined && this.ctx.config.project.resolveUnknownPathsOnDisk) {
			fileLog.debug(`File ${r.content} not found in context, trying to load from disk.`);
			if(fs.existsSync(r.content)) {

				const loadedFile = this.addFile(new FlowrTextFile(r.content));

				return {
					r: {
						request: 'text',
						content: loadedFile.content().toString(),
					},
					path: loadedFile.path()
				};
			}
		}
		guard(file !== undefined && file !== null, `File ${r.content} not found in context.`);

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

	public getAllFiles(): FlowrFileProvider[] {
		return [...this.files.values(), ...this.inlineFiles];
	}

	public getFileByPath(path: string): FlowrFileProvider | undefined {
		return this.files.get(path) ?? this.inlineFiles.find(f => f.path() === path);
	}
}
