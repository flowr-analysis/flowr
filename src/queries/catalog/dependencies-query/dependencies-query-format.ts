import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SupportedQuery } from '../../query';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { executeDependenciesQuery } from './dependencies-query-executor';
import type { FunctionInfo } from './function-info/function-info';
import { LibraryFunctions } from './function-info/library-functions';
import { SourceFunctions } from './function-info/source-functions';
import { ReadFunctions } from './function-info/read-functions';
import { WriteFunctions } from './function-info/write-functions';
import { VisualizeFunctions } from './function-info/visualize-functions';
import { visitAst } from '../../../r-bridge/lang-4.x/ast/model/processing/visitor';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { CallContextQueryResult } from '../call-context-query/call-context-query-format';
import type { Range } from 'semver';

export const Unknown = 'unknown';

export interface DependencyCategorySettings {
    queryDisplayName?:   string
    functions:           FunctionInfo[]
    defaultValue?:       string
    additionalAnalysis?: (data: BasicQueryData, ignoreDefault: boolean, functions: FunctionInfo[], queryResults: CallContextQueryResult, result: DependencyInfo[]) => void
}

export const DefaultDependencyCategories = {
	'library': {
		queryDisplayName:   'Libraries',
		functions:          LibraryFunctions,
		defaultValue:       Unknown,
		/* for libraries, we have to additionally track all uses of `::` and `:::`, for this we currently simply traverse all uses */
		additionalAnalysis: async(data, ignoreDefault, _functions, _queryResults, result) => {
			if(!ignoreDefault) {
				visitAst((await data.input.normalizedAst()).ast, n => {
					if(n.type === RType.Symbol && n.namespace) {
						/* we should improve the identification of ':::' */
						result.push({
							nodeId:       n.info.id,
							functionName: (n.info.fullLexeme ?? n.lexeme).includes(':::') ? ':::' : '::',
							value:        n.namespace,
							libraryInfo:  data.libraries ?? undefined,
						});
					}
				});
			}
		}
	},
	'source': {
		queryDisplayName: 'Sourced Files',
		functions:        SourceFunctions,
		defaultValue:     Unknown
	},
	'read': {
		queryDisplayName: 'Read Data',
		functions:        ReadFunctions,
		defaultValue:     Unknown
	},
	'write': {
		queryDisplayName: 'Written Data',
		functions:        WriteFunctions,
		defaultValue:     'stdout'
	},
	'visualize': {
		queryDisplayName: 'Visualizations',
		functions:        VisualizeFunctions
	}
} as const satisfies Record<string, DependencyCategorySettings>;
export type DefaultDependencyCategoryName = keyof typeof DefaultDependencyCategories;
export type DependencyCategoryName = DefaultDependencyCategoryName | string;

export interface DependenciesQuery extends BaseQueryFormat, Partial<Record<`${DefaultDependencyCategoryName}Functions`, FunctionInfo[]>> {
    readonly type:                    'dependencies'
    readonly enabledCategories?:      DependencyCategoryName[]
    readonly ignoreDefaultFunctions?: boolean
    readonly additionalCategories?:   Record<string, Omit<DependencyCategorySettings, 'additionalAnalysis'>>
}

export type DependenciesQueryResult = BaseQueryResult & { [C in DefaultDependencyCategoryName]: DependencyInfo[] } & { [S in string]?: DependencyInfo[] }


export interface DependencyInfo extends Record<string, unknown>{
    nodeId:           NodeId
    functionName:     string
    linkedIds?:       readonly NodeId[]
	/** the lexeme is presented whenever the specific info is of {@link Unknown} */
	lexemeOfArgument?:   string;
    /** The library name, file, source, destination etc. being sourced, read from, or written to. */
    value?:           string
	versionConstraints?: Range[],
	derivedVersion?:     Range
}

function printResultSection(title: string, infos: DependencyInfo[], result: string[]): void {
	if(infos.length <= 0) {
		return;
	}
	result.push(`   ╰ ${title}`);
	const grouped = infos.reduce(function(groups: Map<string, DependencyInfo[]>, i) {
		const array = groups.get(i.functionName);
		if(array) {
			array.push(i);
		} else {
			groups.set(i.functionName, [i]);
		}
		return groups;
	}, new Map<string, DependencyInfo[]>());
	for(const [functionName, infos] of grouped) {
		result.push(`       ╰ \`${functionName}\``);
		result.push(infos.map(i => `           ╰ Node Id: ${i.nodeId}${i.value !== undefined ? `, \`${i.value}\`` : ''}${i.derivedVersion !== undefined ? `, Version: \`${i.derivedVersion.toString()}\`` : ''}`).join('\n'));
	}
}

export function getAllCategories(queries: readonly DependenciesQuery[]): Record<DependencyCategoryName, DependencyCategorySettings> {
	let categories = DefaultDependencyCategories;
	for(const query of queries) {
		if(query.additionalCategories) {
			categories = { ...categories, ...query.additionalCategories };
		}
	}
	return categories;
}

const functionInfoSchema: Joi.ArraySchema = Joi.array().items(Joi.object({
	name:    Joi.string().required().description('The name of the library function.'),
	package: Joi.string().optional().description('The package name of the library function'),
	argIdx:  Joi.number().optional().description('The index of the argument that contains the library name.'),
	argName: Joi.string().optional().description('The name of the argument that contains the library name.'),
})).optional();

export const DependenciesQueryDefinition = {
	executor:        executeDependenciesQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result, queries) => {
		const out = queryResults as DependenciesQueryResult;
		result.push(`Query: ${bold('dependencies', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [category, value] of Object.entries(getAllCategories(queries as DependenciesQuery[]))) {
			printResultSection(value.queryDisplayName ?? category, out[category] ?? [], result);
		}
		return true;
	},
	schema: Joi.object({
		type:                   Joi.string().valid('dependencies').required().description('The type of the query.'),
		ignoreDefaultFunctions: Joi.boolean().optional().description('Should the set of functions that are detected by default be ignored/skipped? Defaults to false.'),
		...Object.fromEntries(Object.keys(DefaultDependencyCategories).map(c => [`${c}Functions`, functionInfoSchema.description(`The set of ${c} functions to search for.`)])),
		enabledCategories:      Joi.array().optional().items(
			Joi.string().valid(...Object.keys(DefaultDependencyCategories))
		).description('A set of flags that determines what types of dependencies are searched for. If unset or empty, all dependency types are searched for.'),
		additionalCategories: Joi.object().allow(Joi.object({
			queryDisplayName: Joi.string().description('The display name in the query result.'),
			functions:        functionInfoSchema.description('The functions that this additional category should search for.'),
			defaultValue:     Joi.string().description('The default value to return when there is no value to gather from the function information.').optional()
		})).description('A set of additional, user-supplied dependency categories, whose results will be included in the query return value.').optional()
	}).description('The dependencies query retrieves and returns the set of all dependencies in the dataflow graph, which includes libraries, sourced files, read data, and written data.'),
	flattenInvolvedNodes: (queryResults, query): NodeId[] => {
		const out = queryResults as DependenciesQueryResult;
		return Object.keys(getAllCategories(query as DependenciesQuery[])).flatMap(c => out[c] ?? []).map(o => o.nodeId);
	}
} as const satisfies SupportedQuery<'dependencies'>;
