import type { AnyBuiltInDefinition, BuiltInDefinitions } from '../../../dataflow/environments/built-in-config';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';

/**
 * flowR's own modeling of one built-in entry naming a function, read off the built-in definitions the analyzer
 * registered (see {@link ReadOnlyFlowrAnalyzerEnvironmentContext#builtInDefinitions}). Raw config values are not surfaced as-is - some carry closures
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

function byBareName(definitions: BuiltInDefinitions): Map<string, Map<string | undefined, BuiltinModel>> {
	const known = new Map<string, Map<string | undefined, BuiltinModel>>();
	for(const def of definitions as readonly AnyBuiltInDefinition[]) {
		for(const id of def.names) {
			const bare = Identifier.getName(id);
			const namespace = Identifier.getNamespace(id);
			const byNamespace = known.get(bare) ?? new Map<string | undefined, BuiltinModel>();
			known.set(bare, byNamespace);
			byNamespace.set(namespace, toModel(def, namespace));
		}
	}
	return known;
}

/** every built-in the analyzer states for the bare name `name`, one entry per namespace it is declared under, empty when it states none */
export function builtinModelsOf(name: string, ctx: ReadOnlyFlowrAnalyzerContext): readonly BuiltinModel[] {
	return [...(ctx.env.deriveFromDefinitions(byBareName).get(name)?.values() ?? [])];
}
