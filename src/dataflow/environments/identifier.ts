import type { NodeId } from '../../r-bridge'
import type { DataflowGraphEdgeAttribute } from '../graph'
import type { BuiltInIdentifierConstant, BuiltInIdentifierDefinition } from './built-in'

export type Identifier = string & { __brand?: 'identifier' }

interface InGraphIdentifierDefinition extends IdentifierReference {
	kind:      'function' | 'variable' | 'parameter' | 'unknown' | 'argument'
	/** The assignment (or whatever, like `assign` function call) node which ultimately defined this identifier */
	definedAt: NodeId
}

/**
 * Stores the definition of an identifier within an {@link IEnvironment}
 */
export type IdentifierDefinition = InGraphIdentifierDefinition | BuiltInIdentifierDefinition | BuiltInIdentifierConstant

/**
 * Something like `a` in `b <- a`.
 * Without any surrounding information, `a` will produce the
 * identifier reference `a` in the current scope (like the global environment).
 * Similarly, `b` will create a reference.
 */
export interface IdentifierReference {
	name:   Identifier,
	/** Node which represents the reference in the AST */
	nodeId: NodeId
	/**
	 * Is this reference used in every execution path of the program or only if some of them. This can be too-conservative regarding `maybe`.
	 * For example, if we can not detect `if(FALSE)`, this will be `maybe` even if we could statically determine, that the `then` branch is never executed.
	 */
	used:   DataflowGraphEdgeAttribute
}
