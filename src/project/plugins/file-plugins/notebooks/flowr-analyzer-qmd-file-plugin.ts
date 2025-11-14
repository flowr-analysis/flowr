import type { PathLike } from 'fs';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerFilePlugin } from '../flowr-analyzer-file-plugin';
import { FlowrRMarkdownFile } from './flowr-rmarkdown-file';


const QmdPattern = /\.qmd$/i;

/**
 * The Plugin provides support for Quarto R Markdown (.qmd) files
 */
export class FlowrAnalyzerRmdFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name =    'qmd-file-plugin';
	public readonly description = 'Parses Quarto R Markdown files';
	public readonly version = new SemVer('0.1.0');

	public applies(file: PathLike): boolean {
		return QmdPattern.test(file.toString());
	}

	protected process(analyzer: FlowrAnalyzerContext, args: FlowrFileProvider<string>): FlowrRMarkdownFile {
		return new FlowrRMarkdownFile(args);
	}
}