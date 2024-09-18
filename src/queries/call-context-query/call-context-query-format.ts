import type { BaseQueryFormat } from '../base-query-format';

export const enum CallTargets {
	/** call targets a function that is not defined locally (e.g., the call targets a library function) */
	Global = 'global',
	/** call targets a function that is defined locally  */
	Local = 'local',
	/** call targets a function that is defined locally or globally */
	Any = 'any'
}

export interface DefaultCallContextQueryFormat extends BaseQueryFormat {
	readonly type:         'call-context';
	/** Regex regarding the function name */
	readonly callName:     RegExp;
	/** kind may be a step or anything that you attach to the call, this can be used to group calls together (e.g., linking `ggplot` to `visualize`) */
	readonly kind:         string;
	/** subkinds are used to uniquely identify the respective call type when grouping the output (e.g., the normalized name, linking `ggplot` to `plot`) */
	readonly subkind:      string;
	/** call targets the function may have. This defaults to {@link CallTargets#Any}. */
	readonly callTargets?: CallTargets;
}

interface LinkToLastCall extends BaseQueryFormat {
	readonly type:      'link-to-last-call';
	/** Regex regarding the function name of the last call */
	readonly callName?: RegExp;
	/** kind that this should be linked to (i.e., last call of the given kind) */
	readonly kind?:     string;
	/** subkind that this should be linked to (i.e., last call of the given subkind) */
	readonly subkind?:  string;
}

type LinkTo = LinkToLastCall;

interface SubCallContextQueryFormat extends DefaultCallContextQueryFormat {
	readonly linkTo: LinkTo;
}


export type CallContextQueryFormat = DefaultCallContextQueryFormat | SubCallContextQueryFormat;
