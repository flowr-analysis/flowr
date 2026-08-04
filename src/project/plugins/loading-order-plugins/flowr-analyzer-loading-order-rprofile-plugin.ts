import { SemVer } from 'semver';
import { FlowrAnalyzerLoadingOrderPlugin } from './flowr-analyzer-loading-order-plugin';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { RParseRequest } from '../../../r-bridge/retriever';
import { FileRole } from '../../context/flowr-file';

/** `Rprofile.site` is evaluated before the project's `.Rprofile`, mirroring R's startup sequence. */
function startupRank(path: string): number {
	return /Rprofile\.site$/i.test(path) ? 0 : 1;
}

/**
 * Moves the R startup profiles ({@link FileRole.Startup}, tagged by {@link FlowrAnalyzerRprofileFilePlugin})
 * to the front of the loading order, as R evaluates them before any project code.
 *
 * This refines the orders the other loading-order plugins produced, so register it after them.
 */
export class FlowrAnalyzerLoadingOrderRprofilePlugin extends FlowrAnalyzerLoadingOrderPlugin {
	public readonly name = 'flowr-analyzer-loading-order-rprofile-plugin';
	public readonly description = 'Loads the R startup profiles (.Rprofile, Rprofile.site) before any project code.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const startup = new Set(ctx.files.getFilesByRole(FileRole.Startup).map(f => f.path()));
		if(startup.size === 0) {
			return;
		}
		const requests = ctx.files.loadingOrder.getUnorderedRequests()
			.filter((r): r is RParseRequest & { request: 'file' } => r.request === 'file' && startup.has(r.content))
			.sort((a, b) => startupRank(a.content) - startupRank(b.content));
		ctx.files.loadingOrder.prependToOrder(requests);
	}
}
