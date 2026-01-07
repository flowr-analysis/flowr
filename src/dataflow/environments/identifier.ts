import type { BuiltInIdentifierConstant, BuiltInIdentifierDefinition } from './built-in';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../info';
import type { ContainerIndicesCollection } from '../graph/vertex';

export type Identifier = string & { __brand?: 'identifier' }

/**
 * Each reference has exactly one reference type, stored as the respective number.
 * However, when checking, we may want to allow for one of several types,
 * allowing the combination of the respective bitmasks.
 *
 * Having reference types is important as R separates a variable definition from
 * a function when resolving an {@link Identifier|identifier}.
 * In `c <- 3; print(c(1, 2))` the call to `c` works normally (as the vector constructor),
 * while writing `c <- function(...) ..1` overshadows the built-in and causes `print` to only output the first element.
 * @see {@link isReferenceType} - for checking if a (potentially joint) reference type contains a certain type
 * @see {@link ReferenceTypeReverseMapping} - for debugging
 */
export enum ReferenceType {
	/** The identifier type is unknown */
	Unknown = 1,
	/** The identifier is defined by a function (includes built-in function) */
	Function = 2,
	/** The identifier is defined by a variable (includes parameter and argument) */
	Variable = 4,
	/** The identifier is defined by a constant (includes built-in constant) */
	Constant = 8,
	/** The identifier is defined by a parameter (which we know nothing about at the moment) */
	Parameter = 16,
	/** The identifier is defined by an argument (which we know nothing about at the moment) */
	Argument = 32,
	/** The identifier is defined by a built-in value/constant */
	BuiltInConstant = 64,
	/** The identifier is defined by a built-in function */
	BuiltInFunction = 128
}

/** Reverse mapping of the reference types so you can get the name from the bitmask (useful for debugging) */
export const ReferenceTypeReverseMapping = new Map<ReferenceType, string>(Object.entries(ReferenceType).map(([k, v]) => [v as ReferenceType, k]));

/**
 * Check if the reference types have an overlapping type!
 */
export function isReferenceType(t: ReferenceType, target: ReferenceType): boolean {
	return (t & target) !== 0;
}

/**
 * Describes all types of reference (definitions) that can appear within a graph (i.e., that are not built-in like the
 * default definition for the assignment operator `<-`).
 * @see {@link InGraphIdentifierDefinition} - for the definition of an identifier within the graph
 */
export type InGraphReferenceType = Exclude<ReferenceType, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction>

/**
 * An identifier reference points to a variable like `a` in `b <- a`.
 * Without any surrounding code, `a` will produce the identifier reference `a`.
 * Similarly, `b` will create a reference (although it will be an {@link IdentifierDefinition|identifier definition}
 * which adds even more information).
 *
 * In general,
 * references are merely pointers (with meta-information) to a vertex in the {@link DataflowGraph|dataflow graph}.
 * In the context of the extractor, for example,
 * they indicate the references that are currently (during the analysis at this given node)
 * {@link DataflowInformation#in|read (`in`)}, {@link DataflowInformation#out|written (`out`)},
 * or {@link DataflowInformation#unknownReferences|unknown (`unknownReferences`)}.
 * @see {@link InGraphIdentifierDefinition}
 */
export interface IdentifierReference {
	/**
	 * The id of the node which represents the reference in the {@link NormalizedAst|normalized AST} and the {@link DataflowGraph|dataflow graph}.
	 */
	readonly nodeId:      NodeId
	/** Name the reference is identified by (e.g., the name of the variable), undefined if the reference is "artificial" (e.g., anonymous) */
	readonly name:        Identifier | undefined
	/** Type of the reference to be resolved */
	readonly type:        ReferenceType;
	/**
	 * If the reference is only effective, if, for example, an if-then-else condition is true, this references the root of the `if`.
	 * As a hacky intermediate solution (until we have pointer-analysis), an empty array may indicate a `maybe` which is due to pointer access (e.g., in `a[x] <- 3`).
	 */
	controlDependencies?: ControlDependency[] | undefined
}

/**
 * The definition of an {@link Identifier|identifier} within the {@link DataflowGraph|graph}.
 * This extends on the {@link IdentifierReference}
 * by adding the {@link NodeId} of the definition
 * (and using `type` to mark the object type).
 *
 * Within a code snippet like `a <- 3`, the symbol processor will first create an
 * {@link IdentifierReference|identifier reference} for `a` to reference the use
 * and then promote it to an {@link InGraphIdentifierDefinition|identifier definition}.
 * @see {@link IdentifierReference}
 */
export interface InGraphIdentifierDefinition extends IdentifierReference {
	readonly type:      InGraphReferenceType
	/**
	 * The assignment node which ultimately defined this identifier
	 * (the arrow operator for e.g. `x <- 3`, or `assign` call in `assign("x", 3)`)
	 */
	readonly definedAt: NodeId
	/**
	 * For value tracking, this contains all nodeIds of constant values that may be made available to this identifier
	 * For example, in `x <- 3; y <- x`, the definition of `y` will have the value `3` in its value set
	 */
	readonly value?:    NodeId[]
	/**
	 * this attribute links a definition to indices (pointer links) it may be affected by or related to
	 */
	indicesCollection?: ContainerIndicesCollection
}

/**
 * Stores the definition of an identifier within an {@link IEnvironment}.
 *
 * {@link BuiltInIdentifierDefinition} and {@link BuiltInIdentifierConstant} are used for built-in functions and constants only,
 * so the most important one for your day-to-day R script is the {@link InGraphIdentifierDefinition}.
 */
export type IdentifierDefinition = InGraphIdentifierDefinition | BuiltInIdentifierDefinition | BuiltInIdentifierConstant
