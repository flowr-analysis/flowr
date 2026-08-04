import { SemVer } from 'semver';
import { FlowrAnalyzerLoadingOrderPlugin } from './flowr-analyzer-loading-order-plugin';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { RParseRequest } from '../../../r-bridge/retriever';
import { FlowrRMarkdownFile } from '../file-plugins/files/flowr-rmarkdown-file';

/**
 * Drops the files an R Markdown document splices into itself ({@link FlowrRMarkdownFile#includedFiles})
 * from the loading order, as the including document already carries their content.
 *
 * This refines the orders the other loading-order plugins produced, so register it after them.
 */
export class FlowrAnalyzerLoadingOrderIncludedFilesPlugin extends FlowrAnalyzerLoadingOrderPlugin {
	public readonly name = 'flowr-analyzer-loading-order-included-files-plugin';
	public readonly description = 'Drops files that another document includes from the loading order.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const files = ctx.files.loadingOrder.getUnorderedRequests()
			.filter((r): r is RParseRequest & { request: 'file' } => r.request === 'file');
		const included = new Set<string>();
		for(const request of files) {
			const file = ctx.files.resolveFile(request.content);
			if(file instanceof FlowrRMarkdownFile) {
				for(const path of file.includedFiles) {
					included.add(path);
				}
			}
		}
		ctx.files.loadingOrder.removeFromOrder(files.filter(r => included.has(r.content)));
	}
}
