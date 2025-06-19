import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { executeCallContextQueries } from './call-context-query-executor';
import type { OutputFormatter } from '../../../util/text/ansi';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';

import { asciiCallContext } from '../../query-print';
import type { PipelineOutput } from '../../../core/steps/pipeline/pipeline';
import type { DEFAULT_DATAFLOW_PIPELINE } from '../../../core/steps/pipeline/default-pipelines';
import { CallTargets } from './identify-link-to-last-call-relation';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { DataflowGraphVertexInfo } from '../../../dataflow/graph/vertex';
import type { CascadeAction } from './cascade-action';
import type { NoInfo } from '../../../r-bridge/lang-4.x/ast/model/model';

export interface FileFilter<FilterType> {
	/**
	 * Regex that a node's file attribute must match to be considered
	 */
	readonly filter:                 FilterType;
	/**
	 * If `fileFilter` is set, but a nodes `file` attribute is `undefined`, should we include it in the results? Defaults to `true`.
	 */
	readonly includeUndefinedFiles?: boolean;
}

export interface DefaultCallContextQueryFormat<RegexType extends RegExp | string> extends BaseQueryFormat {
	readonly type:                   'call-context';
	/** Regex regarding the function name, please note that strings will be interpreted as regular expressions too! */
	readonly callName:               RegexType;
	/**
	 * Should we automatically add the `^` and `$` anchors to the regex to make it an exact match?
	 */
	readonly callNameExact?:         boolean;
	/** kind may be a step or anything that you attach to the call, this can be used to group calls together (e.g., linking `ggplot` to `visualize`). Defaults to `.` */
	readonly kind?:                  string;
	/** subkinds are used to uniquely identify the respective call type when grouping the output (e.g., the normalized name, linking `ggplot` to `plot`). Defaults to `.` */
	readonly subkind?:               string;
	/**
	 * Call targets the function may have. This defaults to {@link CallTargets#Any}.
	 * Request this specifically to gain all call targets we can resolve.
	 */
	readonly callTargets?:           CallTargets;
	/**
	 * Consider a case like `f <- function_of_interest`, do you want uses of `f` to be included in the results?
	 */
	readonly includeAliases?:        boolean;
	/**
	 * Should we ignore default values for parameters in the results?
	 */
	readonly ignoreParameterValues?: boolean;
	/**
	 * Filter that, when set, a node's file attribute must match to be considered
	 */
	readonly fileFilter?:            FileFilter<RegexType>;
}

/**
 * Links the current call to the last call of the given kind.
 * This way, you can link a call like `points` to the latest graphics plot etc.
 * For now, this uses the static Control-Flow-Graph produced by flowR as the FD over-approximation is still not stable (see #1005).
 * In short, this means that we are unable to detect origins over function call boundaries but plan on being more precise in the future.
 */
export interface LinkToLastCall<CallName extends RegExp | string = RegExp | string> extends BaseQueryFormat {
	readonly type:       'link-to-last-call';
	/** Regex regarding the function name of the last call. Similar to {@link DefaultCallContextQueryFormat#callName}, strings are interpreted as a `RegExp`. */
	readonly callName:   CallName;
	/**
	 * Should we ignore this (source) call?
	 * Currently, there is no well working serialization for this if a function is supplied.
	 */
	readonly ignoreIf?:  ((id: NodeId, graph: DataflowGraph) => boolean) | boolean;
	/**
	 * Should we continue searching after the link was created?
	 * Currently, there is no well working serialization for this if a function is supplied.
	 */
	readonly cascadeIf?: ((target: DataflowGraphVertexInfo, from: NodeId, graph: DataflowGraph) => CascadeAction) | CascadeAction;
}

export type LinkTo<CallName extends RegExp | string = RegExp | string, AttachLinkInfo = NoInfo> = (LinkToLastCall<CallName>) & { attachLinkInfo?: AttachLinkInfo };

export interface SubCallContextQueryFormat<CallName extends RegExp | string = RegExp | string, AttachLinkInfo = NoInfo> extends DefaultCallContextQueryFormat<CallName> {
	readonly linkTo: LinkTo<CallName, AttachLinkInfo> | LinkTo<CallName, AttachLinkInfo>[];
}

