import type { FlowrAnalyzerPlugin } from '../plugins/flowr-analyzer-plugin';
import type { AsyncOrSync } from 'ts-essentials';
import { isNotUndefined } from '../../util/assert';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';

/**
 * Abstract class representing the context, a context may be modified and enriched by plugins
 */
export abstract class AbstractFlowrAnalyzerContext<In, Out, Plugin extends FlowrAnalyzerPlugin<In, Out>> {
    public abstract readonly name: string;
    protected readonly plugins: readonly Plugin[];
    protected readonly ctx:     FlowrAnalyzerContext;

    protected constructor(ctx: FlowrAnalyzerContext, plugins?: readonly Plugin[]) {
    	this.plugins = plugins ?? [];
    	this.ctx = ctx;
    }


    protected async applyPlugins(args: Parameters<Plugin['processor']>[1]): Promise<Awaited<Out>[]> {
    	const res: AsyncOrSync<Out | undefined>[] = [];
    	for(const plugin of this.plugins) {
    		res.push(plugin.processor(this.ctx, args));
    	}
    	return Promise.all(res).then(f => f.filter(isNotUndefined));
    }
}