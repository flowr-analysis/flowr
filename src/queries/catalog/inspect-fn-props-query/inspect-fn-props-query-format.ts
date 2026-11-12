import { type BasicQueryData, filterLineParser, type BaseQueryFormat, type BaseQueryResult } from '../../base-query-format';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import { SourceLocation } from '../../../util/range';
import type { FunctionArgumentRoles } from '../../../dataflow/fn/argument-roles';
import type { StatedProps, ArgProps, PropMask } from '../../../dataflow/environments/built-in-props';
import { ArgProp, CallProp, SemanticCallTag } from '../../../dataflow/environments/built-in-props';
import { enumMembers } from '../../../util/objects';
import { DefaultDepth } from '../../../dataflow/fn/argument-roles';
import { FunctionFilterSchema } from '../../query-function-property';
import { uniqueArrayMerge } from '../../../util/collections/arrays';
import { metaSince } from '../../query-meta';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { QueryFunctionFilter } from '../../query-function-filter';


/** every bit, for a query naming no properties to keep */
const AllProps = ~0;

/** The formals a query asks about, dropping the ones it does not name and the bits it does not want. */
function keepRoles(all: Record<NodeId, FunctionArgumentRoles>, graph: DataflowGraph, formals: ReadonlySet<string> | undefined, mask: ArgProps): Record<NodeId, FunctionArgumentRoles> {
	if(formals === undefined && mask === AllProps) {
		return all;
	}
	const kept: Record<NodeId, FunctionArgumentRoles> = {};
	for(const [id, roles] of Object.entries(all)) {
		const some: FunctionArgumentRoles = {};
		for(const [formal, props] of Object.entries(roles)) {
			const named = NodeId.recoverName(NodeId.normalize(formal), graph.idMap);
			if((formals === undefined || (named !== undefined && formals.has(named))) && (props & mask) !== 0) {
				some[formal] = props & mask;
			}
		}
		if(Object.keys(some).length > 0) {
			kept[id] = some;
		}
	}
	return kept;
}

/** The function properties a query asks about, dropping the ones it does not want. */
function keepProps(all: Record<NodeId, StatedProps>, mask: PropMask | undefined): Record<NodeId, StatedProps> {
	if(mask === undefined) {
		return all;
	}
	const kept: Record<NodeId, StatedProps> = {};
	for(const [id, stated] of Object.entries(all)) {
		const some = FunctionSemantics.call.props.filter(stated, mask);
		if(FunctionSemantics.call.props.hasAny(some)) {
			kept[id] = some;
		}
	}
	return kept;
}

/** Execute function-property inspection queries on the given analyzer. */
export async function executeFnPropsQuery({ analyzer }: BasicQueryData, queries: readonly InspectFnPropsQuery[]): Promise<InspectFnPropsQueryResult> {
	const start = Date.now();
	const filterFor = await QueryFunctionFilter.criteria(queries, analyzer);
	const [{ only, formals, props, maxDepth } = {} as InspectFnPropsQuery] = queries;

	const ctx = analyzer.inspectContext();
	const graph = (await analyzer.dataflow()).graph;
	const inferred = FunctionSemantics.props(QueryFunctionFilter.definitions(graph, filterFor), graph, { ctx, maxDepth, only });

	return {
		...metaSince(start),
		roles: keepRoles(inferred.roles, graph, formals && new Set(formals), props ? FunctionSemantics.call.argument.mask(props) : AllProps),
		props: keepProps(inferred.props, props ? FunctionSemantics.call.props.mask(props) : undefined)
	};
}


/** refuses a query that can only answer with nothing: `formals` narrowing an answer that carries none, or `props` naming only properties the single half it asks for cannot state */
function rejectEmptyAnswer(query: InspectFnPropsQuery, helpers: Joi.CustomHelpers): InspectFnPropsQuery {
	const { only, formals, props } = query;
	if(only === 'function' && formals !== undefined) {
		return helpers.message({ custom: '`formals` narrows the formals, which `only: function` does not answer' }) as unknown as InspectFnPropsQuery;
	}
	const namesNone = props === undefined ? false :
		only === 'arguments' ? FunctionSemantics.call.argument.mask(props) === 0 :
			only === 'function' ? FunctionSemantics.call.props.isEmptyMask(FunctionSemantics.call.props.mask(props)) : false;
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
				.map(([formal, props]) => `${NodeId.recoverName(NodeId.normalize(formal), idMap) ?? formal}: ${FunctionSemantics.call.argument.words(props).join(', ')}`)
				.join(', ');
			const states = FunctionSemantics.call.props.labels(out.props[id]).join(', ');
			result.push(`  - Function ${bold(id, formatter)} (${SourceLocation.format(loc)}) ${formals}${states.length > 0 ? ` [${states}]` : ''}`);
		}
		return true;
	},
	fromLine: filterLineParser('inspect-fn-props'),
	syntax:   '@inspect-fn-props [(<crit>;...)] <code | file://path>',
	schema:   Joi.object({
		type:     Joi.string().valid('inspect-fn-props').required().description('The type of the query.'),
		filter:   FunctionFilterSchema,
		maxDepth: Joi.number().integer().min(1).optional().description(`How far a value is followed back through names and calls when deciding what a formal stands for (default ${DefaultDepth}).`),
		only:     Joi.string().valid('arguments', 'function').optional().description('Infer only what the formals do, or only what the function itself does; both are inferred when this is left out.'),
		formals:  Joi.array().items(Joi.string()).min(1).optional().description('Keep only the formals written as one of these names.'),
		props:    Joi.array().items(Joi.string().valid(...[...enumMembers(ArgProp), ...enumMembers(CallProp)].map(([name]) => name), ...Object.keys(SemanticCallTag))).min(1).optional().description('Keep only these properties, named as the ArgProp/CallProp/SemanticCallTag members they are.')
	}).custom(rejectEmptyAnswer).description('Either returns all function definitions alongside what they and their formals do, or just those matching the filters.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'inspect-fn-props'>['inspect-fn-props'];
		return uniqueArrayMerge(Object.keys(out.roles), Object.keys(out.props));
	}
} as const satisfies SupportedQuery<'inspect-fn-props'>;
