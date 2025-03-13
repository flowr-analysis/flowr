import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';
import { executeDependenciesQuery } from './dependencies-query-executor';
import type { FunctionInfo } from './function-info/function-info';

export const Unknown = 'unknown';

export interface DependenciesQuery extends BaseQueryFormat {
    readonly type:                    'dependencies'
    readonly ignoreDefaultFunctions?: boolean
    readonly libraryFunctions?:       FunctionInfo[]
    readonly sourceFunctions?:        FunctionInfo[]
    readonly readFunctions?:          FunctionInfo[]
    readonly writeFunctions?:         FunctionInfo[]
}

export interface DependenciesQueryResult extends BaseQueryResult {
    libraries:    LibraryInfo[]
    sourcedFiles: SourceInfo[]
    readData:     ReadInfo[]
    writtenData:  WriteInfo[]
}

export interface DependencyInfo extends Record<string, unknown>{
    nodeId:         NodeId
    functionName:   string
    linkedIds?:     readonly NodeId[]
	/** the lexeme is presented whenever the specific info is of {@link Unknown} */
	lexemeOfArgument?: string;
}
export type LibraryInfo = (DependencyInfo & { libraryName: 'unknown' | string })
export type SourceInfo = (DependencyInfo & { file: string })
export type ReadInfo = (DependencyInfo & { source: string })
export type WriteInfo = (DependencyInfo & { destination: 'stdout' | string })

function printResultSection<T extends DependencyInfo>(title: string, infos: T[], result: string[], sectionSpecifics: (info: T) => string): void {
	if(infos.length <= 0) {
		return;
	}
	result.push(`   ╰ ${title}`);
	const grouped = infos.reduce(function(groups: Map<string, T[]>, i) {
		const array = groups.get(i.functionName);
		if(array) {
			array.push(i);
		} else {
			groups.set(i.functionName, [i]);
		}
		return groups;
	}, new Map<string, T[]>());
	for(const [functionName, infos] of grouped) {
		result.push(`       ╰ \`${functionName}\``);
		result.push(infos.map(i => `           ╰ Node Id: ${i.nodeId}, ${sectionSpecifics(i)}`).join('\n'));
	}
}

const functionInfoSchema: Joi.ArraySchema = Joi.array().items(Joi.object({
	name:    Joi.string().required().description('The name of the library function.'),
	package: Joi.string().required().description('The package name of the library function'),
	argIdx:  Joi.number().optional().description('The index of the argument that contains the library name.'),
	argName: Joi.string().optional().description('The name of the argument that contains the library name.'),
})).optional();

export const DependenciesQueryDefinition = {
	executor:        executeDependenciesQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'dependencies'>['dependencies'];
		result.push(`Query: ${bold('dependencies', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		printResultSection('Libraries', out.libraries, result, l => `\`${l.libraryName}\``);
		printResultSection('Sourced Files', out.sourcedFiles, result, s => `\`${s.file}\``);
		printResultSection('Read Data', out.readData, result, r => `\`${r.source}\``);
		printResultSection('Written Data', out.writtenData, result, w => `\`${w.destination}\``);
		return true;
	},
	schema: Joi.object({
		type:                   Joi.string().valid('dependencies').required().description('The type of the query.'),
		ignoreDefaultFunctions: Joi.boolean().optional().description('Should the set of functions that are detected by default be ignored/skipped?'),
		libraryFunctions:       functionInfoSchema.description('The set of library functions to search for.'),
		sourceFunctions:        functionInfoSchema.description('The set of source functions to search for.'),
		readFunctions:          functionInfoSchema.description('The set of data reading functions to search for.'),
		writeFunctions:         functionInfoSchema.description('The set of data writing functions to search for.'),
	}).description('The dependencies query retrieves and returns the set of all dependencies in the dataflow graph, which includes libraries, sourced files, read data, and written data.')
} as const satisfies SupportedQuery<'dependencies'>;
