import type { AnyBuiltInDefinition } from '../../../dataflow/environments/built-in-config';
import { DefaultBuiltinConfig } from '../../../dataflow/environments/default-builtin-config';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { SignatureDb } from '../../../project/sigdb/signature-db';
import { isBaseRPackage } from '../../../util/r-base-packages';

/**
 * flowR's own modeling of one built-in entry naming a function, read off {@link DefaultBuiltinConfig} (built
 * from `WrittenBuiltinDefinitions`). Raw config values are not surfaced as-is - some carry closures
 * (`ignoreIf`, `hasUnknownSideEffects`), which are not meaningful to a query consumer - so only their keys are.
 */
export interface BuiltinModel {
	readonly kind:            'function' | 'constant' | 'replacement';
	/** the package the entry names it under, e.g. `stats` for `sd`; `undefined` for an unqualified entry like most of `base` */
	readonly namespace?:      string;
	/** {@link BuiltInProcName} value, for a `function` entry */
	readonly processor?:      string;
	readonly assumePrimitive: boolean;
	/** {@link BuiltInEvalName} value, when the entry folds calls to a constant */
	readonly evalHandler?:    string;
	/** {@link SemanticCallTag} values the entry's config states, empty when it states none */
	readonly tags:            readonly string[];
	/** the config keys the entry declares */
	readonly configKeys:      readonly string[];
}

function toModel(def: AnyBuiltInDefinition, namespace: string | undefined): BuiltinModel {
	switch(def.type) {
		case 'function':
			return {
				kind:            'function',
				namespace,
				processor:       def.processor,
				assumePrimitive: def.assumePrimitive ?? false,
				evalHandler:     def.evalHandler,
				tags:            def.config?.tags ?? [],
				configKeys:      def.config ? Object.keys(def.config) : []
			};
		case 'replacement':
			return {
				kind:            'replacement',
				namespace,
				assumePrimitive: def.assumePrimitive ?? false,
				tags:            def.config.tags ?? [],
				configKeys:      Object.keys(def.config)
			};
		case 'constant':
			return { kind: 'constant', namespace, assumePrimitive: def.assumePrimitive ?? false, tags: [], configKeys: [] };
	}
}

/** indexes {@link DefaultBuiltinConfig} by bare name, then by namespace, once (the table never changes at runtime) */
let byBareName: Map<string, Map<string | undefined, BuiltinModel>> | undefined;

function index(): Map<string, Map<string | undefined, BuiltinModel>> {
	if(byBareName === undefined) {
		byBareName = new Map();
		for(const def of DefaultBuiltinConfig as readonly AnyBuiltInDefinition[]) {
			for(const id of def.names) {
				const bare = Identifier.getName(id);
				const namespace = Identifier.getNamespace(id);
				const byNamespace = byBareName.get(bare) ?? new Map<string | undefined, BuiltinModel>();
				byBareName.set(bare, byNamespace);
				/* a later entry for the same (namespace, name) deliberately restates an earlier one (`overrides:
				   true`, see WrittenBuiltinDefinitions) and wins, exactly like BuiltIns.set() overwriting the map */
				byNamespace.set(namespace, toModel(def, namespace));
			}
		}
	}
	return byBareName;
}

/** every built-in flowR states for the bare name `name`, one entry per namespace it is declared under, empty when it states none */
export function builtinModelsOf(name: string): readonly BuiltinModel[] {
	return [...(index().get(name)?.values() ?? [])];
}

export interface FunctionOrigin {
	/** packages the signature database says export `name`, restricted to `candidates` when given; base R first, the rest by downloads (see {@link SignatureDb.packagesExporting}) */
	readonly packages: readonly string[];
	/** flowR's own definitions for `name`, see {@link builtinModelsOf} */
	readonly builtin:  readonly BuiltinModel[];
}

/**
 * Where `name` comes from: what the signature database says exports it, and what flowR's own built-in
 * configuration states about it. Backs the function-info query; the dependencies query's assumed-base-package
 * reporting asks the narrower "is this one of the attached base packages" question instead, via
 * `attachedBasePackages`/`Dataflow.qualifyAll`, since that needs no signature database mounted at all.
 * @param sigDb      - the database to ask, see {@link SignatureDb}
 * @param name       - the bare name to look up
 * @param candidates - restrict the package list to these names; every exporting package when omitted
 */
export function functionOrigin(sigDb: SignatureDb, name: string, candidates?: readonly string[]): FunctionOrigin {
	const exporting = sigDb.packagesExporting(name);
	const matching = candidates === undefined ? exporting : exporting.filter(p => candidates.includes(p));
	/* base R carries no download count to rank by, yet a base package exporting the name is the likeliest answer */
	const packages = [...matching.filter(p => isBaseRPackage(p)), ...matching.filter(p => !isBaseRPackage(p))];
	return { packages, builtin: builtinModelsOf(name) };
}
