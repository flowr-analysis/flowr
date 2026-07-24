import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { RParseRequest } from '../../../r-bridge/retriever';
import type { RProjectAnalysisRequest } from '../../context/flowr-analyzer-files-context';
import { SemVer } from 'semver';
import { type FlowrFile, FlowrTextFile } from '../../context/flowr-file';
import { getAllFilesSync } from '../../../util/files';
import { platformBasename, platformDirname } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import fs from 'fs';
import path from 'path';
import { classifyProjectKind, resolveClassifyOptions, type ContentReader } from '../../context/classify-project-kind';
import { globMatcher } from '../../../util/glob';
import { RprofileFilePattern, RenvironFilePattern } from '../file-plugins/flowr-analyzer-rprofile-file-plugin';

/**
 * This is the base class for all plugins that discover files in a project for analysis.
 * These plugins interplay with the {@link FlowrAnalyzerFilesContext} to gather information about the files in the project.
 * See {@link FlowrAnalyzerDefaultProjectDiscoveryPlugin} for the default implementation.
 *
 * In general, these plugins only trigger for a {@link RProjectAnalysisRequest} with the idea to discover all files in a project.
 */
export abstract class FlowrAnalyzerProjectDiscoveryPlugin extends FlowrAnalyzerPlugin<RProjectAnalysisRequest, (RParseRequest | FlowrFile<string>)[]> {
	public readonly type = PluginType.ProjectDiscovery;

	public static override defaultPlugin(): FlowrAnalyzerProjectDiscoveryPlugin {
		return new FlowrAnalyzerDefaultProjectDiscoveryPlugin();
	}
}

// `.Rprofile`/`Rprofile.site` carry no extension but are plain R sources
export const discoverRSourcesRegex = /(\.(r|rmd|ipynb|qmd|rnw)|(^|[\\/])\.?Rprofile(\.site)?)$/i;
// matched against the posix path relative to the project root
export const ignorePathsWith = /(^|\/)(\.git|\.svn|\.hg|node_modules|__pycache__|\.Rproj\.user|Rtmp[^/]*|(packrat|renv|rv)\/(lib|library|src|staging|sandbox|bundles)[^/]*)(\/|$)/i;
export const excludeRequestsForPaths = /vignettes?|tests?|revdep|inst|data/i;

/** Options for {@link collectRequests}; unset fields fall back to the module defaults. */
export interface CollectRequestOptions {
	/** the regex marking a path as an R source to parse (default {@link discoverRSourcesRegex}) */
	readonly supportedExtensions?: RegExp;
	/** directories whose R sources are collected as text rather than parsed (default {@link excludeRequestsForPaths}) */
	readonly excludePathsRegex?:   RegExp;
	/** if set, only paths matching this regex are parsed as R */
	readonly onlyTraversePaths?:   RegExp;
}

/**
 * Turn the walked `files` (absolute paths under `root`) into the discovery result: R sources become
 * {@link RParseRequest}s, everything else -- and R sources under an excluded directory -- becomes a
 * {@link FlowrTextFile}; `.Rprofile` files get both so they are tagged. This is the single emit implementation
 * shared by the greedy and the intelligent discovery plugins.
 */
export function collectRequests(files: Iterable<string>, root: string, opts: CollectRequestOptions = {}): (RParseRequest | FlowrFile<string>)[] {
	const supportedExtensions = opts.supportedExtensions ?? discoverRSourcesRegex;
	const excludePathsRegex = opts.excludePathsRegex ?? excludeRequestsForPaths;
	const onlyTraversePaths = opts.onlyTraversePaths;
	const requests: (RParseRequest | FlowrFile<string>)[] = [];
	for(const file of files) {
		const relativePath = path.relative(root, file);
		if(supportedExtensions.test(relativePath) && (!onlyTraversePaths || onlyTraversePaths.test(relativePath)) && !excludePathsRegex.test(platformDirname(relativePath))) {
			requests.push({ content: file, request: 'file' });
			if(RprofileFilePattern.test(platformBasename(relativePath))) {
				// parse requests skip the file plugins, so emit a file too to have the profile tagged
				requests.push(new FlowrTextFile(file));
			}
		} else {
			requests.push(new FlowrTextFile(file));
		}
	}
	return requests;
}

