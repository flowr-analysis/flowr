import {
	UnnamedFunctionCallPrefix
} from '../../../../src/dataflow/internal/process/functions/call/unnamed-call-handling';
import { EmptyArgument } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierReference } from '../../../../src/dataflow/environments/identifier';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import type { ControlDependency, ExitPoint } from '../../../../src/dataflow/info';


/**
 * A node id as the dataflow test expectations spell it, quoted so it survives being read back.
 * @param id - the id to print
 */
export function wrap(id: string | NodeId | undefined): string {
	if(id === undefined) {
		return 'undefined';
	} else if(id === EmptyArgument) {
		return 'EmptyArgument';
	} else if(NodeId.isBuiltIn(id)) {
		return `builtInId(${id})`;
	} else if(typeof id === 'string' && id.startsWith(UnnamedFunctionCallPrefix)) {
		return `\`\${UnnamedFunctionCallPrefix}${id.slice(UnnamedFunctionCallPrefix.length)}\``;
	} else {
		return `'${id}'`;
	}
}


/**
 * Control dependencies as the dataflow test expectations spell them.
 * @param cds - the dependencies to print, absent for a node under none
 */
export function wrapControlDependencies(cds: ControlDependency[] | undefined): string {
	if(cds === undefined) {
		return 'undefined';
	} else {
		return `[${cds.map(c =>
			`{ id: ${wrap(c.id)}, when: ${c.when} }`
		).join(', ')}]`;
	}
}

/**
 * Wraps an identifier reference for printing.
 */
export function wrapReference(ref: IdentifierReference): string {
	return `{ nodeId: ${wrap(ref.nodeId)}, name: ${wrap(ref.name ? Identifier.getName(ref.name) : undefined)}, cds: ${wrapControlDependencies(ref.cds)} }`;
}
/**
 * Wraps an exit point for printing.
 */
export function wrapExitPoint(ep: ExitPoint): string {
	return `{ type: ${ep.type}, cds: ${wrapControlDependencies(ep.cds)}, nodeId: ${wrap(ep.nodeId)} }`;
}