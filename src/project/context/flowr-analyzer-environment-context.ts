import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import type { IEnvironment } from '../../dataflow/environments/environment';
import { createBuiltInEnvFromConfig } from '../../dataflow/environments/environment';

/**
 * This context is responsible for providing the built-in environment.
 */
export class FlowrAnalyzerEnvironmentContext {
	public readonly name = 'flowr-analyzer-environment-context';
	private readonly builtInEnv: IEnvironment;

	constructor(ctx: FlowrAnalyzerContext) {
		this.builtInEnv = createBuiltInEnvFromConfig(ctx.config);
	}

	public get builtInEnvironment(): IEnvironment {
		return this.builtInEnv;
	}
}

