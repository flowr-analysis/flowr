/**
 * Applying {@link KillReference|kills} (e.g., produced by `rm`) to an {@link REnvironmentInformation}.
 * @module
 */
import type { ControlDependency, KillReference } from '../info';
import { happensInEveryBranch, negateControlDependency, withCds } from '../info';
import type { Environment, REnvironmentInformation } from './environment';
import type { BrandedIdentifier, IdentifierDefinition, IdentifierReference, InGraphIdentifierDefinition } from './identifier';
import { anyRemovalMarker, noteRemovalMarker, removalMarkerOf } from './removal-marker';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier, ReferenceType } from './identifier';
import { withAppliedCds } from './reference-to-maybe';

/**
 * Accounts for the writes after a kill: a re-definition revives a `named` removal (dropping it), a conditional
 * one only revives it in its branch, and a wholesale (`all`/`unknown`) removal stays but spares the names written
 * after it.
 */
export function cancelRevivedKills(kills: readonly KillReference[], writes: readonly IdentifierReference[]): KillReference[] {
	const written = new Set<BrandedIdentifier>();
	const writtenMaybe = new Map<BrandedIdentifier, ControlDependency[]>();
	for(const w of writes) {
		if(w.name === undefined) {
			continue;
		}
		const name = Identifier.getName(w.name);
		written.add(name);
		if(!happensInEveryBranch(w.cds)) {
			const cds = writtenMaybe.get(name);
			if(cds) {
				cds.push(...w.cds as ControlDependency[]);
			} else {
				writtenMaybe.set(name, [...w.cds as ControlDependency[]]);
			}
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

/** attaches `cds` to every user definition of `name` along the environment chain */
function weakenName(env: Environment, name: Identifier, cds: readonly ControlDependency[]): void {
	const [plainName, ns] = Identifier.toArray(name);
	let current: Environment | undefined = env;
	while(current && !current.builtInEnv) {
		if(ns === undefined || current.n === ns) {
			const defs = current.memory.get(plainName);
			if(defs !== undefined && defs.some(d => !isBuiltInDef(d))) {
				current.writableMemory.set(plainName, defs.map(d => isBuiltInDef(d) ? d : withAppliedCds(d, cds)));
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
		if(except?.has(key)) {
			continue;
		}
		if(defs.some(d => !isBuiltInDef(d))) {
			env.writableMemory.set(key, defs.map(d => isBuiltInDef(d) ? d : withAppliedCds(d, cds)));
		}
	}
	env.cache?.clear();
}

/** removes every user definition from the current frame (e.g., `rm(list = ls())`), except the re-defined names */
function removeAllInFrame(env: Environment, except?: ReadonlySet<BrandedIdentifier>): void {
	if(env.builtInEnv) {
		return;
	}
	for(const [key, defs] of env.memory) {
		if(except?.has(key) || defs.every(isBuiltInDef)) {
			continue;
		}
		const kept = defs.filter(isBuiltInDef);
		if(kept.length === 0) {
			env.writableMemory.delete(key);
		} else {
			env.writableMemory.set(key, kept);
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
		const defs = e.memory.get(marker);
		if(defs === undefined) {
			continue;
		}
		for(const def of defs) {
			const definedAt = (def as Partial<InGraphIdentifierDefinition>).definedAt;
			if(definedAt !== undefined) {
				(nodes ??= []).push(definedAt);
			}
		}
	}
	return nodes ?? NoRemovals;
}

/** Groups the `named` kills by the name they remove, so removals from separate branches are decided together. */
function groupNamedKills(kills: readonly KillReference[]): Map<Identifier, { refs: IdentifierReference[], by?: NodeId[] }> {
	const named = new Map<Identifier, { refs: IdentifierReference[], by?: NodeId[] }>();
	for(const kill of kills) {
		if(kill.kind !== 'named' || kill.reference.name === undefined) {
			continue;
		}
		const group = named.get(kill.reference.name);
		if(group === undefined) {
			named.set(kill.reference.name, { refs: [kill.reference], by: kill.killedBy !== undefined ? [kill.killedBy] : undefined });
		} else {
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

function applyNamedKill(env: Environment, name: Identifier, refs: readonly IdentifierReference[], killedBy: readonly NodeId[] | undefined): void {
	if(isCertainRemoval(refs)) {
		/* only a removal that took something away can reveal what was hidden underneath it */
		const removed = env.lookup(Identifier.getName(name)) !== undefined;
		env.remove(name);
		if(removed && killedBy !== undefined) {
			const plain = Identifier.getName(name);
			const marker = removalMarkerOf(plain);
			noteRemovalMarker(plain);
			env.writableMemory.set(marker, killedBy.map(by => (
				{ name: marker, type: ReferenceType.Variable, nodeId: by, definedAt: by, cds: undefined }
			)));
		}
	} else {
		// the definition survives unless the killing branch executed
		for(const ref of refs) {
			weakenName(env, name, (ref.cds ?? []).map(negateControlDependency));
		}
	}
}

/**
 * Applies the given {@link KillReference|kills} to a copy of `env`. `named` kills remove (or, when conditional,
 * weaken to maybe) a single definition; `all` kills clear the current frame; `unknown` kills weaken every
 * in-scope definition to maybe. Returns `env` unchanged when there is nothing to apply.
 */
export function applyKills(env: REnvironmentInformation, kills: readonly KillReference[] | undefined): REnvironmentInformation {
	if(!kills || kills.length === 0) {
		return env;
	}
	const current = env.current.clone(true);
	for(const kill of kills) {
		if(kill.kind === 'all') {
			if(happensInEveryBranch(kill.cds)) {
				removeAllInFrame(current, kill.except);
			} else {
				weakenAll(current, (kill.cds ?? []).map(negateControlDependency), kill.except);
			}
		} else if(kill.kind === 'unknown') {
			weakenAll(current, kill.cds ?? [], kill.except);
		}
	}
	for(const [name, { refs, by }] of groupNamedKills(kills)) {
		applyNamedKill(current, name, refs, by);
	}
	return { current, level: env.level };
}

/** Attaches `cds` to a list of kills, turning them into conditional (maybe) kills. */
export function makeKillsMaybe(kills: readonly KillReference[] | undefined, cds: readonly ControlDependency[]): KillReference[] {
	if(!kills || kills.length === 0) {
		return [];
	}
	return kills.map(k => {
		if(k.kind === 'named') {
			return { kind: 'named', reference: { ...k.reference, cds: withCds(k.reference.cds, cds) }, killedBy: k.killedBy };
		}
		return { ...k, cds: withCds(k.cds, cds) };
	});
}

/**
 * Drops the writes that a still-effective removal undid: a definite `named` kill takes out its own name and a
 * definite wholesale kill takes out every name it did not spare. Conditional and `unknown` kills leave the (now
 * maybe) definition in place, as it may still be visible afterwards.
 */
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
		if(ref.name === undefined) {
			return true;
		}
		const name = Identifier.getName(ref.name);
		return !removed.has(name) && !cleared.some(except => !except?.has(name));
	});
}
