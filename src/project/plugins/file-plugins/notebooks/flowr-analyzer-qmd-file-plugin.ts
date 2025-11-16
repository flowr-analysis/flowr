import type { PathLike } from 'fs';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerFilePlugin } from '../flowr-analyzer-file-plugin';
import { FlowrRMarkdownFile } from './flowr-rmarkdown-file';
import { platformBasename } from '../../../../dataflow/internal/process/functions/call/built-in/built-in-source';

const QmdPattern = /\.qmd$/i;

/**
 * The Plugin provides support for Quarto R Markdown (.qmd) files
 */
export class FlowrAnalyzerQmdFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name =    'qmd-file-plugin';
	public readonly description = 'Parses Quarto R Markdown files';
	public readonly version = new SemVer('0.1.0');
	private readonly pattern: RegExp;

	constructor(filePattern: RegExp = QmdPattern) {
		super();
		this.pattern = filePattern;
	}

	public applies(file: PathLike): boolean {
		return this.pattern.test(platformBasename(file.toString()));
	}

	protected process(_ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrRMarkdownFile {
		return new FlowrRMarkdownFile(arg);
	}
}