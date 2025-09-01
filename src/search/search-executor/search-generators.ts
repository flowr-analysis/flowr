import type {
	FlowrSearchElement,
	FlowrSearchElementFromQuery,
	FlowrSearchGeneratorNodeBase,
	FlowrSearchGetFilter
} from '../flowr-search';
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
import type { FlowrAnalysisInput } from '../../project/flowr-analyzer';

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

async function generateAll(data: FlowrAnalysisInput): Promise<FlowrSearchElements<ParentInformation>> {
	return new FlowrSearchElements((await getAllNodes(data))
		.map(node => ({ node })));
}

async function getAllNodes(data: FlowrAnalysisInput): Promise<RNodeWithParent[]> {
	const normalize = await data.normalizedAst();
	return [...new Map([...normalize.idMap.values()].map(n => [n.info.id, n]))
		.values()];
}


async function generateGet(input: FlowrAnalysisInput, { filter: { line, column, id, name, nameIsRegex } }: { filter: FlowrSearchGetFilter }): Promise<FlowrSearchElements<ParentInformation>> {
	const normalize = await input.normalizedAst();
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

function generateFrom(_input: FlowrAnalysisInput, args: { from: FlowrSearchElement<ParentInformation> | FlowrSearchElement<ParentInformation>[] }): FlowrSearchElements<ParentInformation> {
	return new FlowrSearchElements(Array.isArray(args.from) ? args.from : [args.from]);
}

async function generateFromQuery(input: FlowrAnalysisInput, args: {
	from: readonly Query[]
}): Promise<FlowrSearchElements<ParentInformation, FlowrSearchElementFromQuery<ParentInformation>[]>> {
	const nodes = new Set<FlowrSearchElementFromQuery<ParentInformation>>();
	const result = await executeQueries({ input }, args.from);
	for(const [query, content] of Object.entries(result)) {
		if(query === '.meta') {
			continue;
		}
		const queryDef = SupportedQueries[query as Query['type']] as SupportedQuery<Query['type']>;
		for(const node of queryDef.flattenInvolvedNodes(content as BaseQueryResult)) {
			nodes.add({
				node:        (await input.normalizedAst()).idMap.get(node) as RNode<ParentInformation>,
				query:       query as Query['type'],
				queryResult: content as BaseQueryResult
			});
		}
	}
	return new FlowrSearchElements([...nodes]);
}

async function generateCriterion(input: FlowrAnalysisInput, args: { criterion: SlicingCriteria }): Promise<FlowrSearchElements<ParentInformation>> {
	const idMap = (await input.normalizedAst()).idMap;
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
