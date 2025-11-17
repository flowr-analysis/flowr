import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import { getBuiltInDefinitions } from '../../dataflow/environments/built-in-config';
import type { IEnvironment, REnvironmentInformation } from '../../dataflow/environments/environment';
import { initializeCleanEnvironments } from '../../dataflow/environments/environment';

/**
 * This context is responsible for managing the R environment information used during analysis.
 */
export class FlowrAnalyzerEnvironmentContext {
	public readonly name = 'flowr-analyzer-environment-context';
	private readonly env:        REnvironmentInformation;
	private readonly builtInEnv: IEnvironment;

	constructor(ctx: FlowrAnalyzerContext) {
		const builtInsConfig = ctx.config.semantics.environment.overwriteBuiltIns;
		const builtIns = getBuiltInDefinitions(builtInsConfig.definitions, builtInsConfig.loadDefaults);
		this.env = initializeCleanEnvironments(builtIns.builtInMemory);
		this.builtInEnv = this.env.current.parent;
	}

	public get envInformation(): REnvironmentInformation {
		return this.env;
	}

	public get builtInEnvironment(): IEnvironment {
		return this.builtInEnv;
	}
}

