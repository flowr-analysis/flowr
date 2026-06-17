import { Identifier } from '../dataflow/environments/identifier';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { type DataflowGraphVertexArgument, type DataflowGraphVertexFunctionCall, isFunctionCallVertex } from '../dataflow/graph/vertex';

/**
 * Function info for unsupported functions that may change the environment unresolvable/implicitly.
 */
interface UnsupportedFunctionInfo {
	package:    string;
	condition?: (vertex: DataflowGraphVertexFunctionCall, dfg: DataflowGraph) => boolean;
}

/**
 * List of known function calls that may change the environment unresolvable/implicitly.
 */
const UnsupportedFunctionsList: Record<string, UnsupportedFunctionInfo> = {
	'.Primitive':          { package: 'base' },
	'.Internal':           { package: 'base' },
	'.External':           { package: 'base' },
	'.Call':               { package: 'base' },
	'.C':                  { package: 'base' },
	'.Fortran':            { package: 'base' },
	'.dyn.load':           { package: 'base' },
	'eval':                { package: 'base' },
	'evalq':               { package: 'base' },
	'eval.parent':         { package: 'base' },
	'eval_tidy':           { package: 'rlang' },
	'eval_bare':           { package: 'rlang' },
	'body<-':              { package: 'base' },
	'formals<-':           { package: 'base' },
	'environment<-':       { package: 'base' },
	'load':                { package: 'base' },
	'attach':              { package: 'base' },
	'detach':              { package: 'base' },
	'rm':                  { package: 'base' },
	'remove':              { package: 'base' },
	'list2env':            { package: 'base' },
	'assign':              { package: 'base', condition: (vertex, dfg) => dfg.unknownSideEffects.has(vertex.id) },
	'delayedAssign':       { package: 'base', condition: (vertex, dfg) => dfg.unknownSideEffects.has(vertex.id) },
	'assignInNamespace':   { package: 'utils' },
	'assignInMyNamespace': { package: 'utils' },
};

/**
 * Helper for unsupported functions that may change the environment.
 */
export const UnsupportedFunctions = {
	/**
	 * Checks whether a data flow graph vertex represents an unsupported (environment-changing) function call (e.g. `eval`, `load`, `attach`, `rm`, ...)
	 */
	isUnsupportedCall(this: void, vertex: DataflowGraphVertexArgument | undefined, dfg: DataflowGraph): boolean {
		if(!isFunctionCallVertex(vertex)) {
			return false;
		}
		const identifier = Identifier.getName(vertex.name);

		return Object.hasOwn(UnsupportedFunctionsList, identifier) && (UnsupportedFunctionsList[identifier].condition?.(vertex, dfg) ?? true);
	}
};
