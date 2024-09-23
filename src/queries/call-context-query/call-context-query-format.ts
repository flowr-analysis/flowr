import type { BaseQueryFormat, BaseQueryResult } from '../base-query-format';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export enum CallTargets {
	/** call targets a function that is not defined locally (e.g., the call targets a library function) */
	OnlyGlobal = 'global',
	/** call targets a function that is defined locally or globally, but must include a global function */
	MustIncludeGlobal = 'must-include-global',
	/** call targets a function that is defined locally  */
	OnlyLocal = 'local',
	/** call targets a function that is defined locally or globally, but must include a local function */
	MustIncludeLocal = 'must-include-local',
	/** call targets a function that is defined locally or globally */
	Any = 'any'
}

export interface DefaultCallContextQueryFormat<CallName extends RegExp | string> extends BaseQueryFormat {
	readonly type:         'call-context';
	/** Regex regarding the function name, please note that strings will be interpreted as regular expressions too! */
	readonly callName:     CallName;
	/** kind may be a step or anything that you attach to the call, this can be used to group calls together (e.g., linking `ggplot` to `visualize`). Defaults to `.` */
	readonly kind?:        string;
	/** subkinds are used to uniquely identify the respective call type when grouping the output (e.g., the normalized name, linking `ggplot` to `plot`). Defaults to `.` */
	readonly subkind?:     string;
	/**
	 * Call targets the function may have. This defaults to {@link CallTargets#Any}.
	 * Request this specifically to gain all call targets we can resolve.
	 */
	readonly callTargets?: CallTargets;
}

/**
 * Links the current call to the last call of the given kind.
 * This way, you can link a call like `points` to the latest graphics plot etc.
 * For now, this uses the static Control-Flow-Graph produced by flowR as the FD over-approximation is still not stable (see #1005).
 * In short, this means that we are unable to detect origins over function call boundaries but plan on being more precise in the future.
 */
interface LinkToLastCall<CallName extends RegExp | string = RegExp | string> extends BaseQueryFormat {
	readonly type:     'link-to-last-call';
	/** Regex regarding the function name of the last call. Similar to {@link DefaultCallContextQueryFormat#callName}, strings are interpreted as a `RegExp`. */
	readonly callName: CallName;
}

type LinkTo<CallName extends RegExp | string> = LinkToLastCall<CallName>;

export interface SubCallContextQueryFormat<CallName extends RegExp | string = RegExp | string> extends DefaultCallContextQueryFormat<CallName> {
	readonly linkTo: LinkTo<CallName>;
}

export interface CallContextQuerySubKindResult {
	/** The id of the call vertex identified within the supplied dataflow graph */
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
	/** maps each subkind to the results found, to be freely in the result form, this is mutable */
	subkinds: Record<string, CallContextQuerySubKindResult[]>
}>

export interface CallContextQueryResult extends BaseQueryResult {
	readonly kinds: CallContextQueryKindResult;
}

export type CallContextQuery<CallName extends RegExp | string = RegExp | string> = DefaultCallContextQueryFormat<CallName> | SubCallContextQueryFormat<CallName>;

