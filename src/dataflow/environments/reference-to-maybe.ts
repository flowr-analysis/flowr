import type { BrandedIdentifier, IdentifierDefinition, IdentifierReference } from './identifier';
import { Identifier, ReferenceType } from './identifier';
import type { DataflowGraph } from '../graph/graph';
import type { ControlDependency } from '../info';
import type { Environment, REnvironmentInformation } from './environment';
import { resolveByName } from './resolve-by-name';
import { VertexType } from '../graph/vertex';
import { S7DispatchSeparator } from '../internal/process/functions/call/built-in/built-in-s-seven-dispatch';

function appToCdsUnique(target: ControlDependency[], toAdd: readonly ControlDependency[] | undefined): void{
	if(!toAdd) {
		return;
	}
	for(const c of toAdd) {
		let found = false;
		for(const tc of target) {
			if(tc.id === c.id && tc.when === c.when) {
				found = true;
				break;
			}
		}
		if(!found) {
			target.push(c);
		}
	}
}

function concatCdsUnique(target: ControlDependency[], toAdd: readonly ControlDependency[] | undefined): ControlDependency[] {
	if(!toAdd) {
		return target;
	}
	const result = Array.from(target);
	for(const c of toAdd) {
		let found = false;
		for(const tc of target) {
			if(tc.id === c.id && tc.when === c.when) {
				found = true;
				break;
			}
		}
		if(!found) {
			result.push(c);
		}
	}
	return result;
}

/** copy of the definition with the given cds attached */
function withAppliedCds(definition: IdentifierDefinition, defaultCd: readonly ControlDependency[] | undefined): IdentifierDefinition {
	return {
		...definition,
		cds: definition.cds ? concatCdsUnique(definition.cds, defaultCd) : (defaultCd ? Array.from(defaultCd) : [])
	};
}

/** replaces the definitions stored under the given key by copies carrying the additional cds */
function replaceDefinitions(env: Environment, key: BrandedIdentifier, toUpdate: ReadonlySet<IdentifierDefinition>, defaultCd: readonly ControlDependency[] | undefined): void {
	const defs = env.memory.get(key);
	if(defs?.some(d => toUpdate.has(d))) {
		env.memory.set(key, defs.map(d => toUpdate.has(d) ? withAppliedCds(d, defaultCd) : d));
	}
	env.cache?.delete(key);
}

/**
 * Attaches the given control dependencies to the given definitions within the environment chain.
 * Copy-on-write: definitions are replaced, never mutated in place, so previously cloned
 * environments (e.g., snapshots stored in the dataflow graph) keep their state.
 */
function applyCdsToDefinitions(environments: REnvironmentInformation, name: Identifier, type: ReferenceType, definitions: readonly IdentifierDefinition[], defaultCd: readonly ControlDependency[] | undefined): void {
	const toUpdate = new Set<IdentifierDefinition>();
	for(const definition of definitions) {
		if(definition.type !== ReferenceType.BuiltInFunction && definition.type !== ReferenceType.BuiltInConstant
			&& (defaultCd !== undefined || definition.cds === undefined)) {
			toUpdate.add(definition);
		}
	}
	if(toUpdate.size === 0) {
		return;
	}
	const [plainName] = Identifier.toArray(name);
	const prefix = type === ReferenceType.S3MethodPrefix ? plainName + '.'
		: type === ReferenceType.S7MethodPrefix ? plainName + S7DispatchSeparator : undefined;
	let current: Environment = environments.current;
	while(!current.builtInEnv) {
		if(prefix === undefined) {
			replaceDefinitions(current, plainName, toUpdate, defaultCd);
		} else {
			for(const key of [...current.memory.keys()]) {
				if(key.startsWith(prefix)) {
					replaceDefinitions(current, key, toUpdate, defaultCd);
				}
			}
		}
		current = current.parent;
	}
}

/**
 * Marks the reference as maybe (i.e., as controlled by a set of {@link IdentifierReference#cds|control dependencies}).
 * With `includeDefs`, the cds are also attached (copy-on-write) to the definitions the reference
 * resolves to, see {@link applyCdsToDefinitions}.
 */
export function makeReferenceMaybe(ref: IdentifierReference, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency[] | undefined = undefined): IdentifierReference {
	if(includeDefs && ref.name) {
		const definitions = resolveByName(ref.name, environments, ref.type);
		if(definitions && definitions.length > 0) {
			applyCdsToDefinitions(environments, ref.name, ref.type, definitions, defaultCd);
		}
	}
	const node = graph.getVertex(ref.nodeId);
	if(node) {
		if(node.cds) {
			appToCdsUnique(node.cds, defaultCd);
		} else {
			node.cds = defaultCd ? Array.from(defaultCd) : [];
		}
	}
	if(ref.cds) {
		if(defaultCd) {
			return { ...ref, cds: concatCdsUnique(ref.cds, defaultCd) };
		}
	} else {
		return { ...ref, cds: defaultCd ? Array.from(defaultCd) : [] };
	}
	return ref;
}

/**
 * Marks all references as maybe (i.e., as controlled by a set of {@link IdentifierReference#cds|control dependencies}).
 * @see {@link makeReferenceMaybe}
 */
export function makeAllMaybe(references: readonly IdentifierReference[] | undefined, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, applyCds: ControlDependency[] | undefined = undefined): IdentifierReference[] {
	if(references === undefined || references.length === 0) {
		return [];
	}
	return references.map(ref => makeReferenceMaybe(ref, graph, environments, includeDefs, applyCds));
}

/**
 * apply the given cds to all elements in the graph and also transform the given references similar to {@link makeAllMaybe}.
 */
export function applyCdsToAllInGraphButConstants(graph: DataflowGraph, references: readonly IdentifierReference[], cds: readonly ControlDependency[]): void {
	for(const [,v] of graph.vertices(true)) {
		if(v.tag === VertexType.Value) {
			continue;
		}
		if(v.cds) {
			appToCdsUnique(v.cds, cds);
		} else {
			v.cds = Array.from(cds);
		}
	}
	for(const ref of references) {
		if(ref.cds) {
			appToCdsUnique(ref.cds, cds);
		} else {
			ref.cds = Array.from(cds);
		}
	}
}

/**
 * apply the given cds to all given references, but not to the graph. This is useful if we want to mark the references as maybe without marking all other nodes in the graph as maybe.
 */
export function applyCdToReferences(references: readonly IdentifierReference[], cds: readonly ControlDependency[]): void {
	if(cds.length === 0) {
		return;
	}
	for(const ref of references) {
		if(ref.cds) {
			appToCdsUnique(ref.cds, cds);
		} else {
			ref.cds = Array.from(cds);
		}
	}
}