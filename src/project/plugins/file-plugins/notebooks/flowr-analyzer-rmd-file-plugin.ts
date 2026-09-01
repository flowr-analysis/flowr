import { FlowrAnalyzerRMarkdownFilePlugin } from './flowr-analyzer-rmarkdown-file-plugin';

/* `.Rmarkdown` is the knitr-only variant used by blogdown and quarto */
export const RmdPattern = /\.(rmd|rmarkdown)$/i;

/**
 * The plugin provides support for R Markdown (`.rmd`) files
 */
export class FlowrAnalyzerRmdFilePlugin extends FlowrAnalyzerRMarkdownFilePlugin {
	public readonly name =    'rmd-file-plugin';
	public readonly description = 'Parses R Markdown files';

	/**
	 * Creates a new instance of the R Markdown file plugin.
	 * @param filePattern - The pattern to identify R Markdown files, see {@link RmdPattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = RmdPattern) {
		super(filePattern);
	}
}