export interface CallContextQuerySubKindResult {
	/** The id of the call vertex identified within the supplied dataflow graph */
	readonly id:          NodeId;
	/** The name of the function call */
	readonly name:        string;
	/**
	 * Ids of functions which are called by the respective function call,
	 * this will only be populated whenever you explicitly state the {@link DefaultCallContextQueryFormat#callTargets}.
	 * An empty array means that the call targets only non-local functions.
	 */
	readonly calls?:      readonly NodeId[];
	/** ids attached by the linkTo query, if you attached information with the `attachLinkInfo` field you can find it here */
	readonly linkedIds?:  readonly (NodeId | { id: NodeId, info: object })[];
	/**
	 * (Direct) alias locations this call stems from
	 */
	readonly aliasRoots?: readonly NodeId[];
}

export type CallContextQueryKindResult = Record<string, {
	/** maps each subkind to the results found, to be freely in the result form, this is mutable */
	subkinds: Record<string, CallContextQuerySubKindResult[]>
}>

export interface CallContextQueryResult extends BaseQueryResult {
	readonly kinds: CallContextQueryKindResult;
}

export type CallContextQuery<CallName extends RegExp | string = RegExp | string, AttachLinkInfo = NoInfo> = DefaultCallContextQueryFormat<CallName> | SubCallContextQueryFormat<CallName, AttachLinkInfo>;

const CallContextQueryLinkTo = Joi.object({
	type:           Joi.string().valid('link-to-last-call').required().description('The type of the linkTo sub-query.'),
	callName:       Joi.string().required().description('Regex regarding the function name of the last call. Similar to `callName`, strings are interpreted as a regular expression.'),
	ignoreIf:       Joi.function().optional().description('Should we ignore this (source) call? Currently, there is no well working serialization for this.'),
	cascadeIf:      Joi.function().optional().description('Should we continue searching after the link was created? Currently, there is no well working serialization for this.'),
	attachLinkInfo: Joi.object().optional().description('Additional information to attach to the link.')
});

export const CallContextQueryDefinition = {
	executor:        executeCallContextQueries,
	asciiSummarizer: (formatter: OutputFormatter, processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>, queryResults: BaseQueryResult, result: string[]) => {
		const out = queryResults as CallContextQueryResult;
		result.push(`Query: ${bold('call-context', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(asciiCallContext(formatter, out, processed));
		return true;
	},
	schema: Joi.object({
		type:                  Joi.string().valid('call-context').required().description('The type of the query.'),
		callName:              Joi.string().required().description('Regex regarding the function name!'),
		callNameExact:         Joi.boolean().optional().description('Should we automatically add the `^` and `$` anchors to the regex to make it an exact match?'),
		kind:                  Joi.string().optional().description('The kind of the call, this can be used to group calls together (e.g., linking `plot` to `visualize`). Defaults to `.`'),
		subkind:               Joi.string().optional().description('The subkind of the call, this can be used to uniquely identify the respective call type when grouping the output (e.g., the normalized name, linking `ggplot` to `plot`). Defaults to `.`'),
		callTargets:           Joi.string().valid(...Object.values(CallTargets)).optional().description('Call targets the function may have. This defaults to `any`. Request this specifically to gain all call targets we can resolve.'),
		ignoreParameterValues: Joi.boolean().optional().description('Should we ignore default values for parameters in the results?'),
		includeAliases:        Joi.boolean().optional().description('Consider a case like `f <- function_of_interest`, do you want uses of `f` to be included in the results?'),
		fileFilter:            Joi.object({
			fileFilter:            Joi.string().required().description('Regex that a node\'s file attribute must match to be considered'),
			includeUndefinedFiles: Joi.boolean().optional().description('If `fileFilter` is set, but a nodes `file` attribute is `undefined`, should we include it in the results? Defaults to `true`.')
		}).optional().description('Filter that, when set, a node\'s file attribute must match to be considered'),
		linkTo: Joi.alternatives(CallContextQueryLinkTo, Joi.array().items(CallContextQueryLinkTo)).optional().description('Links the current call to the last call of the given kind. This way, you can link a call like `points` to the latest graphics plot etc.')
	}).description('Call context query used to find calls in the dataflow graph'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult) => {
		const out = queryResults as CallContextQueryResult;
		return Object.values(out.kinds).flatMap(({ subkinds }) => Object.values(subkinds).flatMap(subkinds => subkinds.map(subkind => subkind.id)));
	}
} as const;
