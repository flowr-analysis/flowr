import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from './info';
import { happensInEveryBranch, negateControlDependency } from './info';
import { DefaultMap } from '../util/collections/defaultmap';
import type { KnownHooks } from './environments/built-in-kinds';
export { KnownHooks } from './environments/built-in-kinds';


/** Information about a registered hook within the dataflow information. */
export interface HookInformation {
	/** The type of the hook */
	type:   KnownHooks,
	/** The id of the function definition which is added by the hook */
	id:     NodeId,
	/** Control dependencies under which the hook was registered */
	cds?:   readonly ControlDependency[],
	/** Whether the hook is added on top of existing ones (true) or replaces them (false) */
	add?:   boolean,
	/** Whether the hook is executed after existing ones (true) or before (false) */
	after?: boolean
}


/** Compacts a list of hook registrations by removing redundant and dominated ones. */
export function compactHookStates(hooks: HookInformation[]): HookInformation[] {
	const hooksByType: DefaultMap<KnownHooks, HookInformation[]> = new DefaultMap(() => []);
	for(const hook of hooks) {
		if(!hook.add && happensInEveryBranch(hook.cds)) {
			hooksByType.set(hook.type, [hook]);
			continue;
		}
		if(!hook.add) {
			/* a replacement that may not happen leaves the hooks before it in place only maybe */
			hooksByType.set(hook.type, hooksUnder(hooksByType.get(hook.type), hook.cds?.map(negateControlDependency) ?? []));
		}
		if(hook.after) {
			hooksByType.get(hook.type).push(hook);
		} else {
			hooksByType.get(hook.type).unshift(hook);
		}
	}

	return hooksByType.values().flatMap(f => f).toArray();
}

/** The hooks as registered only under the given control dependencies, for hooks registered in a branch or loop body that may not run. */
export function hooksUnder(hooks: readonly HookInformation[], cds: readonly ControlDependency[]): HookInformation[] {
	return hooks.map(h => ({ ...h, cds: (h.cds ?? []).concat(cds) }));
}

/** Extracts all hooks of the given type from the list of hooks. Please consider {@link compactHookStates} to remove redundant or dominated hooks first. */
export function getHookInformation(hooks: HookInformation[], type: KnownHooks): HookInformation[] {
	return hooks.filter(h => h.type === type);
}

