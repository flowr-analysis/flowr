import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SupportedQuery } from '../../query';
import { bold, faint, type OutputFormatter } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { executeDependenciesQuery } from './dependencies-query-executor';
import type { FunctionInfo } from './function-info/function-info';
import { LibraryFunctions } from './function-info/library-functions';
import { SourceFunctions } from './function-info/source-functions';
import { RemoteFunctions, remoteTarget } from './function-info/remote-functions';
import { ReadFunctions } from './function-info/read-functions';
import { WriteFunctions } from './function-info/write-functions';
import { VisualizeFunctions } from './function-info/visualize-functions';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { CallContextQueryResult } from '../call-context-query/call-context-query-format';
import type { Range } from 'semver';
import type { AsyncOrSync, MarkOptional } from 'ts-essentials';
import type { NamespaceInfo } from '../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { ExpectFunctionNames, TestFunctions } from './function-info/test-functions';
import type { BrandedNamespace } from '../../../dataflow/environments/identifier';
import { Identifier } from '../../../dataflow/environments/identifier';
import { RProject } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { compactRecord } from '../../../util/objects';
import { queryFnProps } from '../../../dataflow/environments/query-fn-props';
import { CallProp } from '../../../dataflow/environments/built-in-props';
import { VertexType } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';

/** The value could not be resolved, e.g. a path assembled at runtime. Such a dependency may be missing or fetchable. */
export const Unknown = 'unknown';
/** The value resolved, but to data given inline rather than to a path (`matrix(0, 2, 2)`, `data.frame(a = 1)`). */
export const Constant = 'constant';

export interface DependencyCategorySettings {
	queryDisplayName?:   string
	functions:           FunctionInfo[]
	/** this describes the global default value for this category, e.g., 'stdout' for write operations, please be aware, that this can be overwritten by a by-function default value */
	defaultValue?:       string
	/**
	 * An optional additional analysis step that is executed after the main function-based analysis has been performed.
	 * To add or modify dependency info entries, simply modify the `result` array.
	 * @param data  - The basic query data.
	 * @param ignoreDefault - Whether the default functions were ignored.
	 * @param functions - The functions used for this category.
	 * @param queryResults - The results of the call context query.
	 * @param result - The current result array to which additional dependency info can be added.
	 */
	additionalAnalysis?: (data: BasicQueryData, ignoreDefault: boolean, functions: FunctionInfo[], queryResults: CallContextQueryResult, result: DependencyInfo[]) => AsyncOrSync<void>
}

