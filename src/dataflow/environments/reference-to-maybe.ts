import type { IdentifierReference } from './identifier';
import { ReferenceType } from './identifier';
import type { DataflowGraph } from '../graph/graph';
import type { ControlDependency } from '../info';
import type { REnvironmentInformation } from './environment';
import { resolveByName } from './resolve-by-name';

/**
 * Marks the reference as maybe (i.e., as controlled by a set of {@link IdentifierReference#controlDependencies|control dependencies}).
 */
export function makeReferenceMaybe(ref: IdentifierReference, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency | undefined = undefined): IdentifierReference {
	if(includeDefs) {
		const definitions = ref.name ? resolveByName(ref.name, environments, ref.type) : undefined;
		for(const definition of definitions ?? []) {
			if(definition.type !== ReferenceType.BuiltInFunction && definition.type !== ReferenceType.BuiltInConstant) {
				if(definition.controlDependencies) {
					if(defaultCd && !definition.controlDependencies.find(c => c.id === defaultCd.id && c.when === defaultCd.when)) {
						definition.controlDependencies.push(defaultCd);
					}
				} else {
					definition.controlDependencies = defaultCd ? [defaultCd] : [];
				}
			}
		}
	}
	const node = graph.getVertex(ref.nodeId, true);
	if(node) {
		if(node.cds) {
			if(defaultCd && !node.cds.find(c => c.id === defaultCd.id && c.when === defaultCd.when)) {
				node.cds.push(defaultCd);
			}
		} else {
			node.cds = defaultCd ? [defaultCd] : [];
		}
	}
	if(ref.controlDependencies) {
		if(defaultCd && !ref.controlDependencies.find(c => c.id === defaultCd.id && c.when === defaultCd.when)) {
			return { ...ref, controlDependencies: (ref.controlDependencies ?? []).concat(defaultCd ? [defaultCd] : []) };
		}
	} else {
		return { ...ref, controlDependencies: ref.controlDependencies ?? (defaultCd ? [defaultCd] : []) };
	}
	return ref;
}

/**
 * Marks all references as maybe (i.e., as controlled by a set of {@link IdentifierReference#controlDependencies|control dependencies}).
 * @see {@link makeReferenceMaybe}
 */
export function makeAllMaybe(references: readonly IdentifierReference[] | undefined, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency | undefined = undefined): IdentifierReference[] {
	return references?.map(ref => makeReferenceMaybe(ref, graph, environments, includeDefs, defaultCd)) ?? [];
}