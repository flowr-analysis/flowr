import { SemVer } from 'semver';
import { FlowrAnalyzerLoadingOrderPlugin } from './flowr-analyzer-loading-order-plugin';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { RParseRequest } from '../../../r-bridge/retriever';
import { log } from '../../../util/log';
import { globMatcher } from '../../../util/glob';

export const implicitSourcesLog = log.getSubLogger({ name: 'loading-order-implicit-sources' });

/**
 * Orders the files given by `project.implicitSources`, which is already specialized for the project kind.
 * Files that are no implicit sources stay in front, as the implicit entry points consume them.
 */
export class FlowrAnalyzerLoadingOrderImplicitSourcesPlugin extends FlowrAnalyzerLoadingOrderPlugin {
	public readonly name = 'flowr-analyzer-loading-order-implicit-sources-plugin';
	public readonly description = 'Orders the files a framework loads implicitly, as configured by project.implicitSources.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const kind = ctx.projectKind();
		const implicit = ctx.config.project.implicitSources;
		if(!implicit || implicit.length === 0) {
			return;
		}
		const unordered = ctx.files.loadingOrder.getUnorderedRequests();
		const files = unordered.filter(r => r.request === 'file');
		/* the matches of each entry, in project order; an entry matching none is a typo or names a foreign file */
		const ordered = new Set<RParseRequest>();
		const unmatched: string[] = [];
		for(const entry of implicit) {
			const matches = globMatcher(entry);
			let matched = false;
			for(const file of files) {
				if(matches(file.content)) {
					ordered.add(file);
					matched = true;
				}
			}
			if(!matched) {
				unmatched.push(`'${entry}'`);
			}
		}
		if(unmatched.length > 0) {
			implicitSourcesLog.warn(`No file of the ${kind} project matches the implicit source(s) ${unmatched.join(', ')}, ignoring them.`);
		}
		if(ordered.size === 0) {
			return;
		}
		const rest = unordered.filter(r => !ordered.has(r));
		implicitSourcesLog.debug(`Ordering implicit sources of ${kind} project: ${[...ordered].map(s => s.content).join(', ')}`);
		ctx.files.loadingOrder.addGuess([...rest, ...ordered]);
	}
}
