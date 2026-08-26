import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import type { IEnvironment, REnvironmentInformation } from '../../dataflow/environments/environment';
import { Environment } from '../../dataflow/environments/environment';
import type { cleanEnvOf } from '../../dataflow/environments/scoping';
import type { DeepReadonly } from 'ts-essentials';
import { getBuiltInDefinitions } from '../../dataflow/environments/built-in-config';
import type { BrandedIdentifier, IdentifierDefinition } from '../../dataflow/environments/identifier';
import { Identifier, ReferenceType } from '../../dataflow/environments/identifier';
import type { BuiltInIdentifierDefinition, BuiltInMemory  } from '../../dataflow/environments/built-in';
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
	 * Knows only the built-ins, no attached package, so prefer {@link cleanEnvOf} wherever an environment is at hand.
	 */
	makeCleanEnv(): REnvironmentInformation;

	/**
	 * {@link makeCleanEnv} as a stable thunk. Hand this to something that may or may not need a clean
	 * environment (see {@link DataflowGraph#addVertex}), so offering one costs nothing when it goes unused.
	 */
	readonly cleanEnv: () => REnvironmentInformation;

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

	/** What the configuration states about `pkg`'s exports, `undefined` when it states nothing (these are not in the built-in environment: attaching the package brings them into scope). */
	statedFor(pkg: string): BuiltInMemory | undefined;

	/** The definitions the configuration states for `name` without any package attached: its namespace's when it names one, otherwise what every package together states for the bare name. */
	statedDefinitionsOf(name: Identifier): readonly IdentifierDefinition[] | undefined;
}

/**
 * Provides the built-in environment, created from the {@link FlowrAnalyzerContext} configuration.
 */
export class FlowrAnalyzerEnvironmentContext implements ReadOnlyFlowrAnalyzerEnvironmentContext {
	public readonly name = 'flowr-analyzer-environment-context';
	private readonly builtInEnv:      Environment;
	private readonly emptyBuiltInEnv: Environment;

	/** what the configuration states about packages R does not attach on startup, see {@link statedFor} */
	private readonly stated: ReadonlyMap<string, BuiltInMemory>;

	private builtInEnvFingerprint: Fingerprint | undefined;
	/** the packages {@link knowsPackage} answers for, collected from the built-in environment on first use */
	private knownPackages:         Set<string> | undefined;
	/** {@link stated} by bare name across all packages, for {@link statedDefinitionsOf}; built on first use */
	private statedByName:          Map<BrandedIdentifier, IdentifierDefinition[]> | undefined;

	constructor(ctx: FlowrAnalyzerContext) {
		const builtInsConfig = ctx.config.semantics.environment.overwriteBuiltIns;
		const builtIns = getBuiltInDefinitions(builtInsConfig.definitions, builtInsConfig.loadDefaults);

		this.builtInEnv = new Environment(undefined as unknown as Environment, true);
		this.builtInEnv.adoptMap(builtIns.builtInMemory);

		this.emptyBuiltInEnv = new Environment(undefined as unknown as Environment, true);
		this.emptyBuiltInEnv.adoptMap(builtIns.emptyBuiltInMemory);

		this.stated = builtIns.packageMemory;
		/* `pkg::fn` resolves whether or not the package is attached, so the built-in env answers for it */
		this.builtInEnv.namespaces = builtIns.packageMemory;
	}

	public statedFor(pkg: string): BuiltInMemory | undefined {
		return this.stated.get(pkg);
	}

	public statedDefinitionsOf(name: Identifier): readonly IdentifierDefinition[] | undefined {
		const bare = Identifier.getName(name);
		const namespace = Identifier.getNamespace(name);
		if(namespace !== undefined) {
			return this.stated.get(String(namespace))?.get(bare);
		}
		if(this.statedByName === undefined) {
			this.statedByName = new Map();
			for(const memory of this.stated.values()) {
				for(const [key, definitions] of memory) {
					const known = this.statedByName.get(key);
					if(known === undefined) {
						this.statedByName.set(key, [...definitions]);
					} else {
						known.push(...definitions);
					}
				}
			}
		}
		return this.statedByName.get(bare);
	}

	public get builtInEnvironment(): DeepReadonly<IEnvironment> {
		return this.builtInEnv;
	}

	public get emptyBuiltInEnvironment(): DeepReadonly<IEnvironment> {
		return this.emptyBuiltInEnv;
	}

	public builtInDefinitionsOf(name: Identifier): readonly IdentifierDefinition[] {
		return this.builtInEnv.memory.get(Identifier.getName(name)) ?? this.statedDefinitionsOf(name) ?? [];
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

	/* one thunk per context rather than one per call, as the callers offering it mostly do not need it */
	public readonly cleanEnv = (): REnvironmentInformation => this.makeCleanEnv();

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