/** Configuration options for the {@link FlowrAnalyzerFullProjectDiscoveryPlugin}. */
export interface ProjectDiscoveryConfig {
	/** the regex to trigger R source file discovery on (and hence analyze them as R files) */
	triggerOnExtensions?: RegExp;
	/** the regex to ignore certain paths entirely */
	ignorePathsRegex?:    RegExp;
	/** the regex to exclude certain paths from being requested as R files (they are still collected as text files) */
	excludePathsRegex?:   RegExp;
	/** if set, only paths matching this regex are traversed */
	onlyTraversePaths?:   RegExp;
}

/**
 * The greedy discovery implementation: every file below the root becomes a {@link RParseRequest} (R and Rmd files)
 * or a {@link FlowrTextFile} (the rest). This is what {@link FlowrAnalyzerDefaultProjectDiscoveryPlugin} falls back
 * to in `full` mode.
 */
export class FlowrAnalyzerFullProjectDiscoveryPlugin extends FlowrAnalyzerProjectDiscoveryPlugin {
	public readonly name = 'full-project-discovery-plugin';
	public readonly description = 'Collects every file below the project root (greedy discovery).';
	public readonly version = new SemVer('0.0.0');
	private readonly supportedExtensions: RegExp;
	private readonly ignorePathsRegex:    RegExp;
	private readonly excludePathsRegex:   RegExp = excludeRequestsForPaths;
	private readonly onlyTraversePaths:   RegExp | undefined;

	/**
	 * Creates a new instance of the greedy project discovery plugin.
	 * @param triggerOnExtensions - the regex to trigger R source file discovery on (and hence analyze them as R files)
	 * @param ignorePathsRegex    - the regex to ignore certain paths entirely
	 * @param excludePathsRegex   - the regex to exclude certain paths from being requested as R files (they are still collected as text files)
	 * @param onlyTraversePaths   - if set, only paths matching this regex are traversed
	 */
	constructor({ triggerOnExtensions = discoverRSourcesRegex, ignorePathsRegex = ignorePathsWith, excludePathsRegex = excludeRequestsForPaths, onlyTraversePaths }: ProjectDiscoveryConfig = {}) {
		super();
		this.supportedExtensions = triggerOnExtensions;
		this.ignorePathsRegex = ignorePathsRegex;
		this.excludePathsRegex = excludePathsRegex;
		this.onlyTraversePaths = onlyTraversePaths;
	}

	public process(context: FlowrAnalyzerContext, args: RProjectAnalysisRequest): (RParseRequest | FlowrFile<string>)[] {
		if(!fs.existsSync(args.content)) {
			return [];
		}
		const failOnInaccessiblePath = context.config.project.failOnInaccessiblePath ?? false;
		return collectRequests(
			getAllFilesSync(args.content, /.*/, this.ignorePathsRegex, args.content, failOnInaccessiblePath),
			args.content,
			{ supportedExtensions: this.supportedExtensions, excludePathsRegex: this.excludePathsRegex, onlyTraversePaths: this.onlyTraversePaths }
		);
	}
}

// noise directories pruned from the scoped walk on top of `ignorePathsWith`: build output, checks, rendered docs and packaged data
const noiseDirs = /(^|\/)(\.git|\.svn|\.hg|node_modules|__pycache__|\.Rproj\.user|[^/]*\.Rcheck|(packrat|renv|rv)\/(lib|library|src|staging|sandbox|bundles|cache)[^/]*|build|dist|_build|_site|_book|\.quarto|\.cache|Rtmp[^/]*|man|inst\/(extdata|doc))(\/|$)/i;
// binary/data blobs, dropped even inside an otherwise kept directory
const noiseFiles = /\.(rds|rda|rdata|rd|png|jpe?g|gif|svg|pdf|ico|zip|tar|t?gz|bz2|xz|so|o|a|dll|dylib|exe|jar|woff2?|ttf|eot|feather|parquet|xls[xm]?|docx?|pptx?)$/i;
const descriptionFilePattern = /^DESCRIPTION(\.(txt|in))?$/i;
// metadata the analysis still needs when scoped (mirrors the file-role plugin patterns; local to avoid a cycle)
const metadataFilePatterns = [
	descriptionFilePattern,
	/^NAMESPACE(\.txt)?$/i,
	/^NEWS(\.(rd|md))?$/i,
	/^(renv|rv|packrat)\.lock$/i,
	/^rproject\.toml$/i,
	/license(\.md|\.txt)?$/i,
	RprofileFilePattern,
	RenvironFilePattern
];
const testOrVignetteDir = /(^|\/)(tests?|vignettes?)(\/|$)/i;