export const DefaultDependencyCategories = {
	'library': {
		queryDisplayName:   'Libraries',
		functions:          LibraryFunctions,
		defaultValue:       Unknown,
		/* for libraries, we have to additionally track all uses of `::` and `:::`, for this we currently simply traverse all uses */
		additionalAnalysis: async(data, ignoreDefault, _functions, _queryResults, result) => {
			if(!ignoreDefault) {
				RProject.visitAst((await data.analyzer.normalize()).ast, node => {
					let ns: BrandedNamespace | undefined;
					if(node.type === RType.Symbol && (ns = Identifier.getNamespace(node.content)) !== undefined) {
						const dep = data.analyzer.inspectContext().deps.getDependency(ns);
						/* we should improve the identification of ':::' */
						result.push({
							nodeId:             node.info.id,
							functionName:       RNode.lexeme(node).includes(':::') ? ':::' : '::',
							value:              ns,
							versionConstraints: dep?.versionConstraints,
							derivedRange:       dep?.effectiveRange,
							namespaceInfo:      dep?.namespaceInfo
						});
					}
				});
			}
		}
	},
	'remote': {
		queryDisplayName:   'Remote Installs',
		functions:          RemoteFunctions,
		defaultValue:       Unknown,
		/* the value is the reference as written, which names the package only implicitly */
		additionalAnalysis: (_data, _ignoreDefault, _functions, _queryResults, result) => {
			for(const [at, info] of result.entries()) {
				const target = remoteTarget(info.value);
				if(target !== undefined) {
					result[at] = { ...info, ...target };
				}
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
	'print': {
		queryDisplayName:   'Auto-printed Results',
		functions:          [],
		defaultValue:       'stdout',
		additionalAnalysis: async(data, ignoreDefault, _functions, queryResults, result) => {
			if(ignoreDefault) {
				return;
			}
			const [{ ast }, dataflow] = await Promise.all([data.analyzer.normalize(), data.analyzer.dataflow()]);
			const accountedFor = new Set(Object.values(queryResults?.kinds ?? {})
				.flatMap(k => Object.values(k.subkinds).flat()).map(r => r.id));
			for(const file of ast.files) {
				for(const statement of file.root.children) {
					if(statement.type !== RType.FunctionCall || accountedFor.has(statement.info.id)) {
						continue;
					}
					const vertex = dataflow.graph.getVertex(statement.info.id);
					const functionName = vertex?.tag === VertexType.FunctionCall
						? Dataflow.qualify(statement.info.id, dataflow.graph, false) ?? vertex.name : undefined;
					if(functionName === undefined) {
						continue;
					}
					const props = queryFnProps(functionName, { environment: dataflow.environment })?.props ?? 0;
					if((props & (CallProp.Invisible | CallProp.Graphics)) !== 0 || ExpectFunctionNames.test(Identifier.getName(functionName))) {
						continue;
					}
					result.push({ nodeId: statement.info.id, functionName, value: 'stdout' });
				}
			}
		}
	},
	'visualize': {
		queryDisplayName: 'Visualizations',
		functions:        VisualizeFunctions
	},
	'test': {
		queryDisplayName: 'Tests',
		functions:        TestFunctions
	}
} as const satisfies Record<string, DependencyCategorySettings>;
export type DefaultDependencyCategoryName = keyof typeof DefaultDependencyCategories;
export type DependencyCategoryName = DefaultDependencyCategoryName | string;

export interface DependenciesQuery extends BaseQueryFormat, Partial<Record<`${DefaultDependencyCategoryName}Functions`, FunctionInfo[]>> {
	readonly type:                    'dependencies'
	readonly enabledCategories?:      DependencyCategoryName[]
	readonly ignoreDefaultFunctions?: boolean
	/** Naming a built-in category extends it; use `ignoreDefaultFunctions` to drop the built-in functions. */
	readonly additionalCategories?:   Record<string, MarkOptional<DependencyCategorySettings, 'additionalAnalysis'>>
}

export type DependenciesQueryResult = BaseQueryResult & { [C in DefaultDependencyCategoryName]: DependencyInfo[] } & { [S in string]?: DependencyInfo[] };


export interface DependencyInfo extends Record<string, unknown>{
	nodeId:              NodeId
	/** the called name; an {@link Identifier}, so a namespaced call like `maps::map` keeps its package */
	functionName:        Identifier
	linkedIds?:          readonly NodeId[]
	/**
	 * The other statements that build this output: for a plot, the addons drawn onto it and, when it lands in a
	 * file, the device opener and closer around it. Answers *which statements produce this output* without
	 * rebuilding it from {@link linkedIds}.
	 */
	parts?:              readonly NodeId[]
	/**
	 * the argument the value was read from, under the id the {@link InputSourcesQuery} reports it with: ask that
	 * query about {@link nodeId} and this entry of its answer says whether the value is a glob, a prompt, ...
	 */
	argumentId?:         NodeId
	/** the lexeme is presented whenever the specific info is {@link Unknown} or {@link Constant} */
	lexemeOfArgument?:   string;
	/** The library name, file, source, destination etc. being sourced, read from, or written to. */
	value?:              string
	versionConstraints?: readonly Range[],
	derivedRange?:       Range,
	namespaceInfo?:      NamespaceInfo,
	/** the package the dependency provides, when the {@link value} names it only implicitly (a `user/repo` slug, a clone url) */
	packageName?:        string
	/** the revision such a reference pins, the `v1.2` of `user/repo@v1.2` */
	revision?:           string
}

function printResultSection(title: string, infos: DependencyInfo[], result: string[], formatter: OutputFormatter): void {
	if(infos.length <= 0) {
		return;
	}
	result.push(`   ${bold(title, formatter)} ${faint(`(${infos.length})`, formatter)}`);
	// one line per dependency: the value (package/file) up front, its function + node as a faint provenance suffix
	for(const i of infos) {
		const fn = Identifier.getName(i.functionName);
		/* neither names a resource: inline data is resolved but no path, `unknown` is a path we could not resolve */
		const stands = i.value === Constant ? '<inline data>' : i.value === Unknown || i.value === undefined ? '<unresolved>' : undefined;
		const value = stands !== undefined ? faint(stands, formatter) : bold(i.value as string, formatter);
		const version = i.derivedRange !== undefined ? ` ${faint(i.derivedRange.format(), formatter)}` : '';
		const linked = i.linkedIds ? `, linked ${i.linkedIds.join(', ')}` : '';
		result.push(`     ${value}${version} ${faint(`via ${fn} (node ${i.nodeId}${linked})`, formatter)}`);
	}
}

/**
 * Gets all dependency categories, including user-defined additional categories.
 * A category named like a built-in one extends it instead of replacing it.
 */
export function getAllCategories(queries: readonly DependenciesQuery[]): Record<DependencyCategoryName, DependencyCategorySettings> {
	const categories: Record<DependencyCategoryName, DependencyCategorySettings> = { ...DefaultDependencyCategories };
	for(const query of queries) {
		for(const [name, settings] of Object.entries(query.additionalCategories ?? {})) {
			const known = categories[name];
			categories[name] = known === undefined ? settings : {
				...known,
				...compactRecord(settings),
				functions: [...known.functions, ...settings.functions]
			};
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
	title:           'Dependencies Query',
	executor:        executeDependenciesQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result, queries) => {
		const out = queryResults as DependenciesQueryResult;
		result.push(`Query: ${bold('dependencies', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [category, value] of Object.entries(getAllCategories(queries as DependenciesQuery[]))) {
			printResultSection(value.queryDisplayName ?? category, out[category] ?? [], result, formatter);
		}
		return true;
	},
	schema: Joi.object({
		type:                   Joi.string().valid('dependencies').required().description('The type of the query.'),
		ignoreDefaultFunctions: Joi.boolean().optional().description('Should the set of functions that are detected by default be ignored/skipped? Defaults to false.'),
		...Object.fromEntries(Object.keys(DefaultDependencyCategories).map(c => [`${c}Functions`, functionInfoSchema.description(`The set of ${c} functions to search for.`)])),
		enabledCategories:      Joi.array().optional().items(Joi.string()).description('A set of flags that determines what types of dependencies are searched for. If unset, all dependency types are searched for.'),
		additionalCategories:   Joi.object().allow(Joi.object({
			queryDisplayName: Joi.string().description('The display name in the query result.'),
			functions:        functionInfoSchema.description('The functions that this additional category should search for.'),
			defaultValue:     Joi.string().description('The default value to return when there is no value to gather from the function information.').optional()
		})).description('A set of additional, user-supplied dependency categories, whose results will be included in the query return value. Using the name of a built-in category extends it instead of replacing it.').optional()
	}).description('The dependencies query retrieves and returns the set of all dependencies in the dataflow graph, which includes libraries, sourced files, read data, and written data.'),
	flattenInvolvedNodes: (queryResults, query): NodeId[] => {
		const out = queryResults as DependenciesQueryResult;
		return Object.keys(getAllCategories(query as DependenciesQuery[])).flatMap(c => out[c] ?? []).map(o => o.nodeId);
	}
} as const satisfies SupportedQuery<'dependencies'>;
