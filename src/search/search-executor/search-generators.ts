import type { FlowrSearchGeneratorNodeBase, FlowrSearchGetFilters, FlowrSearchInput } from '../flowr-search';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { TailTypesOrUndefined } from '../../util/arrays';

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
	all: generateAll,
	get: generateGet
} as const;

function generateAll(data: FlowrSearchInput<Pipeline>) {
	return [...data.normalize.idMap.values()].map(node => ({ node }));
}

function generateGet(data: FlowrSearchInput<Pipeline>, filter: FlowrSearchGetFilters) {
	/* TODO: */
	return generators.all(data);
}
