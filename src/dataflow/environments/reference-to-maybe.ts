import type { IdentifierReference } from './identifier';
import { ReferenceType } from './identifier';
import type { DataflowGraph } from '../graph/graph';
import type { ControlDependency } from '../info';
import type { REnvironmentInformation } from './environment';
import { resolveByName } from './resolve-by-name';
import { VertexType } from '../graph/vertex';

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

/**
 * Marks the reference as maybe (i.e., as controlled by a set of {@link IdentifierReference#cds|control dependencies}).
 */
export function makeReferenceMaybe(ref: IdentifierReference, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency[] | undefined = undefined): IdentifierReference {
	if(includeDefs) {
		const definitions = ref.name ? resolveByName(ref.name, environments, ref.type) : undefined;
		for(const definition of definitions ?? []) {
			if(definition.type !== ReferenceType.BuiltInFunction && definition.type !== ReferenceType.BuiltInConstant) {
				if(definition.cds) {
					appToCdsUnique(definition.cds, defaultCd);
				} else {
					definition.cds = defaultCd ? Array.from(defaultCd) : [];
				}
			}
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