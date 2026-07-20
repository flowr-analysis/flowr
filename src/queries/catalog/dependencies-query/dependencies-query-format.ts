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
import { ReadFunctions } from './function-info/read-functions';
import { WriteFunctions } from './function-info/write-functions';
import { VisualizeFunctions } from './function-info/visualize-functions';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { CallContextQueryResult } from '../call-context-query/call-context-query-format';
import type { Range } from 'semver';
import type { AsyncOrSync, MarkOptional } from 'ts-essentials';
import type { NamespaceInfo } from '../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { TestFunctions } from './function-info/test-functions';
import type { BrandedNamespace } from '../../../dataflow/environments/identifier';
import { Identifier } from '../../../dataflow/environments/identifier';
import { RProject } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { PotentiallyEmptyRArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

export const Unknown = 'unknown';

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

/** packages a default R session attaches without an explicit `library()` call, so missing them is not "undeclared" */
const AttachedBasePackages: readonly string[] = ['base', 'stats', 'graphics', 'grDevices', 'utils', 'datasets', 'methods'];

/** {@link LibraryFunctions} indexed by name, to recognise a library-load call by its called function */
const LibraryLoadFunctionInfo = new Map(LibraryFunctions.map(f => [f.name, f]));

/** the literal package name of a `library()`/`require()`-style argument (a bare symbol or a plain string constant) */
function literalPackageName(node: RNode | undefined): string | undefined {
	if(node?.type === RType.String) {
		return node.content.str;
	} else if(node?.type === RType.Symbol) {
		return Identifier.getName(node.content);
	}
	return undefined;
}

/** the argument value(s) of a library-load call that (statically) name the package(s) to load, per the matching {@link FunctionInfo} */
function libraryCallArgumentValues(args: readonly PotentiallyEmptyRArgument[], info: FunctionInfo): RNode[] {
	const values: RNode[] = [];
	let position = 0;
	for(const arg of args) {
		if(typeof arg !== 'string' && arg.value !== undefined) {
			if(info.argIdx === 'unnamed') {
				if(arg.name === undefined) {
					values.push(arg.value);
				}
			} else if(arg.name !== undefined ? Identifier.getName(arg.name.content) === info.argName : position === info.argIdx) {
				values.push(arg.value);
			}
		}
		position++;
	}
	return values;
}

/**
 * The packages used by the code: attached via a `library()`-style call, or referenced via `::`/`:::`.
 * Maps each package name to the node id of one representative use site.
 *
 * This deliberately re-walks the AST instead of depending on the `library` category's result array: categories
 * run concurrently (see the executor's `Promise.all`), so another category's finished results are not available.
 * Only statically known package names are picked up (a bare symbol or string literal argument), matching the
 * `library` category's own `::`/`:::` detection in spirit but staying independent of it.
 */
async function collectUsedPackages(data: BasicQueryData): Promise<Map<string, NodeId>> {
	const used = new Map<string, NodeId>();
	RProject.visitAst((await data.analyzer.normalize()).ast, node => {
		if(node.type === RType.Symbol) {
			const ns = Identifier.getNamespace(node.content);
			if(ns !== undefined && !used.has(ns)) {
				used.set(ns, node.info.id);
			}
		} else if(node.type === RType.FunctionCall && node.named) {
			const info = LibraryLoadFunctionInfo.get(Identifier.getName(node.functionName.content));
			if(info !== undefined) {
				for(const value of libraryCallArgumentValues(node.arguments, info)) {
					const pkg = literalPackageName(value);
					if(pkg !== undefined && !used.has(pkg)) {
						used.set(pkg, node.info.id);
					}
				}
			}
		}
	});
	return used;
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
							derivedVersion:     dep?.derivedVersion,
							namespaceInfo:      dep?.namespaceInfo
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
	},
	'test': {
		queryDisplayName: 'Tests',
		functions:        TestFunctions
	},
	'undeclared': {
		queryDisplayName:   'Undeclared Dependencies',
		functions:          [],
		/* packages that are used (via `library()`/`require()` or `::`/`:::`) but never declared as a project dependency */
		additionalAnalysis: async(data, ignoreDefault, _functions, _queryResults, result) => {
			if(ignoreDefault) {
				return;
			}
			const deps = data.analyzer.inspectContext().deps;
			const declared = new Set(deps.getDependencies().map(p => p.name));
			for(const [pkg, nodeId] of await collectUsedPackages(data)) {
				if(!declared.has(pkg) && !AttachedBasePackages.includes(pkg)) {
					result.push({ nodeId, functionName: pkg, value: pkg });
				}
			}
		}
	},
	'unused': {
		queryDisplayName:   'Unused Dependencies',
		functions:          [],
		/* packages declared as a project dependency but never used (via `library()`/`require()` or `::`/`:::`) */
		additionalAnalysis: async(data, ignoreDefault, _functions, _queryResults, result) => {
			if(ignoreDefault) {
				return;
			}
			const deps = data.analyzer.inspectContext().deps;
			const used = await collectUsedPackages(data);
			const nodeId = (await data.analyzer.normalize()).ast.files[0]?.root.info.id;
			if(nodeId === undefined) {
				return;
			}
			for(const pkg of deps.getDependencies()) {
				if(!used.has(pkg.name)) {
					result.push({ nodeId, functionName: pkg.name, value: pkg.name });
				}
			}
		}
	}
} as const satisfies Record<string, DependencyCategorySettings>;
export type DefaultDependencyCategoryName = keyof typeof DefaultDependencyCategories;
export type DependencyCategoryName = DefaultDependencyCategoryName | string;

