import { uniqueArrayMerge } from '../../util/collections/arrays';
import { setEquals } from '../../util/collections/set';

/**
 * What a single call reads and writes of the global state (see {@link AmbientStateName}), recorded when the call is processed.
 * Writes confined to the frame of the calling function (`withr::local_options`) are kept apart, as nothing outside it sees them.
 */
export interface AmbientAccessRecord {
	/** the pseudo variables the call reads, like `#option:digits` */
	readonly reads:   readonly string[]
	/** the pseudo variables the call may change */
	readonly writes:  readonly string[]
	/** the state only assumed changed by a body flowR cannot see, like `#rng` for `function(f) f()` */
	readonly assumed: readonly string[]
	/** the pseudo variables the call changes in the current frame only */
	readonly local:   readonly string[]
}

const None: readonly string[] = [];
const Kinds = ['reads', 'writes', 'assumed', 'local'] as const;

export const AmbientAccessRecord = {
	name: 'AmbientAccessRecord',
	/** Unions the records, leaving the first one itself if nothing is new. */
	merge(this: void, a: AmbientAccessRecord | undefined, b: Partial<AmbientAccessRecord>): AmbientAccessRecord {
		const union = (x: readonly string[] | undefined, y: readonly string[] | undefined): readonly string[] =>
			y === undefined || y.length === 0 ? x ?? None : x === undefined || x.length === 0 ? y : y.every(n => x.includes(n)) ? x : uniqueArrayMerge(x, y);
		return {
			reads:   union(a?.reads, b.reads),
			writes:  union(a?.writes, b.writes),
			assumed: union(a?.assumed, b.assumed),
			local:   union(a?.local, b.local)
		};
	},
	/** Whether both records state the same access, in any order. */
	equals(this: void, a: AmbientAccessRecord, b: AmbientAccessRecord): boolean {
		return Kinds.every(kind => setEquals(new Set(a[kind]), new Set(b[kind])));
	}
} as const;
