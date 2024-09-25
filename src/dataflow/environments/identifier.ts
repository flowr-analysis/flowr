import type { BuiltInIdentifierConstant, BuiltInIdentifierDefinition } from './built-in';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../info';

export type Identifier = string & { __brand?: 'identifier' }

export const enum ReferenceType {
	/** The identifier type is unknown */
	Unknown,
	/** The identifier is defined by a function (includes built-in function) */
	Function,
	/** The identifier is defined by a variable (includes parameter and argument) */
	Variable,
	/** The identifier is defined by a constant (includes built-in constant) */
	Constant,
	/** The identifier is defined by a parameter (which we know nothing about at the moment) */
	Parameter,
	/** The identifier is defined by an argument (which we know nothing about at the moment) */
	Argument,
	/** The identifier is defined by a built-in value/constant */
	BuiltInConstant,
	/** The identifier is defined by a built-in function */
	BuiltInFunction
}

export type InGraphReferenceType = Exclude<ReferenceType, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction>

/**
 * Something like `a` in `b <- a`.
 * Without any surrounding information, `a` will produce the identifier reference `a`.
 * Similarly, `b` will create a reference.
 */
export interface IdentifierReference {
	/** Node which represents the reference in the AST */
	readonly nodeId:     NodeId
	/** Name the reference is identified by (e.g., the name of the variable), undefined if the reference is "artificial" (e.g., anonymous) */
	readonly name:       Identifier | undefined
	/** Type of the reference to be resolved */
	readonly type:       ReferenceType;
	/**
	 * If the reference is only effective, if, for example, an if-then-else condition is true, this references the root of the `if`.
	 * As a hacky intermediate solution (until we have pointer-analysis), an empty array may indicate a `maybe` which is due to pointer access (e.g., in `a[x] <- 3`).
	 */
	controlDependencies: ControlDependency[] | undefined
}


interface InGraphIdentifierDefinition extends IdentifierReference {
	readonly type:      InGraphReferenceType
	/** The assignment (or whatever, like `assign` function call) node which ultimately defined this identifier */
	readonly definedAt: NodeId
}

/**
 * Stores the definition of an identifier within an {@link IEnvironment}
 */
export type IdentifierDefinition = InGraphIdentifierDefinition | BuiltInIdentifierDefinition | BuiltInIdentifierConstant
