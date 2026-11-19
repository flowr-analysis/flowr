/**
 * Applying {@link KillReference|kills} (e.g., produced by `rm`) to an {@link REnvironmentInformation}.
 * @module
 */
import { AmbientStateName } from './ambient-state-name';
import { type ControlDependency, type KillReference, happensInEveryBranch, negateControlDependency, withCds } from '../info';
import type { Environment, REnvironmentInformation } from './environment';
import {
	type BrandedIdentifier,
	type IdentifierDefinition,
	type IdentifierReference,
	type InGraphIdentifierDefinition,
	Identifier,
	ReferenceType
} from './identifier';
import { anyRemovalMarker, noteRemovalMarker, removalMarkerOf, removedNameOf } from './removal-marker';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { withAppliedCds } from './reference-to-maybe';
import type { DataflowGraph } from '../graph/graph';
import { EdgeType } from '../graph/edge';
import { DefaultMap } from '../../util/collections/defaultmap';

/** Accounts for the writes after a kill: a re-definition revives a `named` removal (dropping it), a conditional one only revives it in its branch, and a wholesale (`all`/`unknown`) removal stays but spares the names written after it. */
export function cancelRevivedKills(kills: readonly KillReference[], writes: readonly IdentifierReference[]): KillReference[] {
	const written = new Set<BrandedIdentifier>();
	const writtenMaybe = new Map<BrandedIdentifier, ControlDependency[]>();
	const maybe = new DefaultMap<BrandedIdentifier, ControlDependency[]>(() => [], writtenMaybe);
	for(const w of writes) {
		if(w.name === undefined) {
			continue;
		}
		const name = Identifier.getName(w.name);
		written.add(name);
		if(!happensInEveryBranch(w.cds)) {
			maybe.get(name).push(...w.cds as ControlDependency[]);
		} else {
			writtenMaybe.delete(name);
		}
	}
	if(written.size === 0) {
		return kills as KillReference[];
	}
	/* conditional writes that cover every branch together revive the name just as an unconditional one does */
	for(const [name, cds] of writtenMaybe) {
		if(happensInEveryBranch(cds)) {
			writtenMaybe.delete(name);
		}
	}
	const remaining: KillReference[] = [];
	for(const kill of kills) {
		if(kill.kind === 'named') {
			const name = kill.reference.name === undefined ? undefined : Identifier.getName(kill.reference.name);
			const maybeCds = name === undefined ? undefined : writtenMaybe.get(name);
			if(maybeCds !== undefined) {
				/* the removal still stands wherever the conditional re-definition did not happen */
				remaining.push({ kind: 'named', reference: { ...kill.reference, cds: withCds(kill.reference.cds, maybeCds.map(negateControlDependency)) } });
			} else if(name === undefined || !written.has(name)) {
				remaining.push(kill);
			}
		} else {
			remaining.push({ ...kill, except: kill.except ? written.union(kill.except) : written });
		}
	}
	return remaining;
}

function isBuiltInDef(d: IdentifierDefinition): boolean {
	return d.type === ReferenceType.BuiltInFunction || d.type === ReferenceType.BuiltInConstant;
}

/** the definitions with `cds` attached to every user definition, `undefined` if there is none */
function weakened(defs: readonly IdentifierDefinition[] | undefined, cds: readonly ControlDependency[]): IdentifierDefinition[] | undefined {
	return defs?.some(d => !isBuiltInDef(d)) ? defs.map(d => isBuiltInDef(d) ? d : withAppliedCds(d, cds)) : undefined;
}

/** attaches `cds` to every user definition of `name` along the environment chain */
function weakenName(env: Environment, name: Identifier, cds: readonly ControlDependency[]): void {
	const [plainName, ns] = Identifier.toArray(name);
	let current: Environment | undefined = env;
	while(current && !current.builtInEnv) {
		if(ns === undefined || current.n === ns) {
			const defs = weakened(current.memory.get(plainName), cds);
			if(defs !== undefined) {
				current.writableMemory.set(plainName, defs);
				current.cache?.delete(plainName);
			}
		}
		current = current.writableParent;
	}
}

