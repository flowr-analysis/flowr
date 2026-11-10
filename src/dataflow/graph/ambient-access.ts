import { setEquals } from '../../util/collections/set';
import { Relation } from '../../util/collections/relation';
import type { Monoid } from '../../util/monoid';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AmbientStateName } from '../environments/ambient-state-name';
import type { BrandedIdentifier } from '../environments/identifier';

/** How code accesses a part of the global state, see {@link AmbientAccess}. */
export enum AmbientAccessKind {
	/** the code may read the state */
	Read = 'reads',
	/** the code may change the state */
	Write = 'writes',
	/** the state is only assumed changed by a body flowR cannot see, like `#rng` for `function(f) f()` */
	Assumed = 'assumed',
	/** the code changes the state in the current frame only */
	Local = 'local'
}

const Kinds = Object.values(AmbientAccessKind);

/**
 * What code accesses of the global state, for a single call (see {@link DataflowGraph#ambientAccessOf}) just like for a function or any other part of a program (see {@link Dataflow.sideEffects.ambientAccess}).
 * Every kind maps the accessed state to the ids of the calls accessing it.
 */
export interface AmbientAccess {
	readonly [AmbientAccessKind.Read]:    Relation<AmbientStateName, NodeId>
	readonly [AmbientAccessKind.Write]:   Relation<AmbientStateName, NodeId>
	readonly [AmbientAccessKind.Assumed]: Relation<AmbientStateName, NodeId>
	readonly [AmbientAccessKind.Local]:   Relation<AmbientStateName, NodeId>
	/** the global variables the functions the code calls may bind, by `x <<- 1` reaching the global frame or `assign("x", 1, envir = .GlobalEnv)`, with the ids of these definitions; the graph does not know them for a single call */
	readonly variables:                   Relation<BrandedIdentifier, NodeId>
	/** the calls tagged {@link SemanticCallTag.Graphics} (`plot`, `lines`, `par`, ...), which write the canvas only if `semantics.ambient.drawingWritesDevice` is set; the graph does not know them for a single call */
	readonly draws:                       ReadonlySet<NodeId>
}

/** The state of each {@link AmbientAccessKind} a call accesses, as it is given to {@link DataflowGraph#recordAmbientAccess} and serialized with the graph (in which the call is the key). */
export type AmbientAccessNames = { readonly [Kind in AmbientAccessKind]?: readonly AmbientStateName[] };

const Empty: AmbientAccess = {
	[AmbientAccessKind.Read]:    Relation.empty(),
	[AmbientAccessKind.Write]:   Relation.empty(),
	[AmbientAccessKind.Assumed]: Relation.empty(),
	[AmbientAccessKind.Local]:   Relation.empty(),
	variables:                   Relation.empty(),
	draws:                       new Set()
};

/** What all of `accesses` together access. What one of them changes is no longer only assumed changed. */
function concatAll(accesses: readonly AmbientAccess[]): AmbientAccess {
	const given = accesses.filter(a => a !== Empty);
	if(given.length <= 1) {
		return given[0] ?? Empty;
	}
	const union = (kind: AmbientAccessKind) => Relation.unionAll(given.map(a => a[kind]));
	const writes = union(AmbientAccessKind.Write);
	return {
		[AmbientAccessKind.Read]:    union(AmbientAccessKind.Read),
		[AmbientAccessKind.Write]:   writes,
		[AmbientAccessKind.Assumed]: Relation.withoutKeysOf(union(AmbientAccessKind.Assumed), writes),
		[AmbientAccessKind.Local]:   union(AmbientAccessKind.Local),
		variables:                   Relation.unionAll(given.map(a => a.variables)),
		draws:                       new Set(given.flatMap(a => [...a.draws]))
	};
}

/**
 * Helper functions for the {@link AmbientAccess}.
 * @helper dataflow
 */
export const AmbientAccess = {
	name:   'AmbientAccess',
	/** Accesses nothing. */
	empty:  Empty,
	/** What accesses combine to, as what runs in sequence or what a function reaches through its callees. */
	monoid: { empty: Empty, concat: (a, b) => concatAll([a, b]), concatAll } as Monoid<AmbientAccess>,
	/** What the call `id` accesses, given the state it accesses (several times to add them up). All entries of a call share their ids, as the graph keeps this for every call touching global state. */
	ofCall(this: void, id: NodeId, ...names: readonly AmbientAccessNames[]): AmbientAccess {
		const ids = new Set([id]);
		const ofKind = (kind: AmbientAccessKind) => Relation.of(names.flatMap(n => n[kind] ?? []), ids);
		return {
			...Empty,
			[AmbientAccessKind.Read]:    ofKind(AmbientAccessKind.Read),
			[AmbientAccessKind.Write]:   ofKind(AmbientAccessKind.Write),
			[AmbientAccessKind.Assumed]: ofKind(AmbientAccessKind.Assumed),
			[AmbientAccessKind.Local]:   ofKind(AmbientAccessKind.Local)
		};
	},
	/** The state of each kind `access` accesses, without who accesses it. Mind that the order of names is not stable, so use {@link AmbientAccess.equals} to compare them. */
	names(this: void, access: AmbientAccess): Required<AmbientAccessNames> {
		return {
			[AmbientAccessKind.Read]:    [...access[AmbientAccessKind.Read].keys()],
			[AmbientAccessKind.Write]:   [...access[AmbientAccessKind.Write].keys()],
			[AmbientAccessKind.Assumed]: [...access[AmbientAccessKind.Assumed].keys()],
			[AmbientAccessKind.Local]:   [...access[AmbientAccessKind.Local].keys()]
		};
	},
	/** Whether both access the same state in the same way, no matter by which calls. */
	equals(this: void, a: AmbientAccess, b: AmbientAccess): boolean {
		return Kinds.every(kind => setEquals(new Set(a[kind].keys()), new Set(b[kind].keys())));
	}
} as const;
