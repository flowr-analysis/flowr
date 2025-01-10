import type {
	FlowrSearchGeneratorNodeBase,
	FlowrSearchGetFilters,
	FlowrSearchInput
} from '../flowr-search';
import { FlowrSearchElements
} from '../flowr-search';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { TailTypesOrUndefined } from '../../util/arrays';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SlicingCriteria } from '../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../slicing/criterion/parse';

/**
 * This is a union of all possible generator node types
 */
export type FlowrSearchGeneratorNode = {
    [K in GeneratorNames]:
    FlowrSearchGeneratorNodeBase<K,
        TailTypesOrUndefined<Parameters<typeof generators[K]>>
    >
}[GeneratorNames]

export type GeneratorNames = keyof typeof generators;

export type GetGenerator<Name extends GeneratorNames> = FlowrSearchGeneratorNode & { name: Name }


/**
 * All supported generators!
 */
export const generators = {
	all:       generateAll,
	get:       generateGet,
	criterion: generateCriterion
} as const;

function generateAll(data: FlowrSearchInput<Pipeline>): FlowrSearchElements<ParentInformation> {
	return new FlowrSearchElements([...data.normalize.idMap.values()].map(node => ({ node })));
}

function generateGet(data: FlowrSearchInput<Pipeline>, filter: FlowrSearchGetFilters): FlowrSearchElements<ParentInformation> {
	/* TODO: */
	return generators.all(data);
}

// TODO: allow to filter for a single criteria
function generateCriterion(data: FlowrSearchInput<Pipeline>, criterion: SlicingCriteria): FlowrSearchElements<ParentInformation> {
	return new FlowrSearchElements(
		criterion.map(c => ({ node: data.normalize.idMap.get(slicingCriterionToId(c, data.normalize.idMap)) as RNodeWithParent }))
	);
}

export function getGenerator<Name extends GeneratorNames>(name: Name): typeof generators[Name] {
	if(!generators[name]) {
		throw new Error(`Unknown generator: ${name}`);
	}
	return generators[name];
}

