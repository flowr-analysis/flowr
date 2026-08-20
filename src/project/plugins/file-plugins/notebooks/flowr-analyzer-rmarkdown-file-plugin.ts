import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrAnalyzerPatternFilePlugin } from '../flowr-analyzer-file-plugin';
import { FlowrRMarkdownFile } from '../files/flowr-rmarkdown-file';

/**
 * Common base of the plugins reading an R Markdown flavor, which differ only in the files they claim.
 */
export abstract class FlowrAnalyzerRMarkdownFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly version = new SemVer('0.1.0');

	protected process(ctx: FlowrAnalyzerContext, arg: FlowrFileProvider<string>): FlowrRMarkdownFile {
		return FlowrRMarkdownFile.from(arg, ctx);
	}
}
