import { Identifier } from '../dataflow/environments/identifier';
import { type DataflowGraphVertexArgument, isFunctionCallVertex } from '../dataflow/graph/vertex';

export const UnsupportedFunctions = {
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
 * Checks whether a data flow graph vertex represents a unsupported (environment-changing) function call (e.g. `eval`, `load`, `attach`, `rm`, ...)
 */
export function isUnsupportedFunctionCall(vertex: DataflowGraphVertexArgument | undefined): boolean {
	return isFunctionCallVertex(vertex) && Object.hasOwn(UnsupportedFunctions, Identifier.getName(vertex.name));
}
