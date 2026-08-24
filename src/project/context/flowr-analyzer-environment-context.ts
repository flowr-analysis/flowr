import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import type { IEnvironment, REnvironmentInformation } from '../../dataflow/environments/environment';
import { Environment } from '../../dataflow/environments/environment';
import type { DeepReadonly } from 'ts-essentials';
import { getBuiltInDefinitions } from '../../dataflow/environments/built-in-config';
import type { IdentifierDefinition } from '../../dataflow/environments/identifier';
import { Identifier, ReferenceType } from '../../dataflow/environments/identifier';
import type { BuiltInIdentifierDefinition } from '../../dataflow/environments/built-in';
import type { Fingerprint } from '../../slicing/static/fingerprint';
import { envFingerprint } from '../../slicing/static/fingerprint';

/**
 * Read-only interface to the {@link FlowrAnalyzerEnvironmentContext}.
 */
export interface ReadOnlyFlowrAnalyzerEnvironmentContext {
	/**
	 * Get the built-in environment used during analysis.
	 */
	get builtInEnvironment(): DeepReadonly<IEnvironment>;

	/**
	 * Every built-in definition flowR carries for `name`, matched by its plain name.
	 */
	builtInDefinitionsOf(name: Identifier): readonly IdentifierDefinition[];

	/**
	 * The built-in function flowR defines for `name`, respecting its namespace: `dplyr::filter` picks
	 * flowR's `dplyr` definition rather than whatever else is registered under `filter`.
	 */
	builtInFunctionOf(name: Identifier): BuiltInIdentifierDefinition | undefined;

	/**
	 * Whether flowR carries definitions of its own for package `pkg`, i.e. whether it knows what attaching
	 * that package brings even when no signature database resolves it. Built once and kept, as the built-in
	 * environment does not change during an analysis.
	 */
	knowsPackage(pkg: string): boolean;

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

	/**
	 * A completely empty {@link REnvironmentInformation|environment}.
	 */
	makeEmptyEnv(): REnvironmentInformation;
}

/**
 * Provides the built-in environment, created from the {@link FlowrAnalyzerContext} configuration.
 */
export class FlowrAnalyzerEnvironmentContext implements ReadOnlyFlowrAnalyzerEnvironmentContext {
	public readonly name = 'flowr-analyzer-environment-context';
	private readonly builtInEnv:      Environment;
	private readonly emptyBuiltInEnv: Environment;

	private builtInEnvFingerprint: Fingerprint | undefined;
	/** the packages {@link knowsPackage} answers for, collected from the built-in environment on first use */
	private knownPackages:         Set<string> | undefined;

	constructor(ctx: FlowrAnalyzerContext) {
		const builtInsConfig = ctx.config.semantics.environment.overwriteBuiltIns;
		const builtIns = getBuiltInDefinitions(builtInsConfig.definitions, builtInsConfig.loadDefaults);

		this.builtInEnv = new Environment(undefined as unknown as Environment, true);
		this.builtInEnv.memory = builtIns.builtInMemory;

		this.emptyBuiltInEnv = new Environment(undefined as unknown as Environment, true);
		this.emptyBuiltInEnv.memory = builtIns.emptyBuiltInMemory;
	}

	public get builtInEnvironment(): DeepReadonly<IEnvironment> {
		return this.builtInEnv;
	}

	public get emptyBuiltInEnvironment(): DeepReadonly<IEnvironment> {
		return this.emptyBuiltInEnv;
	}

	public builtInDefinitionsOf(name: Identifier): readonly IdentifierDefinition[] {
		return this.builtInEnv.memory.get(Identifier.getName(name)) ?? [];
	}

	public knowsPackage(pkg: string): boolean {
		if(this.knownPackages === undefined) {
			this.knownPackages = new Set();
			for(const [, definitions] of this.builtInEnv.memory) {
				for(const definition of definitions) {
					const namespace = definition.name === undefined ? undefined : Identifier.getNamespace(definition.name);
					if(namespace !== undefined) {
						this.knownPackages.add(String(namespace));
					}
				}
			}
		}
		return this.knownPackages.has(pkg);
	}

	public builtInFunctionOf(name: Identifier): BuiltInIdentifierDefinition | undefined {
		const namespace = Identifier.getNamespace(name);
		return this.builtInDefinitionsOf(name).find((d): d is BuiltInIdentifierDefinition =>
			d.type === ReferenceType.BuiltInFunction && typeof d.processor === 'function'
			&& (namespace === undefined || (d.name !== undefined && Identifier.getNamespace(d.name) === namespace)));
	}

	public makeCleanEnv(): REnvironmentInformation {
		return {
			current: new Environment(this.builtInEnv).asGlobal(),
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
			current: new Environment(this.emptyBuiltInEnv).asGlobal(),
			level:   0
		};
	}

	public makeEmptyEnv(): REnvironmentInformation {
		return {
			current: new Environment(undefined as unknown as Environment, true),
			level:   0
		};
	}
}

