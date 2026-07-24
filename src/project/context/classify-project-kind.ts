import { ProjectKind } from './project-kind';

/** default DESCRIPTION `Type:` values marking a shiny app */
const shinyDescriptionTypes = new Set(['shiny', 'shiny-app', 'shinyapp']);
/** default (lower-cased) file names a shiny app is assembled from */
const shinyEntryFiles = new Set(['app.r', 'ui.r', 'server.r', 'global.r']);
/** default evidence that a file is part of a shiny app (a load of the shiny stack or a call to one of its entry points) */
const shinyUsage = /(?:library|require|requireNamespace|loadNamespace)\s*\(\s*['"]?(?:shiny|bslib|shinydashboard|shinyMobile|golem|flexdashboard)\b|\b(?:shinyApp|shinyServer|shinyUI|runApp|fluidPage|fluidRow|navbarPage|bootstrapPage|fillPage|dashboardPage|page_fluid|page_sidebar|page_navbar|pageWithSidebar)\s*\(/;
/** default extensions marking a notebook / literate document */
const notebookExtension = /\.(ipynb|rmd|qmd|rnw)$/;

/** Lazily read a shiny-entry file's content; returns `undefined` when it cannot be read. */
export type ContentReader = () => string | undefined;

/** The evidence {@link classifyProjectKind} works from. */
export interface ProjectKindSignals {
	/** lower-cased basenames of every file known so far */
	readonly names:            ReadonlySet<string>;
	/** shiny-entry basename to a reader for its content */
	readonly entries:          ReadonlyMap<string, ContentReader>;
	/** the lower-cased `Type:` of each known `DESCRIPTION` (`''` when absent) */
	readonly descriptionTypes: readonly string[];
	/** how many `DESCRIPTION` files are known */
	readonly descriptionCount: number;
}

/** The configurable classification inputs, from `project.classification`. */
export interface ClassificationConfig {
	readonly shinyDescriptionTypes?: readonly string[];
	readonly shinyEntryFiles?:       readonly string[];
	readonly shinyUsagePattern?:     string;
	readonly notebookExtensions?:    readonly string[];
}

/** {@link ClassificationConfig} resolved to matchers, falling back to the built-in defaults. */
export interface ResolvedClassifyOptions {
	readonly shinyDescriptionTypes: ReadonlySet<string>;
	readonly shinyEntryFiles:       ReadonlySet<string>;
	readonly shinyUsage:            RegExp;
	readonly notebookExtension:     RegExp;
}

/** Resolve {@link ClassificationConfig} into {@link ResolvedClassifyOptions}, using the built-in defaults for unset fields. */
export function resolveClassifyOptions(cfg?: ClassificationConfig): ResolvedClassifyOptions {
	return {
		shinyDescriptionTypes: cfg?.shinyDescriptionTypes ? new Set(cfg.shinyDescriptionTypes.map(s => s.toLowerCase())) : shinyDescriptionTypes,
		shinyEntryFiles:       cfg?.shinyEntryFiles ? new Set(cfg.shinyEntryFiles.map(s => s.toLowerCase())) : shinyEntryFiles,
		shinyUsage:            cfg?.shinyUsagePattern ? new RegExp(cfg.shinyUsagePattern) : shinyUsage,
		notebookExtension:     cfg?.notebookExtensions ? new RegExp(`\\.(${cfg.notebookExtensions.join('|')})$`, 'i') : notebookExtension
	};
}

const defaultClassifyOptions = resolveClassifyOptions();

/**
 * Whether the project is a shiny app: it has the canonical entry files (a single `app.R`, or the `ui.R`+`server.R`
 * pair) and one of them uses the shiny stack. When no entry file can be read we trust the file names alone.
 */
export function isShinyAppSignals(names: ReadonlySet<string>, entries: ReadonlyMap<string, ContentReader>, shinyUsagePattern: RegExp = shinyUsage): boolean {
	if(!names.has('app.r') && !(names.has('ui.r') && names.has('server.r'))) {
		return false;
	}
	let couldRead = false;
	for(const read of entries.values()) {
		const content = read();
		if(content === undefined) {
			continue;
		}
		couldRead = true;
		if(shinyUsagePattern.test(content)) {
			return true;
		}
	}
	return !couldRead;
}

/**
 * Classify the {@link ProjectKind} from the given {@link ProjectKindSignals}. Shiny apps are detected first (they
 * often ship a `DESCRIPTION` too), then packages, then notebooks; the rest is a single-file `Script` or a `Project`.
 */
export function classifyProjectKind(signals: ProjectKindSignals, opts: ResolvedClassifyOptions = defaultClassifyOptions): ProjectKind {
	if(signals.descriptionTypes.some(t => opts.shinyDescriptionTypes.has(t))) {
		return ProjectKind.ShinyApp;
	}
	if(isShinyAppSignals(signals.names, signals.entries, opts.shinyUsage)) {
		return ProjectKind.ShinyApp;
	}
	if(signals.descriptionCount > 0) {
		return ProjectKind.Package;
	}
	if(signals.names.size === 0) {
		return ProjectKind.Unknown;
	}
	for(const name of signals.names) {
		if(opts.notebookExtension.test(name)) {
			return ProjectKind.Notebook;
		}
	}
	let rSources = 0;
	for(const name of signals.names) {
		if(name.endsWith('.r')) {
			rSources++;
		}
	}
	return rSources <= 1 ? ProjectKind.Script : ProjectKind.Project;
}
