import type { FlowrAnalyzerPlugin } from '../plugins/flowr-analyzer-plugin';
import { isNotUndefined } from '../../util/assert';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';

/**
 * Abstract class representing the context, a context may be modified and enriched by plugins
 */
export abstract class AbstractFlowrAnalyzerContext<In, Out, Plugin extends FlowrAnalyzerPlugin<In, Out>> {
	public abstract readonly name: string;
	protected readonly plugins: readonly Plugin[];
	protected readonly ctx:     FlowrAnalyzerContext;


	protected constructor(ctx: FlowrAnalyzerContext, defaultPlugin: Plugin, plugins?: readonly Plugin[]) {
		this.plugins = [...plugins ?? [], defaultPlugin];
		this.ctx = ctx;
	}

	/**
	 * Run all registered plugins on the given args, please be aware that if they are async, it is up to you to
	 * await them.
	 */
	protected applyPlugins(args: Parameters<Plugin['processor']>[1]): Out[] {
		const res: (Out | undefined)[] = [];
		for(const plugin of this.plugins) {
			res.push(plugin.processor(this.ctx, args));
		}
		return res.filter(isNotUndefined);
	}


	/**
	 * Returns the project context this sub-context is attached to
	 */
	public getAttachedContext(): FlowrAnalyzerContext {
		return this.ctx;
	}
}