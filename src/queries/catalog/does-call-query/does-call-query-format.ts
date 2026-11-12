import { type BasicQueryData, type BaseQueryFormat, type BaseQueryResult, invalidQueryLine } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { startAndEndsWith } from '../../../util/text/strings';
import { SourceRange } from '../../../util/range';
import { queryLineCode } from '../../../cli/repl/parser/slice-query-parser';
import { metaSince } from '../../query-meta';
import { log } from '../../../util/log';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier } from '../../../dataflow/environments/identifier';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { CallGraph } from '../../../dataflow/graph/call-graph';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from '../../../project/context/flowr-analyzer-dependencies-context';
import { transitiveLibraryCallees } from '../call-graph-query/expand-library-internals';

/**
 * Execute does call queries on the given analyzer.
 */
export async function executeDoesCallQuery({ analyzer }: BasicQueryData, queries: readonly DoesCallQuery[]): Promise<DoesCallQueryResult> {
	const start = Date.now();
	const cg = await analyzer.callGraph();
	const idMap = (await analyzer.normalize()).idMap;
	const deps = analyzer.inspectContext().deps;
	const results: Record<string, FindAllCallsResult | false> = {};
	for(const query of queries) {
		const id = query.queryId ?? JSON.stringify(query);
		if(id in results) {
			log.warn(`Duplicate query id '${id}' in does-call queries, SKIP.`);
			continue;
		}
		const nodeId = SlicingCriterion.tryParse(query.call, idMap);
		if(!nodeId) {
			results[id] = false;
			continue;
		}
		const c = makeCallMatcher(query.calls);
		results[id] = findCallersMatchingConstraints(cg, nodeId, c, query.expandLibraryInternals ? deps : undefined);
	}
	return {
		...metaSince(start),
		results
	};
}

type CheckCallMatch = (vtx: { id: NodeId, name?: Identifier }, cg: CallGraph) => boolean;

function makeCallMatcher(constraint: CallsConstraint): CheckCallMatch {
	switch(constraint.type) {
		case 'calls-id':
			return (vtx) => vtx.id === constraint.id;
		case 'name':
			if(constraint.nameExact) {
				return (vtx) => vtx.name === constraint.name;
			} else {
				const regex = new RegExp(constraint.name);
				return (vtx) => 'name' in vtx && vtx.name ? regex.test(Identifier.getName(vtx.name)) : false;
			}
		case 'and': {
			let matchersAndRemain = constraint.calls.map(makeCallMatcher);
			return (vtx, cg) => {
				const matchersToRemove: CheckCallMatch[] = [];
				for(const matcher of matchersAndRemain) {
					if(matcher(vtx, cg)) {
						matchersToRemove.push(matcher);
					}
				}
				matchersAndRemain = matchersAndRemain.filter(m => !matchersToRemove.includes(m));
				return matchersAndRemain.length === 0;
			};
		}
		case 'or': {
			const matchersOr = constraint.calls.map(makeCallMatcher);
			return (vtx, cg) => matchersOr.some(m => m(vtx, cg));
		}
		case 'one-of': {
			const matchersOneOf = constraint.calls.map(makeCallMatcher);
			return (vtx, cg) => matchersOneOf.filter(m => m(vtx, cg)).length === 1;
		}
		default: {
			throw new Error(`Unhandled constraint type ${JSON.stringify(constraint)}`);
		}
	}
}

function findCallersMatchingConstraints(cg: CallGraph, start: NodeId, constraints: CheckCallMatch, expandDeps?: ReadOnlyFlowrAnalyzerDependenciesContext): FindAllCallsResult | false {
	const visited = new Set<NodeId>();
	const toVisit: NodeId[] = [start];
	for(let cur; (cur = toVisit.pop()) !== undefined;) {
		if(visited.has(cur)) {
			continue;
		}
		visited.add(cur);
		if(NodeId.isBuiltIn(cur)) {
			const name = NodeId.fromBuiltIn(cur);
			if(constraints({ id: cur, name }, cg)) {
				return { call: start };
			}
			if(expandDeps && matchesExpandedLibraryInternals(cur, constraints, cg, expandDeps)) {
				return { call: start };
			}
			continue;
		}

		const vtx = cg.getVertex(cur);
		if(!vtx) {
			continue;
		}
		// check if matches
		if(constraints(vtx, cg)) {
			return { call: start };
		}
		for(const out of cg.edgesFrom(cur)) {
			toVisit.push(out[0]);
		}
	}
	return false;
}

/** whether `constraints` matches any internal callee of the library/built-in leaf call `cur`, expanded via the signature database */
function matchesExpandedLibraryInternals(cur: NodeId, constraints: CheckCallMatch, cg: CallGraph, deps: ReadOnlyFlowrAnalyzerDependenciesContext): boolean {
	const expansion = transitiveLibraryCallees(cur, deps);
	if(expansion === undefined) {
		return false;
	}
	return expansion.callees.some(name => constraints({ id: cur, name }, cg));
}

interface CallsIdConstraint {
	readonly type: 'calls-id';
	/** The id of the function being called. */
	readonly id:   NodeId;
}
interface CallsWithNameConstraint {
	readonly type:       'name';
	/** The name of the function being called. */
	readonly name:       string;
	/** Should we match the name exactly, or as a regex? */
	readonly nameExact?: boolean;
}

