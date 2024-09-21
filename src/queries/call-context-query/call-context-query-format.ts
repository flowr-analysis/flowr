import type { BaseQueryFormat, BaseQueryResult } from '../base-query-format';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export const enum CallTargets {
	/** call targets a function that is not defined locally (e.g., the call targets a library function) */
	OnlyGlobal = 'global',
	/** call targets a function that is defined locally  */
	OnlyLocal = 'local',
	/** call targets a function that is defined locally or globally */
	Any = 'any'
}

export interface DefaultCallContextQueryFormat extends BaseQueryFormat {
	readonly type:         'call-context';
	/** Regex regarding the function name, please note that strings will be interpreted as regular expressions too! */
	readonly callName:     RegExp | string;
	/** kind may be a step or anything that you attach to the call, this can be used to group calls together (e.g., linking `ggplot` to `visualize`) */
	readonly kind:         string;
	/** subkinds are used to uniquely identify the respective call type when grouping the output (e.g., the normalized name, linking `ggplot` to `plot`) */
	readonly subkind:      string;
	/**
	 * Call targets the function may have. This defaults to {@link CallTargets#Any}.
	 * Request this specifically to gain all call targets we can resolve.
	 */
	readonly callTargets?: CallTargets;
}

/**
 * Links the current call to the last call of the given kind.
 * This way, you can link a call like `points` to the latest graphics plot etc.
 * Please note that this may still result in a standalone, unlinked result
 * if we are unable to find a call of the given kind.
 */
interface LinkToLastCall extends BaseQueryFormat {
	readonly type:      'link-to-last-call';
	/** Regex regarding the function name of the last call */
	readonly callName?: RegExp;
}

type LinkTo = LinkToLastCall;

interface SubCallContextQueryFormat extends DefaultCallContextQueryFormat {
	readonly linkTo: LinkTo;
}


export interface CallContextQuerySubKindResult {
	readonly id:         NodeId;
	/**
	 * Ids of functions which are called by the respective function call,
	 * this will only be populated whenever you explicitly state the {@link DefaultCallContextQueryFormat#callTargets}.
	 * An empty array means that the call targets only non-local functions.
	 */
	readonly calls?:     readonly NodeId[];
	/** ids attached by the linkTo query */
	readonly linkedIds?: readonly NodeId[];
}

export type CallContextQueryKindResult = Record<string, {
	/** maps each subkind to the results found */
	readonly subkinds: Record<string, readonly CallContextQuerySubKindResult[]>
}>

export interface CallContextQueryResult extends BaseQueryResult {
	readonly kinds: CallContextQueryKindResult;
}

export type CallContextQuery = DefaultCallContextQueryFormat | SubCallContextQueryFormat;
