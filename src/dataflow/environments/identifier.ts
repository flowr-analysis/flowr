import type { BuiltInIdentifierConstant, BuiltInIdentifierDefinition } from './built-in';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../info';
import { startAndEndsWith } from '../../util/text/strings';

/** this is just a safe-guard type to prevent mixing up branded identifiers with normal strings */
export type BrandedIdentifier = string & { __brand?: 'identifier' };
/** this is just a safe-guard type to prevent mixing up branded namespaces with normal strings */
export type BrandedNamespace = string & { __brand?: 'namespace' };

/**
 * Refers to an identifier by its name.
 * This can either be a simple name like `a` or a namespaced name like `pkg::a` (stored as ['a', 'pkg']).
 * By storing the namespace second, you can easily access the actual name via `id[0]`.
 * This represents the fundamental way to represent binding names in R.
 * @see {@link Identifier.getName} - to get the name part
 * @see {@link Identifier.getNamespace} - to get the namespace part
 * @see {@link Identifier.accessesInternal} - to check if the identifier accesses internal objects (`:::`)
 * @see {@link Identifier.toString} - to convert the identifier to a string representation
 */
export type Identifier = BrandedIdentifier | [id: BrandedIdentifier, namespace: BrandedNamespace, internal?: boolean];

const dotDotDotAccess = /^\.\.\d+$/;

/**
 * Helper functions to work with {@link Identifier|identifiers}.
 * Use {@link Identifier.matches} to check if two identifiers match according to R's scoping rules!
 * @example
 * ```ts
 * const id1 = Identifier.make('a', 'pkg');
 * const id2 = Identifier.parse('pkg::a');
 * const id3 = Identifier.parse('a');
 * Identifier.matches(id1, id2); // true
 * Identifier.matches(id3, id2); // true, as id3 has no namespace
 * ```
 */