interface KeepRules { readonly include: readonly ((p: string) => boolean)[]; readonly exclude: readonly ((p: string) => boolean)[] }

/** compile the `project.discovery.perKind` include/exclude globs into matchers */
function resolveRules(override: { include?: string[], exclude?: string[] } | undefined): KeepRules {
	return {
		include: (override?.include ?? []).map(globMatcher),
		exclude: (override?.exclude ?? []).map(globMatcher)
	};
}

/** over-approximating default: R sources, role metadata and `tests/`/`vignettes/` count as project files */
function keptByDefault(rel: string): boolean {
	const base = path.basename(rel);
	return discoverRSourcesRegex.test(rel) || metadataFilePatterns.some(p => p.test(base)) || testOrVignetteDir.test(rel);
}

/** whether root-relative `rel` is kept; an explicit `ignore` or `perKind` exclude wins over everything */
function keep(rel: string, rules: KeepRules, ignore: readonly ((p: string) => boolean)[]): boolean {
	if(noiseFiles.test(rel) || ignore.some(m => m(rel)) || rules.exclude.some(m => m(rel))) {
		return false;
	}
	return keptByDefault(rel) || rules.include.some(m => m(rel));
}

/** the lower-cased `DESCRIPTION` `Type:` field, read without the full DCF parser to avoid a cycle */
function descriptionType(file: string): string {
	let content: string;
	try {
		content = fs.readFileSync(file, 'utf8');
	} catch{
		return '';
	}
	const m = /^Type:[ \t]*(.+)$/im.exec(content.replace(/^\uFEFF/, ''));
	return (m?.[1] ?? '').trim().toLowerCase();
}

/**
 * flowR's default discovery: walk the project once (pruning noise directories), classify the {@link ProjectKind}
 * from what the walk sees, then keep only the files that kind needs. `project.discovery.full` restores the greedy
 * {@link FlowrAnalyzerFullProjectDiscoveryPlugin}, `project.discovery.perKind` overrides the kept set per kind.
 */
export class FlowrAnalyzerDefaultProjectDiscoveryPlugin extends FlowrAnalyzerProjectDiscoveryPlugin {
	public readonly name = 'default-project-discovery-plugin';
	public readonly description = 'Detects the project kind and discovers only the files it needs (unless project.discovery.full).';
	public readonly version = new SemVer('1.0.0');

	public process(context: FlowrAnalyzerContext, args: RProjectAnalysisRequest): (RParseRequest | FlowrFile<string>)[] {
		if(!fs.existsSync(args.content)) {
			return [];
		}
		const root = args.content;
		const failOn = context.config.project.failOnInaccessiblePath ?? false;
		const discovery = context.config.project.discovery;
		if(discovery?.full) {
			return collectRequests(getAllFilesSync(root, /.*/, ignorePathsWith, root, failOn), root);
		}
		const opts = resolveClassifyOptions(context.config.project.classification);
		// one walk gathers the candidate files and the classification signals, so the kind is known the moment it ends
		const files: string[] = [];
		const names = new Set<string>();
		const entries = new Map<string, ContentReader>();
		const descriptionTypes: string[] = [];
		let descriptionCount = 0;
		for(const file of getAllFilesSync(root, /.*/, noiseDirs, root, failOn)) {
			files.push(file);
			const base = path.basename(file);
			const lower = base.toLowerCase();
			names.add(lower);
			if(opts.shinyEntryFiles.has(lower) && !entries.has(lower)) {
				entries.set(lower, () => {
					try {
						return fs.readFileSync(file, 'utf8');
					} catch{
						return undefined;
					}
				});
			}
			if(descriptionFilePattern.test(base)) {
				descriptionCount++;
				descriptionTypes.push(descriptionType(file));
			}
		}
		const kind = classifyProjectKind({ names, entries, descriptionTypes, descriptionCount }, opts);
		const rules = resolveRules(discovery?.perKind?.[kind]);
		const ignore = (discovery?.ignore ?? []).map(globMatcher);
		return collectRequests(files.filter(f => keep(path.relative(root, f), rules, ignore)), root);
	}
}