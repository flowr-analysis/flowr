/**
 * Applying {@link KillReference|kills} (e.g., produced by `rm`) to an {@link REnvironmentInformation}.
 * @module
 */
import type { ControlDependency, KillReference } from '../info';
import { happensInEveryBranch, negateControlDependency } from '../info';
import type { Environment, REnvironmentInformation } from './environment';
import type { IdentifierDefinition, IdentifierReference } from './identifier';
import { Identifier, ReferenceType } from './identifier';

/**
 * Drops the kills that a later write revives: a re-definition cancels a pending `named` removal of that name,
 * and any write cancels a wholesale (`all`/`unknown`) removal. Used when bubbling kills out of an expression
 * list so a merging parent only sees the removals still in effect at the list's exit.
 */
export function cancelRevivedKills(kills: readonly KillReference[], writes: readonly IdentifierReference[]): KillReference[] {
	const written = new Set<Identifier>();
	for(const w of writes) {
		if(w.name !== undefined) {
			written.add(w.name);
		}
	}
	if(written.size === 0) {
		return kills as KillReference[];
	}
	return kills.filter(k => k.kind === 'named' && k.reference.name !== undefined && !written.has(k.reference.name));
}

function isBuiltInDef(d: IdentifierDefinition): boolean {
	return d.type === ReferenceType.BuiltInFunction || d.type === ReferenceType.BuiltInConstant;
}

function mergeCds(base: readonly ControlDependency[] | undefined, toAdd: readonly ControlDependency[]): ControlDependency[] {
	const result = base ? Array.from(base) : [];
	for(const c of toAdd) {
		if(!result.some(e => e.id === c.id && e.when === c.when)) {
			result.push(c);
		}
	}
	return result;
}

/** copy-on-write copy of the definition carrying the additional cds, marking it as maybe */
function weakenDefinition(def: IdentifierDefinition, cds: readonly ControlDependency[]): IdentifierDefinition {
	return { ...def, cds: mergeCds(def.cds, cds) };
}

/** attaches `cds` to every user definition of `name` along the environment chain */
function weakenName(env: Environment, name: Identifier, cds: readonly ControlDependency[]): void {
	const [plainName, ns] = Identifier.toArray(name);
	let current: Environment | undefined = env;
	while(current && !current.builtInEnv) {
		if(ns === undefined || current.n === ns) {
			const defs = current.memory.get(plainName);
			if(defs !== undefined && defs.some(d => !isBuiltInDef(d))) {
				current.memory.set(plainName, defs.map(d => isBuiltInDef(d) ? d : weakenDefinition(d, cds)));
				current.cache?.delete(plainName);
			}
		}
		current = current.parent;
	}
}

/** attaches `cds` to every user definition in the current frame */
function weakenAll(env: Environment, cds: readonly ControlDependency[]): void {
	if(env.builtInEnv) {
		return;
	}
	for(const [key, defs] of env.memory) {
		if(defs.some(d => !isBuiltInDef(d))) {
			env.memory.set(key, defs.map(d => isBuiltInDef(d) ? d : weakenDefinition(d, cds)));
		}
	}
	env.cache?.clear();
}

/** removes every user definition from the current frame (e.g., `rm(list = ls())`) */
function removeAllInFrame(env: Environment): void {
	if(env.builtInEnv) {
		return;
	}
	for(const [key, defs] of env.memory) {
		if(defs.every(isBuiltInDef)) {
			continue;
		}
		const kept = defs.filter(isBuiltInDef);
		if(kept.length === 0) {
			env.memory.delete(key);
		} else {
			env.memory.set(key, kept);
		}
	}
	env.cache?.clear();
}

function applyNamedKill(env: Environment, name: Identifier, refs: readonly IdentifierReference[]): void {
	// certain if any kill is unconditional or the kills together cover every branch
	const certain = refs.some(r => happensInEveryBranch(r.cds)) || happensInEveryBranch(refs.flatMap(r => r.cds ?? []));
	if(certain) {
		env.remove(name);
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
	// group named kills by name so removals that together cover all branches become a hard removal
	const named = new Map<Identifier, IdentifierReference[]>();
	for(const kill of kills) {
		switch(kill.kind) {
			case 'named':
				if(kill.reference.name !== undefined) {
					const group = named.get(kill.reference.name);
					if(group) {
						group.push(kill.reference);
					} else {
						named.set(kill.reference.name, [kill.reference]);
					}
				}
				break;
			case 'all':
				if(happensInEveryBranch(kill.cds)) {
					removeAllInFrame(current);
				} else {
					weakenAll(current, (kill.cds ?? []).map(negateControlDependency));
				}
				break;
			case 'unknown':
				weakenAll(current, kill.cds ?? []);
				break;
		}
	}
	for(const [name, refs] of named) {
		applyNamedKill(current, name, refs);
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
			return { kind: 'named', reference: { ...k.reference, cds: mergeCds(k.reference.cds, cds) } };
		}
		return { ...k, cds: mergeCds(k.cds, cds) };
	});
}
