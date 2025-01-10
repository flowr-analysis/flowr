import type {
	FlowrSearchElement,
	FlowrSearchGeneratorNodeBase,
	FlowrSearchGetFilter,
	FlowrSearchInput
} from '../flowr-search';
import { FlowrSearchElements
} from '../flowr-search';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { TailTypesOrUndefined } from '../../util/arrays';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SlicingCriteria } from '../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../slicing/criterion/parse';
import { isNotUndefined } from '../../util/assert';

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
	criterion: generateCriterion,
	from:      generateFrom
} as const;

function generateAll(data: FlowrSearchInput<Pipeline>): FlowrSearchElements<ParentInformation> {
	return new FlowrSearchElements([...data.normalize.idMap.values()].map(node => ({ node })));
}


function generateGet(data: FlowrSearchInput<Pipeline>, { filter: { line, column, id, name, nameIsRegex } }: { filter: FlowrSearchGetFilter }): FlowrSearchElements<ParentInformation> {
	let potentials = (id ? [data.normalize.idMap.get(id)] : [...data.normalize.idMap.values()]).filter(isNotUndefined);

	if(line && column) {
		potentials = potentials.filter(({ location }: RNodeWithParent) => location?.[0] === line && location?.[1] === column);
	} else if(line) {
		potentials = potentials.filter(({ location }: RNodeWithParent) => location?.[0] === line);
	} else if(column) {
		potentials = potentials.filter(({ location }: RNodeWithParent) => location?.[1] === column);
	}
	if(nameIsRegex && name) {
		const nameFilter = new RegExp(name);
		potentials = potentials.filter(({ lexeme }: RNodeWithParent) => lexeme && nameFilter.test(lexeme));
	} else if(name) {
		potentials = potentials.filter(({ lexeme }: RNodeWithParent) => lexeme === name);
	}
	return new FlowrSearchElements(potentials.map(node => ({ node })));
}

function generateFrom(data: FlowrSearchInput<Pipeline>, args: { from: FlowrSearchElement<ParentInformation> | FlowrSearchElement<ParentInformation>[] }): FlowrSearchElements<ParentInformation> {
	return new FlowrSearchElements(Array.isArray(args.from) ? args.from : [args.from]);
}

function generateCriterion(data: FlowrSearchInput<Pipeline>, args: { criterion: SlicingCriteria }): FlowrSearchElements<ParentInformation> {
	return new FlowrSearchElements(
		args.criterion.map(c => ({ node: data.normalize.idMap.get(slicingCriterionToId(c, data.normalize.idMap)) as RNodeWithParent }))
	);
}

export function getGenerator<Name extends GeneratorNames>(name: Name): typeof generators[Name] {
	if(!generators[name]) {
		throw new Error(`Unknown generator: ${name}`);
	}
	return generators[name];
}

