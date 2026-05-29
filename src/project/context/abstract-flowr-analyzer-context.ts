import type { FlowrAnalyzerPlugin } from '../plugins/flowr-analyzer-plugin';
import { isNotUndefined } from '../../util/assert';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';

/**
 * Abstract class representing the context, a context may be modified and enriched by plugins (see {@link FlowrAnalyzerPlugin}).
 *
 * Please use the specialized contexts like {@link FlowrAnalyzerFilesContext} or {@link FlowrAnalyzerLoadingOrderContext} to work with flowR and
 * in general, use the {@link FlowrAnalyzerContext} to access the full project context.
 */
export abstract class AbstractFlowrAnalyzerContext<In, Out, Plugin extends FlowrAnalyzerPlugin<In, Out>> {
	/**
	 * A human-readable name of the context. Try to make it unique to avoid confusion in the logs.
	 */
	public abstract readonly name: string;
	/**
	 * The plugins registered for this context. These build the foundation for {@link applyPlugins}.
	 */
	protected readonly plugins: readonly Plugin[];
	/**
	 * The linked full project context, allowing plugins to modify and access it.
	 */
	protected readonly ctx:     FlowrAnalyzerContext;

	/**
	 * Creates a new context with the given project context, a default plugin (to be used when no other is registered)
	 */
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

	/**
	 * Reset the context to its initial state.
	 */
	public abstract reset(): void;
}