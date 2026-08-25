import { FlowrAnalyzerRMarkdownFilePlugin } from './flowr-analyzer-rmarkdown-file-plugin';

const QmdPattern = /\.qmd$/i;

/**
 * The plugin provides support for Quarto R Markdown (`.qmd`) files
 */
export class FlowrAnalyzerQmdFilePlugin extends FlowrAnalyzerRMarkdownFilePlugin {
	public readonly name =    'qmd-file-plugin';
	public readonly description = 'Parses Quarto R Markdown files';

	/**
	 * Creates a new instance of the Quarto R Markdown file plugin.
	 * @param filePattern - The pattern to identify Quarto R Markdown files, see {@link QmdPattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = QmdPattern) {
		super(filePattern);
	}
}
