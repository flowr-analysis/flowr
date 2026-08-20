import type { BrandedIdentifier, IdentifierDefinition, IdentifierReference } from './identifier';
import { Identifier, ReferenceType } from './identifier';
import type { DataflowGraph } from '../graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../info';
import { appendCds, withCds } from '../info';
import type { Environment, REnvironmentInformation } from './environment';
import { S7DispatchSeparator } from '../internal/process/functions/call/built-in/built-in-s-seven-dispatch';
import { ValueVertex } from '../graph/vertex';
import { Resolve } from './resolve-helper';

/** copy of the definition with the given cds attached, marking it as maybe */
export function withAppliedCds(definition: IdentifierDefinition, defaultCd: readonly ControlDependency[] | undefined): IdentifierDefinition {
	return { ...definition, cds: withCds(definition.cds, defaultCd) };
}

/** replaces the definitions stored under the given key by copies carrying the additional cds */
function replaceDefinitions(env: Environment, key: BrandedIdentifier, toUpdate: ReadonlySet<IdentifierDefinition>, defaultCd: readonly ControlDependency[] | undefined): void {
	const defs = env.memory.get(key);
	if(defs?.some(d => toUpdate.has(d))) {
		env.writableMemory.set(key, defs.map(d => toUpdate.has(d) ? withAppliedCds(d, defaultCd) : d));
	}
	env.cache?.delete(key);
}

/**
 * Attaches the given control dependencies to the definition made by `nodeId` within the environment chain.
 * Definitions of the same name made elsewhere survive whenever the conditional definition does not happen.
 * Copy-on-write: definitions are replaced, never mutated in place, so previously cloned
 * environments (e.g., snapshots stored in the dataflow graph) keep their state.
 */
function applyCdsToDefinitions(environments: REnvironmentInformation, name: Identifier, type: ReferenceType, definitions: readonly IdentifierDefinition[], nodeId: NodeId, defaultCd: readonly ControlDependency[] | undefined): void {
	const toUpdate = new Set<IdentifierDefinition>();
	for(const definition of definitions) {
		if(definition.nodeId === nodeId
			&& definition.type !== ReferenceType.BuiltInFunction && definition.type !== ReferenceType.BuiltInConstant
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
			for(const key of current.memory.keys()) {
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
 * With `includeDefs`, the cds are also attached (copy-on-write) to the definition the reference
 * itself made, see {@link applyCdsToDefinitions}.
 */
export function makeReferenceMaybe(ref: IdentifierReference, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency[] | undefined = undefined): IdentifierReference {
	if(includeDefs && ref.name) {
		const definitions = Resolve.byNameAndType(ref.name, environments, ref.type);
		if(definitions && definitions.length > 0) {
			applyCdsToDefinitions(environments, ref.name, ref.type, definitions, ref.nodeId, defaultCd);
		}
	}
	const node = graph.getVertex(ref.nodeId);
	if(node) {
		if(node.cds) {
			appendCds(node.cds, defaultCd);
		} else {
			node.cds = defaultCd ? Array.from(defaultCd) : [];
		}
	}
	if(ref.cds) {
		if(defaultCd) {
			return { ...ref, cds: withCds(ref.cds, defaultCd) };
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
		if(ValueVertex.is(v)) {
			continue;
		}
		if(v.cds) {
			appendCds(v.cds, cds);
		} else {
			v.cds = Array.from(cds);
		}
	}
	for(const ref of references) {
		if(ref.cds) {
			appendCds(ref.cds, cds);
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
			appendCds(ref.cds, cds);
		} else {
			ref.cds = Array.from(cds);
		}
	}
}