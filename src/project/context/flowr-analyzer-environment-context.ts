import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import type { IEnvironment } from '../../dataflow/environments/environment';
import { createBuiltInEnvFromConfig } from '../../dataflow/environments/environment';
import type { DeepReadonly } from 'ts-essentials';

/**
 * This is the read-only interface to the {@link FlowrAnalyzerEnvironmentContext},
 * which provides access to the built-in environment used during analysis.
 */
export interface ReadOnlyFlowrAnalyzerEnvironmentContext {
	/**
	 * Get the built-in environment used during analysis.
	 */
	get builtInEnvironment(): DeepReadonly<IEnvironment>;
}

/**
 * This context is responsible for providing the built-in environment.
 */
export class FlowrAnalyzerEnvironmentContext implements ReadOnlyFlowrAnalyzerEnvironmentContext {
	public readonly name = 'flowr-analyzer-environment-context';
	private readonly builtInEnv: IEnvironment;

	constructor(ctx: FlowrAnalyzerContext) {
		this.builtInEnv = createBuiltInEnvFromConfig(ctx.config);
	}

	public get builtInEnvironment(): IEnvironment {
		return this.builtInEnv;
	}
}

