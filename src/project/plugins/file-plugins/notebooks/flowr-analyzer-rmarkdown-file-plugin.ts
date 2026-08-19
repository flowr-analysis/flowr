import type { PathLike } from 'fs';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerFilePlugin } from '../flowr-analyzer-file-plugin';
import { FlowrRMarkdownFile } from '../files/flowr-rmarkdown-file';
import { platformBasename } from '../../../../dataflow/internal/process/functions/call/built-in/built-in-source';

/**
 * Common base of the plugins reading an R Markdown flavor, which differ only in the files they claim.
 */
export abstract class FlowrAnalyzerRMarkdownFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly version = new SemVer('0.1.0');
	private readonly pattern: RegExp;

	protected constructor(filePattern: RegExp) {
		super();
		this.pattern = filePattern;
	}

	public applies(file: PathLike): boolean {
		return this.pattern.test(platformBasename(file.toString()));
	}

	protected process(ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrRMarkdownFile {
		return FlowrRMarkdownFile.from(arg, ctx);
	}
}
