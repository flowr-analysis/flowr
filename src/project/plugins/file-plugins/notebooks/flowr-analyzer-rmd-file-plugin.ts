import type { PathLike } from 'fs';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerFilePlugin } from '../flowr-analyzer-file-plugin';
import { FlowrRMarkdownFile } from './flowr-rmarkdown-file';


const RmdPattern = /\.rmd$/i;

/**
 * The Plugin provides support for R Markdown (.rmd) files
 */
export class FlowrAnalyzerRmdFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name =    'rmd-file-plugin';
	public readonly description = 'Parses R Markdown files';
	public readonly version = new SemVer('0.1.0');
	private readonly pattern: RegExp;

	constructor(filePattern: RegExp = RmdPattern) {
		super();
		this.pattern = filePattern;
	}

	public applies(file: PathLike): boolean {
		return this.pattern.test(file.toString());
	}

	protected process(_ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrRMarkdownFile {
		return new FlowrRMarkdownFile(arg);
	}
}