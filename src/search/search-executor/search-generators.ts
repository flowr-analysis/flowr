import type {
	FlowrSearchElement,
	FlowrSearchGeneratorNodeBase,
	FlowrSearchGetFilter,
	FlowrSearchInput
} from '../flowr-search';
import { FlowrSearchElements } from '../flowr-search';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { TailTypesOrUndefined } from '../../util/collections/arrays';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SlicingCriteria } from '../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../slicing/criterion/parse';
import { isNotUndefined } from '../../util/assert';
import type { Query, SupportedQuery, SynchronousQuery } from '../../queries/query';
import { executeQueries, SupportedQueries } from '../../queries/query';
import type { BaseQueryResult } from '../../queries/base-query-format';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { enrichElement, Enrichment } from './search-enrichers';

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
	all:          generateAll,
	get:          generateGet,
	criterion:    generateCriterion,
	from:         generateFrom,
	'from-query': generateFromQuery
} as const;

function generateAll(data: FlowrSearchInput<Pipeline>): FlowrSearchElements<ParentInformation> {
	return new FlowrSearchElements(getAllNodes(data)
		.map(node => ({ node })));
}

function getAllNodes(data: FlowrSearchInput<Pipeline>): RNodeWithParent[] {
	return [...new Map([... data.normalize.idMap.values()].map(n => [n.info.id, n]))
		.values()];
}


function generateGet(data: FlowrSearchInput<Pipeline>, { filter: { line, column, id, name, nameIsRegex } }: { filter: FlowrSearchGetFilter }): FlowrSearchElements<ParentInformation> {
	let potentials = (id ?
		[data.normalize.idMap.get(id)].filter(isNotUndefined) :
		getAllNodes(data)
	);

	if(line && line < 0) {
		const maxLines = data.normalize.ast.info.fullRange?.[2] ??
			(id ? getAllNodes(data) : potentials).reduce(
				(maxLine, { location }) => location && location[2] > maxLine ? location[2] : maxLine,
				0
			);

		line = maxLines + line + 1;
	}

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

function generateFromQuery(data: FlowrSearchInput<Pipeline>, args: { from: readonly SynchronousQuery[] } ): FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]> {
	const result = executeQueries({ ast: data.normalize, dataflow: data.dataflow, config: data.config }, args.from);

	// collect involved nodes
	const nodesByQuery = new Map<Query['type'], Set<FlowrSearchElement<ParentInformation>>>();
	for(const [query, content] of Object.entries(result)) {
		if(query === '.meta') {
			continue;
		}
		const nodes = new Set<FlowrSearchElement<ParentInformation>>();
		const queryDef = SupportedQueries[query as Query['type']] as SupportedQuery<Query['type']>;
		for(const node of queryDef.flattenInvolvedNodes(content as BaseQueryResult)) {
			nodes.add({ node: data.normalize.idMap.get(node) as RNode<ParentInformation> });
		}
		nodesByQuery.set(query as Query['type'], nodes);
	}

	// enrich elements with query data
	const elements = new FlowrSearchElements([...nodesByQuery].flatMap(([_, nodes]) => [...nodes])).enrich(data, Enrichment.QueryData, { queries: result });
	return elements.mutate(s => s.map(e => {
		const [query, _] = [...nodesByQuery].find(([_, nodes]) => nodes.has(e)) as [Query['type'], Set<FlowrSearchElement<ParentInformation>>];
		return enrichElement(e, elements, data, Enrichment.QueryData, { query });
	})) as unknown as FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]>;
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
