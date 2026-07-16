import { SemVer } from 'semver';
import { FlowrAnalyzerLoadingOrderPlugin } from './flowr-analyzer-loading-order-plugin';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { RParseRequest } from '../../../r-bridge/retriever';
import { FlowrConfig } from '../../../config';
import { log } from '../../../util/log';
import { globMatcher } from '../../../util/glob';

export const implicitSourcesLog = log.getSubLogger({ name: 'loading-order-implicit-sources' });

function isImplicit(request: RParseRequest, matches: (filePath: string) => boolean): boolean {
	return request.request === 'file' && matches(request.content);
}

/**
 * Orders the files given by `project.implicitSources` (directly, or per kind via `specializeConfig`; a direct list wins).
 * Files that are no implicit sources stay in front, as the implicit entry points consume them.
 */
export class FlowrAnalyzerLoadingOrderImplicitSourcesPlugin extends FlowrAnalyzerLoadingOrderPlugin {
	public readonly name = 'flowr-analyzer-loading-order-implicit-sources-plugin';
	public readonly description = 'Orders the files a framework loads implicitly, as configured by project.implicitSources.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const kind = ctx.projectKind();
		const implicit = ctx.config.project.implicitSources
			?? FlowrConfig.forKind(ctx.config, kind).project.implicitSources;
		if(!implicit || implicit.length === 0) {
			return;
		}
		const patterns = implicit.map(globMatcher);
		const unordered = ctx.files.loadingOrder.getUnorderedRequests();
		/* the files each entry matches, in project order; an entry matching none is a typo or names a foreign file */
		const matches = patterns.map(p => unordered.filter(r => isImplicit(r, p)));
		const unmatched = implicit.filter((_, i) => matches[i].length === 0);
		if(unmatched.length > 0) {
			implicitSourcesLog.warn(`No file of the ${kind} project matches the implicit source(s) ${unmatched.map(u => `'${u}'`).join(', ')}, ignoring them.`);
		}
		const ordered = [...new Set(matches.flat())];
		if(ordered.length === 0) {
			return;
		}
		const rest = unordered.filter(r => !ordered.includes(r));
		implicitSourcesLog.debug(`Ordering implicit sources of ${kind} project: ${ordered.map(s => s.request === 'file' ? s.content : '<text>').join(', ')}`);
		ctx.files.loadingOrder.addGuess([...rest, ...ordered]);
	}
}
