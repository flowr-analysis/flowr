import { filterLineParser, type BaseQueryFormat, type BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { executeFnGuardsQuery } from './inspect-fn-guards-query-executor';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import { SourceLocation } from '../../../util/range';
import { FunctionFilterSchema } from '../../query-function-property';
import type { FunctionGuards, GuardClause } from '../../../dataflow/fn/guards/function-guards';
import type { BrandedIdentifier } from '../../../dataflow/environments/identifier';
import type { StatedGuards } from '../../../dataflow/fn/guards/built-in-guards';
import { claimWords } from '../../../dataflow/fn/guards/guard-claims';

/** Returns what function definitions ask of the calls they return from, for all of them or just those matching the filter. */
export interface InspectFnGuardsQuery extends BaseQueryFormat {
	readonly type:      'inspect-fn-guards'
	readonly filter?:   readonly SlicingCriterion[]
	/** keep only the conditions the function checks itself (`explicit`) or those R checks for it (`implicit`) */
	readonly kind?:     GuardClause['kind']
	/** keep only the conditions failing before any side effect */
	readonly onlyPure?: boolean
	/** keep only what is said about these formals */
	readonly formals?:  readonly BrandedIdentifier[]
	/** also state what these functions of R ask for, written `name` or `pkg::name` */
	readonly builtIns?: readonly string[]
}

export interface InspectFnGuardsQueryResult extends BaseQueryResult {
	/** per function definition with anything to say about it, what it asks for */
	readonly guards:    Record<NodeId, FunctionGuards>
	/** what the functions {@link InspectFnGuardsQuery.builtIns} names ask for, those flowR knows nothing of left out */
	readonly builtIns?: Record<string, StatedGuards>
}

/** Adds what has to be supplied, and what is claimed about each formal. */
function pushClaims(result: string[], { required = [], formals = {}, relations = [] }: StatedGuards): void {
	if(required.length > 0) {
		result.push(`    a call has to supply: ${required.join(', ')}`);
	}
	for(const [formal, claim] of Object.entries(formals)) {
		result.push(`    ${formal}: ${claimWords(claim).join(', ')}`);
	}
	for(const { holds, unless } of relations) {
		result.push(`    relation: ${holds}${unless === undefined ? '' : ` unless ${unless}`}`);
	}
}

export const InspectFnGuardsQueryDefinition = {
	title:           'Inspect Function Guards Query',
	executor:        executeFnGuardsQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'inspect-fn-guards'>['inspect-fn-guards'];
		result.push(`Query: ${bold('inspect-fn-guards', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		const idMap = (await processed.normalize()).idMap;
		for(const [id, guards] of Object.entries(out.guards)) {
			const node = idMap.get(NodeId.normalize(id));
			result.push(`  - Function ${bold(id, formatter)} (${SourceLocation.format(node ? SourceLocation.fromNode(node) : undefined)}) requires ${guards.requires === '' ? 'nothing' : guards.requires}`);
			if(guards.pure !== '' && guards.pure !== guards.requires) {
				result.push(`    failing cleanly on: ${guards.pure}`);
			}
			pushClaims(result, guards);
			for(const [formal, conditions] of Object.entries(guards.conditions)) {
				result.push(`    ${formal} is checked by: ${conditions.join(', ')}`);
			}
		}
		for(const [name, guards] of Object.entries(out.builtIns ?? {})) {
			result.push(`  - ${bold(name, formatter)} requires ${guards.requires === '' ? 'nothing' : guards.requires}`);
			pushClaims(result, guards);
		}
		return true;
	},
	fromLine: filterLineParser('inspect-fn-guards'),
	syntax:   '@inspect-fn-guards [(<crit>;...)] <code | file://path>',
	schema:   Joi.object({
		type:     Joi.string().valid('inspect-fn-guards').required().description('The type of the query.'),
		filter:   FunctionFilterSchema,
		kind:     Joi.string().valid('explicit', 'implicit').optional().description('Keep only the conditions the function checks itself, or only those R checks for it.'),
		onlyPure: Joi.boolean().optional().description('Keep only the conditions failing before any side effect.'),
		formals:  Joi.array().items(Joi.string()).min(1).optional().description('Keep only what is said about the formals written as one of these names.'),
		builtIns: Joi.array().items(Joi.string()).min(1).optional().description('Also state what these functions of R ask for, written `name` or `pkg::name`.')
	}).description('Returns what function definitions ask of the calls they return from, for all of them or just those matching the filter.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => Object.keys((queryResults as QueryResults<'inspect-fn-guards'>['inspect-fn-guards']).guards)
} as const satisfies SupportedQuery<'inspect-fn-guards'>;
