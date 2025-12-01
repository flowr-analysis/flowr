import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import type { IEnvironment, REnvironmentInformation } from '../../dataflow/environments/environment';
import { Environment } from '../../dataflow/environments/environment';
import type { DeepReadonly } from 'ts-essentials';
import { getBuiltInDefinitions } from '../../dataflow/environments/built-in-config';
import type { Fingerprint } from '../../slicing/static/fingerprint';
import { envFingerprint } from '../../slicing/static/fingerprint';

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
	 * Get the empty built-in environment used during analysis.
	 * The empty built-in environment only contains primitive definitions.
	 */
	get emptyBuiltInEnvironment(): DeepReadonly<IEnvironment>;

	/**
	 * Create a new {@link REnvironmentInformation|environment} with the configured built-in environment as base.
	 */
	makeCleanEnv(): REnvironmentInformation;

	/**
	 * Get the fingerprint of the clean environment with the configured built-in environment as base.
	 */
	getCleanEnvFingerprint(): Fingerprint;

	/**
	 * Create a new {@link REnvironmentInformation|environment} with an empty built-in environment as base.
	 */
	makeCleanEnvWithEmptyBuiltIns(): REnvironmentInformation;
}

/**
 * This context is responsible for providing the built-in environment.
 * It creates the built-in environment based on the configuration provided in the {@link FlowrAnalyzerContext}.
 */
export class FlowrAnalyzerEnvironmentContext implements ReadOnlyFlowrAnalyzerEnvironmentContext {
	public readonly name = 'flowr-analyzer-environment-context';
	private readonly builtInEnv:      IEnvironment;
	private readonly emptyBuiltInEnv: IEnvironment;

	private builtInEnvFingerprint: Fingerprint | undefined;

	constructor(ctx: FlowrAnalyzerContext) {
		const builtInsConfig = ctx.config.semantics.environment.overwriteBuiltIns;
		const builtIns = getBuiltInDefinitions(builtInsConfig.definitions, builtInsConfig.loadDefaults);

		this.builtInEnv = new Environment(undefined as unknown as IEnvironment, true);
		this.builtInEnv.memory = builtIns.builtInMemory;

		this.emptyBuiltInEnv = new Environment(undefined as unknown as IEnvironment, true);
		this.emptyBuiltInEnv.memory = builtIns.emptyBuiltInMemory;
	}

	public get builtInEnvironment(): DeepReadonly<IEnvironment> {
		return this.builtInEnv;
	}

	public get emptyBuiltInEnvironment(): DeepReadonly<IEnvironment> {
		return this.emptyBuiltInEnv;
	}

	public makeCleanEnv(): REnvironmentInformation {
		return {
			current: new Environment(this.builtInEnv),
			level:   0
		};
	}

	public getCleanEnvFingerprint(): Fingerprint {
		if(!this.builtInEnvFingerprint) {
			this.builtInEnvFingerprint = envFingerprint(this.makeCleanEnv());
		}
		return this.builtInEnvFingerprint;
	}

	public makeCleanEnvWithEmptyBuiltIns(): REnvironmentInformation {
		return {
			current: new Environment(this.emptyBuiltInEnv),
			level:   0
		};
	}
}