interface CallsConstraints {
	/**
	 * How to combine the given constraints:
	 * `and` requires every constraint to be satisfied by some call reached during the walk,
	 * `or` requires at least one of them to match a reached call,
	 * and `one-of` requires exactly one of them to match a reached call.
	 */
	readonly type:  'and' | 'or' | 'one-of';
	/* The constraints to combine. */
	readonly calls: readonly CallsConstraint[];
}

export type CallsConstraint = CallsIdConstraint | CallsWithNameConstraint | CallsConstraints;

/**
 * Either checks whether a given function calls another function matching the given constraints,
 * or returns all functions that call any function matching the given constraints.
 */
export interface DoesCallQuery extends BaseQueryFormat {
	readonly type:                    'does-call';
	// this should be a unique id if you give multiple queries of this type, to identify them in the output
	readonly queryId?:                string;
	readonly call:                    SlicingCriterion;
	readonly calls:                   CallsConstraint;
	/**
	 * If set, when the walk reaches a library/built-in leaf call, expand it into its internal callees using the
	 * signature database's `transitiveCallees` and match the constraints against those as well (a no-op if no
	 * signature database is loaded). Default false.
	 */
	readonly expandLibraryInternals?: boolean;
}

export interface FindAllCallsResult {
	readonly call: NodeId
}

export interface DoesCallQueryResult extends BaseQueryResult {
	/** Results are either false (does not call) or an object with details on the calls made */
	readonly results: Record<string, FindAllCallsResult | false>;
}

const FormatError = 'Invalid constraint format, expected format "(left:$id/"regex")"';
/**
 * Parses a constraint from a string argument.
 * Returns the constraint or an error message.
 */
function constraintParser(argument: string | undefined): { call: SlicingCriterion, constraint: CallsWithNameConstraint | CallsIdConstraint } | string {
	if(!argument?.startsWith('(') || !argument.includes(')')) {
		return FormatError + ` (got: "${argument}")`;
	}
	const endBracket = argument.indexOf(')');
	const constrPart = argument.slice(1, endBracket);
	const args = splitAtEscapeSensitive(constrPart, true, ':');
	if(args.length !== 2) {
		return FormatError + ` (got ${args.length} parts: ${args.join(', ')})`;
	}
	const [criteria, ...rhs] = args;
	const rhsStr = rhs.join(' ');
	if(rhsStr.startsWith('$')) {
		return {
			call:       criteria as SlicingCriterion,
			constraint: {
				type: 'calls-id',
				id:   rhsStr.slice(1) as SlicingCriterion,
			}
		};
	} else {
		const isExact = startAndEndsWith(rhsStr, '"');
		const name = isExact ? rhsStr.slice(1, -1) : rhsStr;
		return {
			call:       criteria as SlicingCriterion,
			constraint: {
				type:      'name',
				name:      name,
				nameExact: isExact ? true : undefined,
			}
		};
	}
}

function doesCallQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'does-call'> {
	const constraint = constraintParser(line[0]);
	if(!constraint || typeof constraint === 'string') {
		return invalidQueryLine(output, `Invalid does-call query format:\n  ${constraint}`);
	}

	return {
		query: [
			{
				type:    'does-call',
				queryId: constraint.call + ' (shorthand)',
				call:    constraint.call,
				calls:   constraint.constraint,
			}],
		rCode: queryLineCode(line)
	};
}

export const DoesCallQueryDefinition = {
	title:           'Does-Call Query',
	executor:        executeDoesCallQuery,
	perQueryResults: true,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'does-call'>['does-call'];
		result.push(`Query: ${bold('does-call', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		for(const [r, v] of Object.entries(out.results)) {
			const idMap = (await processed.normalize()).idMap;
			result.push(`  - ${bold(r, formatter)} found:`);
			if(v === false) {
				result.push('    - Does not call any matching functions.');
			} else {
				const loc = idMap.get(v.call)?.location ?? undefined;
				result.push(`    - Call with id ${bold(String(v.call), formatter)} (${SourceRange.format(loc)})`);
			}
		}
		return true;
	},
	fromLine: doesCallQueryLineParser,
	syntax:   '@does-call (<criterion>:$<id>|"<name>") <code | file://path>',
	schema:   Joi.object({
		type:                   Joi.string().valid('does-call').required().description('The type of the query.'),
		queryId:                Joi.string().optional().description('An optional unique identifier for this query, to identify it in the output.'),
		call:                   Joi.string().description('The function from which calls are being made. This is a slicing criterion that resolves to a function definition node.'),
		calls:                  Joi.object().required().description('The constraints on which functions are being called. This can be a combination of name-based or id-based constraints, combined with logical operators (and, or, one-of).'),
		expandLibraryInternals: Joi.boolean().optional().description('Expand a reached library/built-in leaf call into its internal callees via the signature database and match constraints against those too (default false).')
	}).description('Either returns all function definitions alongside whether they are recursive, or just those matching the filters.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'does-call'>['does-call'];
		return Object.entries(out.results).flatMap(([, v]) => {
			return v !== false ? v.call : [];
		});
	}
} as const satisfies SupportedQuery<'does-call'>;
