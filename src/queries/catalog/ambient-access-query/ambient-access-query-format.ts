import type { AmbientStateName } from '../../../dataflow/environments/ambient-state-name';
import type { BrandedIdentifier } from '../../../dataflow/environments/identifier';
import Joi from 'joi';
import { type BasicQueryData, filterLineParser, type BaseQueryFormat, type BaseQueryResult } from '../../base-query-format';
import type { SupportedQuery } from '../../query';
import { criteriaQueryCompleter } from '../../../cli/repl/parser/slice-query-parser';
import { bold } from '../../../util/text/ansi';
import { queryHeader } from '../../query-print';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import { metaSince } from '../../query-meta';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import type { AmbientAccess } from '../../../dataflow/graph/ambient-access';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { QueryFunctionFilter } from '../../query-function-filter';
import { log } from '../../../util/log';

function summary(a: AmbientAccess): AmbientAccessSummary {
	return { reads: [...a.reads.keys()].sort(), writes: [...a.writes.keys()].sort(), assumed: [...a.assumed.keys()].sort(), kills: [...a.kills.keys()].sort(), variables: [...a.variables.keys()].sort(), draws: [...a.draws] };
}

/**
 * Executes {@link AmbientAccessQuery}s, sharing one pass over the call graph between all scopes they ask for.
 */
export async function executeAmbientAccessQuery({ analyzer }: BasicQueryData, queries: readonly AmbientAccessQuery[]): Promise<AmbientAccessQueryResult> {
	const start = Date.now();
	const info = await analyzer.dataflow();
	const { ast, idMap } = await analyzer.normalize();
	const functions = Dataflow.sideEffects.ambientAccessOfFunctions(info);
	const results: Record<string, AmbientAccessSummary> = {};
	let perFunction: Record<NodeId, AmbientAccessSummary> | undefined;
	for(const { criteria, includeCallees, functions: askFunctions } of queries) {
		const opts = { includeCallees, functions };
		if(criteria === undefined) {
			ast.files.forEach((f, i) => {
				results[f.filePath ?? `<file ${i + 1}>`] = summary(Dataflow.sideEffects.ambientAccess(info, f.root, opts));
			});
			results[AmbientProjectKey] = summary(Dataflow.sideEffects.ambientAccess(info, ast, opts));
		}
		for(const criterion of criteria ?? []) {
			const id = SlicingCriterion.tryParse(criterion, idMap);
			if(id === undefined) {
				log.warn(`ambient-access: criterion ${criterion} matches no node`);
				continue;
			}
			results[criterion] = summary(Dataflow.sideEffects.ambientAccess(info, id, opts));
		}
		if(askFunctions) {
			perFunction ??= {};
			for(const [id, access] of functions) {
				if(QueryFunctionFilter.written(id)) {
					perFunction[id] = summary(access);
				}
			}
		}
	}
	return { ...metaSince(start), results, ...(perFunction === undefined ? {} : { functions: perFunction }) };
}

/**
 * What code reads and writes of the global state (options, environment variables, the working directory,
 * devices, the search path, ...), as the pseudo variables of {@link AmbientStateName}.
 * Without `criteria`, this answers for every file and for the whole project.
 * @example
 * ```ts
 * const files = await analyzer.query({ type: 'ambient-access' });
 * files.results['<project>'].writes; // e.g. ['#option:digits', '#options']
 * const stmt = await analyzer.query({ type: 'ambient-access', criteria: ['3^'], functions: true });
 * ```
 */
export interface AmbientAccessQuery extends BaseQueryFormat {
	readonly type:            'ambient-access';
	/** the code to ask for, each criterion with all the code its node spans (`3^` the statement on line 3, `$12` the node with id 12) */
	readonly criteria?:       SlicingCriteria
	/** also answer for every function definition the code writes, with what calling it accesses */
	readonly functions?:      boolean
	/** whether what the called functions access counts as well, defaults to true */
	readonly includeCallees?: boolean
}

/** {@link AmbientAccess} as plain, sorted lists */
export interface AmbientAccessSummary {
	readonly reads:     readonly AmbientStateName[]
	readonly writes:    readonly AmbientStateName[]
	readonly assumed:   readonly AmbientStateName[]
	readonly kills:     readonly AmbientStateName[]
	readonly variables: readonly BrandedIdentifier[]
	readonly draws:     readonly NodeId[]
}

/** the key {@link AmbientAccessQueryResult.results} uses for all files together */
export const AmbientProjectKey = '<project>';

export interface AmbientAccessQueryResult extends BaseQueryResult {
	/** per criterion, or without criteria per file path (`<file n>` for code given as text) and for the {@link AmbientProjectKey} */
	readonly results:    Record<string, AmbientAccessSummary>
	/** per function definition the analyzed code writes, if asked for with `functions` */
	readonly functions?: Record<NodeId, AmbientAccessSummary>
}

function listed(name: string, items: readonly unknown[]): string {
	return items.length === 0 ? '' : ` ${name}: ${items.join(', ')}`;
}

export const AmbientAccessQueryDefinition = {
	title:           'Ambient Access Query',
	executor:        executeAmbientAccessQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as AmbientAccessQueryResult;
		result.push(queryHeader('ambient-access', formatter, out['.meta'].timing));
		const entries = [...Object.entries(out.results), ...Object.entries(out.functions ?? {}).map(([id, a]) => [`function ${id}`, a] as const)];
		for(const [key, a] of entries) {
			const line = listed('reads', a.reads) + listed('writes', a.writes) + listed('assumed', a.assumed) + listed('kills', a.kills) + listed('binds', a.variables) + listed('draws', a.draws);
			result.push(`   ╰ ${bold(key, formatter)}:${line === '' ? ' nothing' : line}`);
		}
		return true;
	},
	completer: criteriaQueryCompleter,
	fromLine:  filterLineParser('ambient-access', 'criteria'),
	syntax:    '@ambient-access [(<crit>;...)] <code | file://path>',
	schema:    Joi.object({
		type:           Joi.string().valid('ambient-access').required().description('The type of the query.'),
		criteria:       Joi.array().items(Joi.string()).optional().description('The code to ask for, each slicing criterion with all the code its node spans. Without, every file and the whole project.'),
		functions:      Joi.boolean().optional().description('Also answer for every function definition the code writes.'),
		includeCallees: Joi.boolean().optional().description('Whether what the called functions access counts as well (default true).')
	}).description('What code reads and writes of the global state (options, environment variables, devices, ...).'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as AmbientAccessQueryResult;
		return Object.values(out.results).flatMap(a => a.draws);
	}
} as const satisfies SupportedQuery<'ambient-access'>;
