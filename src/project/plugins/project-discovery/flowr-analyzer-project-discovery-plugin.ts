import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { RParseRequest } from '../../../r-bridge/retriever';
import type { RProjectAnalysisRequest } from '../../context/flowr-analyzer-files-context';
import { SemVer } from 'semver';
import { type FlowrFile, FlowrTextFile } from '../../context/flowr-file';
import { getAllFilesSync } from '../../../util/files';
import { platformDirname } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import path from 'path';

/**
 * This is the base class for all plugins that discover files in a project for analysis.
 * These plugins interplay with the {@link FlowrAnalyzerFilesContext} to gather information about the files in the project.
 * See {@link DefaultFlowrAnalyzerProjectDiscoveryPlugin} for the dummy default implementation.
 *
 * In general, these plugins only trigger for a {@link RProjectAnalysisRequest} with the idea to discover all files in a project.
 */
export abstract class FlowrAnalyzerProjectDiscoveryPlugin extends FlowrAnalyzerPlugin<RProjectAnalysisRequest, (RParseRequest | FlowrFile<string>)[]> {
	public readonly type = PluginType.ProjectDiscovery;

	public static override defaultPlugin(): FlowrAnalyzerProjectDiscoveryPlugin {
		return new DefaultFlowrAnalyzerProjectDiscoveryPlugin();
	}
}

const discoverRSourcesRegex = /\.(r|rmd|ipynb|qmd)$/i;
const ignorePathsWith = /(\.git|\.svn|\.hg|renv|packrat|node_modules|__pycache__|\.Rproj\.user)/i;
const excludeRequestsForPaths = /vignettes?|tests?|revdep|inst|data/i;

/** Configuration options for the {@link DefaultFlowrAnalyzerProjectDiscoveryPlugin}. */
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
 * This is the default dummy implementation of the {@link FlowrAnalyzerProjectDiscoveryPlugin}.
 * It simply collects all files in the given folder and returns them as either {@link RParseRequest} (for R and Rmd files) or {@link FlowrTextFile} (for all other files).
 */
class DefaultFlowrAnalyzerProjectDiscoveryPlugin extends FlowrAnalyzerProjectDiscoveryPlugin {
	public readonly name = 'default-project-discovery-plugin';
	public readonly description = 'This is the default project discovery plugin that does nothing.';
	public readonly version = new SemVer('0.0.0');
	private readonly supportedExtensions: RegExp;
	private readonly ignorePathsRegex:    RegExp;
	private readonly excludePathsRegex:   RegExp = excludeRequestsForPaths;
	private readonly onlyTraversePaths:   RegExp | undefined;

	/**
	 * Creates a new instance of the default project discovery plugin.
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

	public process(_context: unknown, args: RProjectAnalysisRequest): (RParseRequest | FlowrFile<string>)[] {
		const requests: (RParseRequest | FlowrFile<string>)[] = [];
		/* the dummy approach of collecting all files, group R and Rmd files, and be done with it */
		for(const file of getAllFilesSync(args.content, /.*/, this.ignorePathsRegex)) {
			console.log(`Discovered file: ${file}`);
			const relativePath = path.relative(args.content, file);
			if(this.supportedExtensions.test(relativePath) && (!this.onlyTraversePaths || this.onlyTraversePaths.test(relativePath)) && !this.excludePathsRegex.test(platformDirname(relativePath))) {
				requests.push({ content: file, request: 'file' });
			} else {
				requests.push(new FlowrTextFile(file));
			}
		}
		return requests;
	}
}