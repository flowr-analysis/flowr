import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import type { IEnvironment, REnvironmentInformation } from '../../dataflow/environments/environment';
import { createBuiltInEnv, createBuiltInEnvFromConfig, Environment } from '../../dataflow/environments/environment';
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

	/**
	 * Create a new {@link REnvironmentInformation|environment} with the configured built-in environment as base.
	 */
	getCleanEnv(builtInEnv: IEnvironment): REnvironmentInformation;

	/**
	 * Create a new {@link REnvironmentInformation|environment} with an empty built-in environment as base.
	 */
	getCleanEnvWithEmptyBuiltIns(): REnvironmentInformation;
}

/**
 * This context is responsible for providing the built-in environment.
 * It creates the built-in environment based on the configuration provided in the {@link FlowrAnalyzerContext}.
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

	public getCleanEnv(): REnvironmentInformation {
		return {
			current: new Environment(this.builtInEnv),
			level:   0
		};
	}

	public getCleanEnvWithEmptyBuiltIns(): REnvironmentInformation {
		return {
			current: new Environment(createBuiltInEnv(undefined, false)),
			level:   0
		};
	}
}

