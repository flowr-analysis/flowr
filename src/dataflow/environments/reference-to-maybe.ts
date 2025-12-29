import type { IdentifierReference } from './identifier';
import { ReferenceType } from './identifier';
import type { DataflowGraph } from '../graph/graph';
import type { ControlDependency } from '../info';
import type { REnvironmentInformation } from './environment';
import { resolveByName } from './resolve-by-name';

function appToCdsUnique(target: ControlDependency[], toAdd: readonly ControlDependency[] | undefined): void{
	if(toAdd) {
		target.push(...toAdd.filter(c => !target.find(tc => tc.id === c.id && tc.when === c.when)));
	}
}

function concatCdsUnique(target: ControlDependency[], toAdd: readonly ControlDependency[] | undefined): ControlDependency[] {
	if(toAdd) {
		return target.concat(toAdd.filter(c => !target.find(tc => tc.id === c.id && tc.when === c.when)));
	} else {
		return target;
	}
}

/**
 * Marks the reference as maybe (i.e., as controlled by a set of {@link IdentifierReference#controlDependencies|control dependencies}).
 */
export function makeReferenceMaybe(ref: IdentifierReference, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency[] | undefined = undefined): IdentifierReference {
	if(includeDefs) {
		const definitions = ref.name ? resolveByName(ref.name, environments, ref.type) : undefined;
		for(const definition of definitions ?? []) {
			if(definition.type !== ReferenceType.BuiltInFunction && definition.type !== ReferenceType.BuiltInConstant) {
				if(definition.controlDependencies) {
					appToCdsUnique(definition.controlDependencies, defaultCd);
				} else {
					definition.controlDependencies = defaultCd ? Array.from(defaultCd) : [];
				}
			}
		}
	}
	const node = graph.getVertex(ref.nodeId, true);
	if(node) {
		if(node.cds) {
			appToCdsUnique(node.cds, defaultCd);
		} else {
			node.cds = defaultCd ? Array.from(defaultCd) : [];
		}
	}
	if(ref.controlDependencies) {
		if(defaultCd) {
			return { ...ref, controlDependencies: concatCdsUnique(ref.controlDependencies, defaultCd) };
		}
	} else {
		return { ...ref, controlDependencies: defaultCd ? Array.from(defaultCd) : [] };
	}
	return ref;
}

/**
 * Marks all references as maybe (i.e., as controlled by a set of {@link IdentifierReference#controlDependencies|control dependencies}).
 * @see {@link makeReferenceMaybe}
 */
export function makeAllMaybe(references: readonly IdentifierReference[] | undefined, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, applyCds: ControlDependency[] | undefined = undefined): IdentifierReference[] {
	return references?.map(ref => makeReferenceMaybe(ref, graph, environments, includeDefs, applyCds)) ?? [];
}