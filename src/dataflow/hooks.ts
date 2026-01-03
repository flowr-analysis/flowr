import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from './info';

export enum KnownHooks {
	/** Triggers on the exit of a function, no matter how this exit is enforced. */
	OnFnExit = 'fn-exit',
}

/**
 * Information about a registered hook within the dataflow information.
 */
export interface HookInformation {
	/** The type of the hook */
	type: KnownHooks,
	/** The id of the function definition which is added by the hook */
	id:   NodeId,
	/** Control dependencies under which the hook was registered */
	cds:  ControlDependency[] | undefined,
	// TODO: handle add and after
}


/**
 * Compacts a list of hook registrations by removing redundant ones.
 */
export function compactHookStates(hooks: HookInformation[]): HookInformation[] {
	// TODO: handle add and after, for now only take the last one of each type
	const seen = new Set<KnownHooks>();
	const result: HookInformation[] = [];
	for(let i = hooks.length - 1; i >= 0; i--) {
		const hook = hooks[i];
		if(!seen.has(hook.type)) {
			seen.add(hook.type);
			result.push(hook);
		}
	}
	return result.reverse();
}

/**
 * Extracts all hooks of the given type from the list of hooks.
 */
export function extractHookInformation(hooks: HookInformation[], type: KnownHooks): [extract: HookInformation[], rest: HookInformation[]] {
	// TODO: consider cds, add, and after
	const extract: HookInformation[] = [];
	const rest: HookInformation[] = [];
	for(const hook of hooks) {
		if(hook.type === type) {
			extract.push(hook);
		} else {
			rest.push(hook);
		}
	}
	return [extract, rest];
}