/** attaches `cds` to every user definition in the current frame, except the re-defined names */
function weakenAll(env: Environment, cds: readonly ControlDependency[], except?: ReadonlySet<BrandedIdentifier>): void {
	if(env.builtInEnv) {
		return;
	}
	for(const [key, defs] of env.memory) {
		/* the options and graphics state flowR keeps as `#...` variables, which `rm(list = ls())` does not touch in R */
		const changed = except?.has(key) || AmbientStateName.is(key) ? undefined : weakened(defs, cds);
		if(changed !== undefined) {
			env.writableMemory.set(key, changed);
		}
	}
	env.cache?.clear();
}

/** removes every user definition from the current frame (e.g., `rm(list = ls())`), except the re-defined names, and records the call `killedBy` as the one that removed each */
function removeAllInFrame(env: Environment, except?: ReadonlySet<BrandedIdentifier>, killedBy?: NodeId): void {
	if(env.builtInEnv) {
		return;
	}
	const removed: BrandedIdentifier[] = [];
	for(const [key, defs] of env.memory) {
		if(except?.has(key) || AmbientStateName.is(key) || defs.every(isBuiltInDef) || removedNameOf(key) !== key) {
			continue;
		}
		const kept = defs.filter(isBuiltInDef);
		if(kept.length === 0) {
			env.writableMemory.delete(key);
		} else {
			env.writableMemory.set(key, kept);
		}
		removed.push(key);
	}
	if(killedBy !== undefined) {
		for(const key of removed) {
			markRemoval(env, key, [killedBy], undefined);
		}
	}
	env.cache?.clear();
}

const NoRemovals: readonly NodeId[] = [];

/** The calls that removed `name` from the scope it would otherwise still be bound in. */
export function removalsOf(name: Identifier, env: REnvironmentInformation): readonly NodeId[] {
	const plain = Identifier.getName(name);
	if(!anyRemovalMarker(plain)) {
		return NoRemovals;
	}
	const marker = removalMarkerOf(plain);
	let nodes: NodeId[] | undefined = undefined;
	for(let e: Environment | undefined = env.current; e !== undefined && !e.builtInEnv; e = e.parent) {
		for(const def of e.memory.get(marker) ?? []) {
			const definedAt = (def as Partial<InGraphIdentifierDefinition>).definedAt;
			if(definedAt !== undefined) {
				(nodes ??= []).push(definedAt);
			}
		}
	}
	return nodes ?? NoRemovals;
}

/** A read of `name` that still sees a definition depends on the calls that may have removed it, so a slice of the read keeps the `rm(name)` that might have run. */
export function readRemovals(graph: DataflowGraph, read: NodeId, name: Identifier | undefined, env: REnvironmentInformation): void {
	for(const removal of name === undefined ? NoRemovals : removalsOf(name, env)) {
		graph.addEdge(read, removal, EdgeType.Reads);
	}
}

/** Groups the `named` kills by the name they remove, so removals from separate branches are decided together. */
function groupNamedKills(kills: readonly KillReference[]): Map<Identifier, { refs: IdentifierReference[], by?: NodeId[] }> {
	const named = new Map<Identifier, { refs: IdentifierReference[], by?: NodeId[] }>();
	const groups = new DefaultMap<Identifier, { refs: IdentifierReference[], by?: NodeId[] }>(() => ({ refs: [] }), named);
	for(const kill of kills) {
		if(kill.kind === 'named' && kill.reference.name !== undefined) {
			const group = groups.get(kill.reference.name);
			group.refs.push(kill.reference);
			if(kill.killedBy !== undefined) {
				(group.by ??= []).push(kill.killedBy);
			}
		}
	}
	return named;
}

/** A removal is certain if one of its references is unconditional or if they together cover every branch. */
function isCertainRemoval(refs: readonly IdentifierReference[]): boolean {
	return refs.some(r => happensInEveryBranch(r.cds)) || happensInEveryBranch(refs.flatMap(r => r.cds ?? []));
}

