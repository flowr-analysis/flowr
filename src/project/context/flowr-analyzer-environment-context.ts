import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import { getBuiltInDefinitions } from '../../dataflow/environments/built-in-config';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { initializeCleanEnvironments } from '../../dataflow/environments/environment';

/**
 * This context is responsible for managing the R environment information used during analysis.
 */
export class FlowrAnalyzerEnvironmentContext {
	public readonly name = 'flowr-analyzer-environment-context';
	private readonly env: REnvironmentInformation;

	constructor(ctx: FlowrAnalyzerContext) {
		const builtInsConfig = ctx.config.semantics.environment.overwriteBuiltIns;
		const builtIns = getBuiltInDefinitions(builtInsConfig.definitions, builtInsConfig.loadDefaults);
		this.env = initializeCleanEnvironments(builtIns.builtInMemory);
	}

	public get envInformation(): REnvironmentInformation {
		return this.env;
	}
}