export const Identifier = {
	/**
	 * Create an identifier from its name and optional namespace.
	 * Please note that for `internal` to count, a namespace must be provided!
	 */
	make(this: void, name: BrandedIdentifier, namespace?: BrandedNamespace, internal: boolean = false): Identifier {
		if(startAndEndsWith(name, '`')) {
			name = name.substring(1, name.length - 1) as BrandedIdentifier;
		}
		if(namespace) {
			return [name, namespace, internal];
		} else {
			return name;
		}
	},
	/**
	 * Parse an identifier from its string representation,
	 * Please note, that in R if one writes `"pkg::a"` this refers to a symbol named `pkg::a` and NOT to the namespaced identifier `a` in package `pkg`.
	 * In this scenario, see {@link Identifier.make} instead.
	 */
	parse(this: void, str: string): Identifier {
		const internal = str.includes(':::');
		const parts = str.split(internal ? ':::' : '::');
		if(parts.length === 2) {
			return [parts[1] as BrandedIdentifier, parts[0] as BrandedNamespace, internal];
		}
		return parts[0] as BrandedIdentifier;
	},
	/**
	 * Get the name part of the identifier
	 */
	getName(this: void, id: Identifier): BrandedIdentifier {
		return Array.isArray(id) ? id[0] : id;
	},
	/**
	 * Get the namespace part of the identifier, undefined if there is none
	 */
	getNamespace(this: void, id: Identifier): BrandedNamespace | undefined {
		return Array.isArray(id) ? id[1] : undefined;
	},
	/**
	 * Check if the identifier accesses internal objects (`:::`)
	 */
	accessesInternal(this: void, id: Identifier): boolean | undefined {
		return Array.isArray(id) ? id[2] : undefined;
	},

	/**
	 * Convert the identifier to a **valid R** string representation,
	 * this will properly quote namespaces that contain `::` to avoid confusion.
	 * @example
	 * ```ts
	 * Identifier.toString('a') // 'a'
	 * Identifier.toString(['a', 'pkg']) // 'pkg::a'
	 * Identifier.toString(['a', 'pkg:::internal', true]) // '"pkg:::internal":::a'
	 * ```
	 */
	toString(this: void, id: Identifier): string {
		if(Array.isArray(id)) {
			if(id[1].includes('::')) {
				return `${JSON.stringify(id[1])}${id[2] ? ':::' : '::'}${id[0]}`;
			}
			return `${id[1]}${id[2] ? ':::' : '::'}${id[0]}`;
		} else {
			if(id.includes('::')) {
				return JSON.stringify(id);
			}
			return id;
		}
	},
	/**
	 * Check if two identifiers match.
	 * This differs from eq!
	 * If the first identifier is not namespaced, it will match any namespace!
	 * If we search for S3 methods (s3=true), the target may have an additional suffix after a dot.
	 * If the first identifier is internal, it will match any target (internal or not).
	 */
	matches(this: void, id: Identifier, target: Identifier, s3: boolean = false): boolean {
		const idName = Identifier.getName(id);
		const targetName = Identifier.getName(target);
		if(idName !== targetName) {
			return s3 ? targetName.startsWith(idName + '.') : false;
		}
		const idNs = Identifier.getNamespace(id);
		if(idNs === undefined) {
			return true;
		}
		const targetNs = Identifier.getNamespace(target);
		if(idNs !== targetNs) {
			return false;
		}
		const idInternal = Identifier.accessesInternal(id);
		if(idInternal === true) {
			return true;
		}
		const targetInternal = Identifier.accessesInternal(target);
		return idInternal === targetInternal;
	},
	/** Special identifier for the `...` argument */
	dotdotdot(this: void): BrandedIdentifier {
		return '...' as BrandedIdentifier;
	},
	/**
	 * Check if the identifier is the special `...` argument / or one of its accesses like `..1`, `..2`, etc.
	 * This always returns false for namespaced identifiers.
	 */
	isDotDotDotAccess(this: void, id: Identifier): boolean {
		return !Array.isArray(id) && (dotDotDotAccess.test(id) || id === '...');
	},
	/**
	 * Functor over the name of the identifier
	 */
	mapName(this: void, id: Identifier, fn: (name: BrandedIdentifier) => BrandedIdentifier): Identifier {
		if(Array.isArray(id)) {
			return [fn(id[0]), id[1], id[2]];
		} else {
			return fn(id);
		}
	},
	/**
	 * Functor over the namespace of the identifier
	 */
	mapNamespace(this: void, id: Identifier, fn: (ns: BrandedNamespace) => BrandedNamespace): Identifier {
		if(Array.isArray(id)) {
			return [id[0], fn(id[1]), id[2]];
		} else {
			return id;
		}
	},
	/**
	 * Convert the identifier to its array representation
	 */
	toArray(this: void, id: Identifier): [BrandedIdentifier, BrandedNamespace | undefined, boolean | undefined] {
		if(Array.isArray(id)) {
			return [id[0], id[1], id[2]];
		} else {
			return [id, undefined, undefined];
		}
	}
} as const;

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
	BuiltInFunction = 128,
	/** Prefix to identify S3 methods, use this, to for example dispatch a call to `f` which will then link to `f.*` */
	S3MethodPrefix = 256,
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
export type InGraphReferenceType = Exclude<ReferenceType, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction>;

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
	readonly nodeId: NodeId
	/** Name the reference is identified by (e.g., the name of the variable), undefined if the reference is "artificial" (e.g., anonymous) */
	readonly name:   Identifier | undefined
	/** Type of the reference to be resolved */
	readonly type:   ReferenceType;
	/**
	 * If the reference is only effective, if, for example, an if-then-else condition is true, this references the root of the `if`.
	 * As a hacky intermediate solution (until we have pointer-analysis), an empty array may indicate a `maybe` which is due to pointer access (e.g., in `a[x] <- 3`).
	 */
	cds?:            ControlDependency[] | undefined
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
}

/**
 * Stores the definition of an identifier within an {@link IEnvironment}.
 *
 * {@link BuiltInIdentifierDefinition} and {@link BuiltInIdentifierConstant} are used for built-in functions and constants only,
 * so the most important one for your day-to-day R script is the {@link InGraphIdentifierDefinition}.
 */
export type IdentifierDefinition = InGraphIdentifierDefinition | BuiltInIdentifierDefinition | BuiltInIdentifierConstant;