/** Records the calls `killedBy` as removals of `name` in the frame, which replace the earlier ones unless `cds` makes them maybe. */
function markRemoval(env: Environment, name: Identifier, killedBy: readonly NodeId[], cds: readonly ControlDependency[] | undefined): void {
	const plain = Identifier.getName(name);
	const marker = removalMarkerOf(plain);
	noteRemovalMarker(plain);
	const earlier = cds === undefined ? [] : env.memory.get(marker) ?? [];
	env.writableMemory.set(marker, earlier.concat(killedBy.map(by => (
		{ name: marker, type: ReferenceType.Variable, nodeId: by, definedAt: by, cds }
	))));
}

function applyNamedKill(env: Environment, name: Identifier, refs: readonly IdentifierReference[], killedBy: readonly NodeId[] | undefined, mark: boolean): void {
	if(isCertainRemoval(refs)) {
		const removed = env.lookup(Identifier.getName(name)) !== undefined;
		env.remove(name);
		if((removed || mark) && killedBy !== undefined) {
			markRemoval(env, name, killedBy, undefined);
		}
	} else {
		// the definition survives unless the killing branch executed
		for(const ref of refs) {
			weakenName(env, name, (ref.cds ?? []).map(negateControlDependency));
		}
		if(mark && killedBy !== undefined) {
			markRemoval(env, name, killedBy, refs.flatMap(r => r.cds ?? []));
		}
	}
}

/** Applies the given {@link KillReference|kills} to a copy of `env`. */
export function applyKills(env: REnvironmentInformation, kills: readonly KillReference[] | undefined, mark = false): REnvironmentInformation {
	if(!kills || kills.length === 0) {
		return env;
	}
	const current = env.current.clone(true);
	applyKillsToFrame(current, kills, mark);
	return { current, level: env.level };
}

/** {@link applyKills} on the global frame, as a removal with `envir = .GlobalEnv` within a function does. */
export function applyGlobalKills(env: REnvironmentInformation, kills: readonly KillReference[]): REnvironmentInformation {
	const current = env.current.clone(true);
	let global = current;
	while(!global.globalEnv && !global.parent.builtInEnv) {
		global = global.writableParent;
	}
	applyKillsToFrame(global, kills, true);
	return { current, level: env.level };
}

function applyKillsToFrame(current: Environment, kills: readonly KillReference[], mark: boolean): void {
	for(const kill of kills) {
		if(kill.kind === 'all') {
			if(happensInEveryBranch(kill.cds)) {
				removeAllInFrame(current, kill.except, kill.killedBy);
			} else {
				weakenAll(current, (kill.cds ?? []).map(negateControlDependency), kill.except);
			}
		} else if(kill.kind === 'unknown') {
			weakenAll(current, kill.cds ?? [], kill.except);
		}
	}
	for(const [name, { refs, by }] of groupNamedKills(kills)) {
		applyNamedKill(current, name, refs, by, mark);
	}
}

/** Attaches `cds` to a list of kills, turning them into conditional (maybe) kills. */
export function makeKillsMaybe(kills: readonly KillReference[] | undefined, cds: readonly ControlDependency[]): KillReference[] {
	if(!kills || kills.length === 0) {
		return [];
	}
	return kills.map(k => k.kind === 'named' ? { kind: 'named', reference: { ...k.reference, cds: withCds(k.reference.cds, cds) }, killedBy: k.killedBy } : { ...k, cds: withCds(k.cds, cds) });
}

/** Drops the writes that a still-effective removal undid: a definite `named` kill takes out its own name and a definite wholesale kill takes out every name it did not spare. */
export function dropKilledWrites(out: readonly IdentifierReference[], kills: readonly KillReference[] | undefined): readonly IdentifierReference[] {
	if(!kills?.length || out.length === 0) {
		return out;
	}
	const removed = new Set<BrandedIdentifier>();
	for(const [name, { refs }] of groupNamedKills(kills)) {
		if(isCertainRemoval(refs)) {
			removed.add(Identifier.getName(name));
		}
	}
	const cleared = kills.flatMap(k => k.kind === 'all' && happensInEveryBranch(k.cds) ? [k.except] : []);
	if(removed.size === 0 && cleared.length === 0) {
		return out;
	}
	return out.filter(ref => {
		const name = ref.name === undefined ? undefined : Identifier.getName(ref.name);
		return name === undefined || (!removed.has(name) && !cleared.some(except => !except?.has(name)));
	});
}
