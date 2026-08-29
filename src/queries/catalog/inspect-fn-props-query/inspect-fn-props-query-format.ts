import { filterLineParser, type BaseQueryFormat, type BaseQueryResult } from '../../base-query-format';
import { Fn } from '../../../dataflow/fn/fn';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { executeFnPropsQuery } from './inspect-fn-props-query-executor';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import { SourceLocation } from '../../../util/range';
import type { FunctionArgumentRoles } from '../../../dataflow/fn/argument-roles';
import type { StatedProps } from '../../../dataflow/environments/built-in-props';
import { ArgProp, CallProp, SemanticCallTag } from '../../../dataflow/environments/built-in-props';
import { enumMembers } from '../../../util/objects';
import { DefaultDepth } from '../../../dataflow/fn/argument-roles';


/** refuses a query that can only answer with nothing: `formals` narrowing an answer that carries none, or `props` naming only properties the single half it asks for cannot state */
function rejectEmptyAnswer(query: InspectFnPropsQuery, helpers: Joi.CustomHelpers): InspectFnPropsQuery {
	const { only, formals, props } = query;
	if(only === 'function' && formals !== undefined) {
		return helpers.message({ custom: '`formals` narrows the formals, which `only: function` does not answer' }) as unknown as InspectFnPropsQuery;
	}
	const namesNone = props === undefined ? false :
		only === 'arguments' ? Fn.call.argument.mask(props) === 0 :
			only === 'function' ? Fn.call.props.isEmptyMask(Fn.call.props.mask(props)) : false;
	if(namesNone) {
		return helpers.message({ custom: `\`props\` names no ${only === 'arguments' ? 'ArgProp' : 'CallProp'}, so nothing about ${only === 'arguments' ? 'a formal' : 'a function'} could come back` }) as unknown as InspectFnPropsQuery;
	}
	return query;
}

/** either returns all function definitions alongside what they and their formals do, or just those matching the filters */
export interface InspectFnPropsQuery extends BaseQueryFormat {
	readonly type:      'inspect-fn-props';
	readonly filter?:   readonly SlicingCriterion[]
	/** how far a value is followed back through names and calls (default {@link DefaultDepth}) */
	readonly maxDepth?: number
	/** infer only what the formals do (`arguments`) or only what the function does (`function`); both by default */
	readonly only?:     'arguments' | 'function'
	/** keep only the formals written as one of these names */
	readonly formals?:  readonly string[]
	/** keep only these properties, named as the {@link ArgProp}/{@link CallProp} members they are */
	readonly props?:    readonly string[]
}

export interface InspectFnPropsQueryResult extends BaseQueryResult {
	/** per function definition, the {@link ArgProp} mask of the formals that carry one, strictness included */
	readonly roles: Record<NodeId, FunctionArgumentRoles>;
	/** per function definition, what its body states about the function itself */
	readonly props: Record<NodeId, StatedProps>;
}

export const InspectFnPropsQueryDefinition = {
	title:           'Inspect Argument Roles Query',
	executor:        executeFnPropsQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'inspect-fn-props'>['inspect-fn-props'];
		result.push(`Query: ${bold('inspect-fn-props', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		const idMap = (await processed.normalize()).idMap;
		for(const id of new Set([...Object.keys(out.roles), ...Object.keys(out.props)])) {
			const node = idMap.get(NodeId.normalize(id));
			const loc = node ? SourceLocation.fromNode(node) : undefined;
			const formals = Object.entries(out.roles[id] ?? {})
				.map(([formal, props]) => `${idMap.get(NodeId.normalize(formal))?.lexeme ?? formal}: ${Fn.call.argument.words(props).join(', ')}`)
				.join(', ');
			const states = Fn.call.props.labels(out.props[id]).join(', ');
			result.push(`  - Function ${bold(id, formatter)} (${SourceLocation.format(loc)}) ${formals}${states.length > 0 ? ` [${states}]` : ''}`);
		}
		return true;
	},
	fromLine: filterLineParser('inspect-fn-props'),
	syntax:   '@inspect-fn-props [(<crit>;...)] <code | file://path>',
	schema:   Joi.object({
		type:     Joi.string().valid('inspect-fn-props').required().description('The type of the query.'),
		filter:   Joi.array().items(Joi.string().required()).optional().description('If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered.'),
		maxDepth: Joi.number().integer().min(1).optional().description(`How far a value is followed back through names and calls when deciding what a formal stands for (default ${DefaultDepth}).`),
		only:     Joi.string().valid('arguments', 'function').optional().description('Infer only what the formals do, or only what the function itself does; both are inferred when this is left out.'),
		formals:  Joi.array().items(Joi.string()).min(1).optional().description('Keep only the formals written as one of these names.'),
		props:    Joi.array().items(Joi.string().valid(...[...enumMembers(ArgProp), ...enumMembers(CallProp)].map(([name]) => name), ...Object.keys(SemanticCallTag))).min(1).optional().description('Keep only these properties, named as the ArgProp/CallProp/SemanticCallTag members they are.')
	}).custom(rejectEmptyAnswer).description('Either returns all function definitions alongside what they and their formals do, or just those matching the filters.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'inspect-fn-props'>['inspect-fn-props'];
		return [...new Set([...Object.keys(out.roles), ...Object.keys(out.props)])];
	}
} as const satisfies SupportedQuery<'inspect-fn-props'>;
