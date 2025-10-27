import type { FlowrSearchElement, FlowrSearchGeneratorNodeBase, FlowrSearchGetFilter } from '../flowr-search';
import { FlowrSearchElements } from '../flowr-search';
import type { TailTypesOrUndefined } from '../../util/collections/arrays';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SlicingCriteria } from '../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../slicing/criterion/parse';
import { isNotUndefined } from '../../util/assert';
import type { Query, SupportedQuery } from '../../queries/query';
import { executeQueries, SupportedQueries } from '../../queries/query';
import type { BaseQueryResult } from '../../queries/base-query-format';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { enrichElement, Enrichment } from './search-enrichers';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';

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

async function generateAll(data: ReadonlyFlowrAnalysisProvider): Promise<FlowrSearchElements<ParentInformation>> {
	return new FlowrSearchElements((await getAllNodes(data))
		.map(node => ({ node })));
}

async function getAllNodes(data: ReadonlyFlowrAnalysisProvider): Promise<RNodeWithParent[]> {
	const normalize = await data.normalize();
	return [...new Map([...normalize.idMap.values()].map(n => [n.info.id, n]))
		.values()];
}


async function generateGet(input: ReadonlyFlowrAnalysisProvider, { filter: { line, column, id, name, nameIsRegex } }: { filter: FlowrSearchGetFilter }): Promise<FlowrSearchElements<ParentInformation>> {
	const normalize = await input.normalize();
	let potentials = (id ?
		[normalize.idMap.get(id)].filter(isNotUndefined) :
		await getAllNodes(input)
	);

	if(line && line < 0) {
		const maxLines = normalize.ast.info.fullRange?.[2] ??
			(id ? (await getAllNodes(input)) : potentials).reduce(
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

function generateFrom(_input: ReadonlyFlowrAnalysisProvider, args: { from: FlowrSearchElement<ParentInformation> | FlowrSearchElement<ParentInformation>[] }): FlowrSearchElements<ParentInformation> {
	return new FlowrSearchElements(Array.isArray(args.from) ? args.from : [args.from]);
}

async function generateFromQuery(input: ReadonlyFlowrAnalysisProvider, args: {
	from: readonly Query[]
}): Promise<FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]>> {
	const result = await executeQueries({ analyzer: input }, args.from);

	// collect involved nodes
	const nodesByQuery = new Map<Query['type'], Set<FlowrSearchElement<ParentInformation>>>();
	for(const [query, content] of Object.entries(result)) {
		if(query === '.meta') {
			continue;
		}
		const nodes = new Set<FlowrSearchElement<ParentInformation>>();
		const queryDef = SupportedQueries[query as Query['type']] as SupportedQuery<Query['type']>;
		for(const node of queryDef.flattenInvolvedNodes(content as BaseQueryResult, args.from)) {
			nodes.add({ node: (await input.normalize()).idMap.get(node) as RNode<ParentInformation> });
		}
		nodesByQuery.set(query as Query['type'], nodes);
	}

	// enrich elements with query data

	const normalize = await input.normalize();
	const dataflow = await input.dataflow();
	const cfg = await input.controlflow();

	const elements = await new FlowrSearchElements([...nodesByQuery]
		.flatMap(([_, nodes]) => [...nodes]))
		.enrich(input, Enrichment.QueryData, { queries: result });
	return elements.mutate(s => Promise.all(s.map(async e => {
		const [query, _] = [...nodesByQuery].find(([_, nodes]) => nodes.has(e)) as [Query['type'], Set<FlowrSearchElement<ParentInformation>>];
		return await enrichElement(e, elements, { normalize, dataflow, cfg }, Enrichment.QueryData, { query });
	}))) as unknown as FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]>;
}

async function generateCriterion(input: ReadonlyFlowrAnalysisProvider, args: { criterion: SlicingCriteria }): Promise<FlowrSearchElements<ParentInformation>> {
	const idMap = (await input.normalize()).idMap;
	return new FlowrSearchElements(
		args.criterion.map(c => ({ node: idMap.get(slicingCriterionToId(c, idMap)) as RNodeWithParent }))
	);
}

export function getGenerator<Name extends GeneratorNames>(name: Name): typeof generators[Name] {
	if(!generators[name]) {
		throw new Error(`Unknown generator: ${name}`);
	}
	return generators[name];
}
