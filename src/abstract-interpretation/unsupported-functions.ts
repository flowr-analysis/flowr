import { Identifier } from '../dataflow/environments/identifier';
import { type DataflowGraphVertexArgument, isFunctionCallVertex } from '../dataflow/graph/vertex';

/**
 * List of known function calls that may change the environment unresolvable/implicitly.
 */
const UnsupportedFunctionsList = {
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
	'assignInNamespace':   { package: 'utils' },
	'assignInMyNamespace': { package: 'utils' },
} as const satisfies Record<string, { package: string }>;

/**
 * Helper for unsupported functions that may change the environment.
 */
export const UnsupportedFunctions = {
	/**
	 * Checks whether a data flow graph vertex represents a unsupported (environment-changing) function call (e.g. `eval`, `load`, `attach`, `rm`, ...)
	 */
	isUnsupportedCall(vertex: DataflowGraphVertexArgument | undefined): boolean {
		return isFunctionCallVertex(vertex) && Object.hasOwn(UnsupportedFunctionsList, Identifier.getName(vertex.name));
	}
};