export interface DependenciesQuery extends BaseQueryFormat, Partial<Record<`${DefaultDependencyCategoryName}Functions`, FunctionInfo[]>> {
	readonly type:                    'dependencies'
	readonly enabledCategories?:      DependencyCategoryName[]
	readonly ignoreDefaultFunctions?: boolean
	readonly additionalCategories?:   Record<string, MarkOptional<DependencyCategorySettings, 'additionalAnalysis'>>
}

export type DependenciesQueryResult = BaseQueryResult & { [C in DefaultDependencyCategoryName]: DependencyInfo[] } & { [S in string]?: DependencyInfo[] };


export interface DependencyInfo extends Record<string, unknown>{
	nodeId:              NodeId
	/** the called name; an {@link Identifier}, so a namespaced call like `maps::map` keeps its package */
	functionName:        Identifier
	linkedIds?:          readonly NodeId[]
	/** the lexeme is presented whenever the specific info is of {@link Unknown} */
	lexemeOfArgument?:   string;
	/** The library name, file, source, destination etc. being sourced, read from, or written to. */
	value?:              string
	versionConstraints?: Range[],
	derivedVersion?:     Range,
	namespaceInfo?:      NamespaceInfo,
}

function printResultSection(title: string, infos: DependencyInfo[], result: string[], formatter: OutputFormatter): void {
	if(infos.length <= 0) {
		return;
	}
	result.push(`   ${bold(title, formatter)} ${faint(`(${infos.length})`, formatter)}`);
	// one line per dependency: the value (package/file) up front, its function + node as a faint provenance suffix
	for(const i of infos) {
		const fn = Identifier.getName(i.functionName);
		const value = i.value !== undefined ? bold(i.value, formatter) : faint('<unresolved>', formatter);
		const version = i.derivedVersion !== undefined ? ` ${faint(i.derivedVersion.format(), formatter)}` : '';
		const linked = i.linkedIds ? `, linked ${i.linkedIds.join(', ')}` : '';
		result.push(`     ${value}${version} ${faint(`via ${fn} (node ${i.nodeId}${linked})`, formatter)}`);
	}
}

/**
 * Gets all dependency categories, including user-defined additional categories.
 */
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
	title:           'Dependencies Query',
	executor:        executeDependenciesQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result, queries) => {
		const out = queryResults as DependenciesQueryResult;
		result.push(`Query: ${bold('dependencies', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [category, value] of Object.entries(getAllCategories(queries as DependenciesQuery[]))) {
			if(category === 'unused') {
				continue; // the unused-dependency detection is unreliable; omit it from the summary for now
			}
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
		})).description('A set of additional, user-supplied dependency categories, whose results will be included in the query return value.').optional()
	}).description('The dependencies query retrieves and returns the set of all dependencies in the dataflow graph, which includes libraries, sourced files, read data, and written data.'),
	flattenInvolvedNodes: (queryResults, query): NodeId[] => {
		const out = queryResults as DependenciesQueryResult;
		return Object.keys(getAllCategories(query as DependenciesQuery[])).flatMap(c => out[c] ?? []).map(o => o.nodeId);
	}
} as const satisfies SupportedQuery<'dependencies'>;
