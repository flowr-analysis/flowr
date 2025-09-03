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

export const Unknown = 'unknown';

export interface DependencyCategorySettings {
    queryDisplayName:    string
    defaultFunctions:    FunctionInfo[]
    defaultValue:        string | undefined
    additionalAnalysis?: (data: BasicQueryData, ignoreDefault: boolean, functions: FunctionInfo[], queryResults: CallContextQueryResult, result: DependencyInfo[]) => void
}

export const DependencyCategories = {
	'library': {
		queryDisplayName:   'Libraries',
		defaultFunctions:   LibraryFunctions,
		defaultValue:       Unknown,
		/* for libraries, we have to additionally track all uses of `::` and `:::`, for this we currently simply traverse all uses */
		additionalAnalysis: (data, ignoreDefault, _functions, _queryResults, result) => {
			if(!ignoreDefault) {
				visitAst(data.ast.ast, n => {
					if(n.type === RType.Symbol && n.namespace) {
						/* we should improve the identification of ':::' */
						result.push({
							nodeId:       n.info.id,
							functionName: (n.info.fullLexeme ?? n.lexeme).includes(':::') ? ':::' : '::',
							value:        n.namespace,
						});
					}
				});
			}
		}
	},
	'source': {
		queryDisplayName: 'Sourced Files',
		defaultFunctions: SourceFunctions,
		defaultValue:     Unknown
	},
	'read': {
		queryDisplayName: 'Read Data',
		defaultFunctions: ReadFunctions,
		defaultValue:     Unknown
	},
	'write': {
		queryDisplayName: 'Written Data',
		defaultFunctions: WriteFunctions,
		defaultValue:     'stdout'
	},
	'visualize': {
		queryDisplayName: 'Visualizations',
		defaultFunctions: VisualizeFunctions,
		defaultValue:     undefined
	}
} as const satisfies Record<string, DependencyCategorySettings>;
export type DependencyCategoryName = keyof typeof DependencyCategories;

export type DependenciesQuery = BaseQueryFormat & {
    readonly type:                    'dependencies'
    readonly enabledCategories?:      DependencyCategoryName[]
    readonly ignoreDefaultFunctions?: boolean
} & { [C in `${keyof typeof DependencyCategories}Functions`]?: FunctionInfo[] }

export type DependenciesQueryResult = BaseQueryResult & { [C in DependencyCategoryName]: DependencyInfo[] }


export interface DependencyInfo extends Record<string, unknown>{
    nodeId:         NodeId
    functionName:   string
    linkedIds?:     readonly NodeId[]
	/** the lexeme is presented whenever the specific info is of {@link Unknown} */
	lexemeOfArgument?: string;
    /** The library name, file, source, destination etc. being sourced, read from, or written to. */
    value?:         string
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
		result.push(infos.map(i => `           ╰ Node Id: ${i.nodeId}${i.value !== undefined ? `, \`${i.value}\`` : ''}`).join('\n'));
	}
}

const functionInfoSchema: Joi.ArraySchema = Joi.array().items(Joi.object({
	name:    Joi.string().required().description('The name of the library function.'),
	package: Joi.string().optional().description('The package name of the library function'),
	argIdx:  Joi.number().optional().description('The index of the argument that contains the library name.'),
	argName: Joi.string().optional().description('The name of the argument that contains the library name.'),
})).optional();

export const DependenciesQueryDefinition = {
	executor:        executeDependenciesQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as DependenciesQueryResult;
		result.push(`Query: ${bold('dependencies', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [category, value] of Object.entries(DependencyCategories)) {
			printResultSection(value.queryDisplayName, out[category as DependencyCategoryName], result);
		}
		return true;
	},
	schema: Joi.object({
		type:                   Joi.string().valid('dependencies').required().description('The type of the query.'),
		ignoreDefaultFunctions: Joi.boolean().optional().description('Should the set of functions that are detected by default be ignored/skipped? Defaults to false.'),
		...Object.fromEntries(Object.keys(DependencyCategories).map(c => [`${c}Functions`, functionInfoSchema.description(`The set of ${c} functions to search for.`)])),
		enabledCategories:      Joi.array().optional().items(
			Joi.string().valid(...Object.keys(DependencyCategories))
		).description('A set of flags that determines what types of dependencies are searched for. If unset or empty, all dependency types are searched for.'),
	}).description('The dependencies query retrieves and returns the set of all dependencies in the dataflow graph, which includes libraries, sourced files, read data, and written data.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as DependenciesQueryResult;
		return Object.keys(DependencyCategories).flatMap(c => out[c as DependencyCategoryName]).map(o => o.nodeId);
	}
} as const satisfies SupportedQuery<'dependencies'>;
