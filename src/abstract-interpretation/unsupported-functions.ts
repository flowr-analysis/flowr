import { Identifier } from '../dataflow/environments/identifier';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { type DataflowGraphVertexArgument, type DataflowGraphVertexFunctionCall, isFunctionCallVertex } from '../dataflow/graph/vertex';
import { Record } from '../util/record';

interface UnsupportedFunctionInfo {
	readonly condition?: (vertex: DataflowGraphVertexFunctionCall, dfg: DataflowGraph) => boolean;
}

interface UnsupportedFunctionEntry extends UnsupportedFunctionInfo {
	readonly identifier: Identifier;
}

function unsupportedFunctions(functions: Record<`${string}::${string}`, UnsupportedFunctionInfo>): readonly UnsupportedFunctionEntry[] {
	return Record.entries(functions).map(([identifier, info]) => ({ identifier: Identifier.parse(identifier), ...info }));
}

/**
 * List of known function calls that may change the environment unresolvable/implicitly.
 */
const UnsupportedFunctionsList = unsupportedFunctions({
	'base::.Primitive':           {},
	'base::.Internal':            {},
	'base::.External':            {},
	'base::.Call':                {},
	'base::.C':                   {},
	'base::.Fortran':             {},
	'base::.dyn.load':            {},
	'base::eval':                 {},
	'base::evalq':                {},
	'base::eval.parent':          {},
	'rlang::eval_tidy':           {},
	'rlang::eval_bare':           {},
	'base::body<-':               {},
	'base::formals<-':            {},
	'base::environment<-':        {},
	'base::load':                 {},
	'base::attach':               {},
	'base::detach':               {},
	'base::rm':                   {},
	'base::remove':               {},
	'base::list2env':             {},
	'base::assign':               { condition: (vertex, dfg) => dfg.unknownSideEffects.has(vertex.id) },
	'base::delayedAssign':        { condition: (vertex, dfg) => dfg.unknownSideEffects.has(vertex.id) },
	'utils::assignInNamespace':   {},
	'utils::assignInMyNamespace': {},
});

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
		const entry = UnsupportedFunctionsList.find(entry => Identifier.matches(vertex.name, entry.identifier));

		return entry !== undefined && (entry.condition?.(vertex, dfg) ?? true);
	}
};
