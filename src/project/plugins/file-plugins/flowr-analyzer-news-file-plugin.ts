import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';
import { platformBasename } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { FlowrNewsFile } from './files/flowr-news-file';

const NewsFilePattern = /^NEWS(\.(rd|md))?$/i;

/**
 * This plugin provides support for R `NEWS` files.
 * @see https://rdrr.io/r/utils/news.html
 */
export class FlowrAnalyzerNewsFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-news-file-plugin';
	public readonly description = 'This plugin provides support for NEWS files and extracts their content into version chunks.';
	public readonly version = new SemVer('0.1.0');
	private readonly pattern: RegExp;

	/**
	 * Creates a new instance of the NEWS file plugin.
	 * @param filePattern - The pattern to identify NEWS files, see {@link NewsFilePattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = NewsFilePattern) {
		super();
		this.pattern = filePattern;
	}

	public applies(file: PathLike): boolean {
		return this.pattern.test(platformBasename(file.toString()));
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrNewsFile {
		return FlowrNewsFile.from(file, FileRole.News);
	}
}