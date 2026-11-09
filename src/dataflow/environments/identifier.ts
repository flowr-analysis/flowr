import type { AmbientStateName } from './ambient-state-name';
import type { AttachedBuiltIn, BuiltInIdentifierConstant, BuiltInIdentifierDefinition } from './built-in';
import type { Accessor } from '../../util/accessor';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../info';
import { escapeRegex, splitRQuotes } from '../../util/text/strings';
import { baseRExportOwner } from '../../util/r-base-packages';
import type { REnvironmentInformation } from './environment';
import type { Origin } from '../origin/dfg-get-origin';
/* type-only, as the value import would cycle back through the graph helpers */

export { PkgName } from './pkg-name';

/** this is just a safe-guard type to prevent mixing up branded identifiers with normal strings */
export type BrandedIdentifier = string & { __brand?: 'identifier' };
/** this is just a safe-guard type to prevent mixing up branded namespaces with normal strings */
export type BrandedNamespace = string & { __brand?: 'namespace' };

/** Refers to an identifier by its name. */
export type Identifier = BrandedIdentifier | [id: BrandedIdentifier, namespace: BrandedNamespace, internal?: boolean];

/** A string type representing a namespaced identifier in the format `pkg::name`. */
export type IdentifierString = `${string}::${string}`;

const dotDotDotAccess = /^\.\.\d+$/;

/**
 * Helper functions to work with {@link Identifier|identifiers}. Use {@link Identifier.matches} to check if two identifiers match according to R's scoping rules!
 * @helper values
 */
export const Identifier = {
	name: 'Identifier',
	/** Creates an identifier. */
	make(this: void, name: BrandedIdentifier, namespace?: BrandedNamespace, internal: boolean = false): Identifier {
		const split = splitRQuotes(name);
		if(split.quote === '`') {
			name = split.content;
		}
		return namespace ? [name, namespace, internal] : name;
	},
	/** Fast-path factory: returns the tuple as-is with no allocation or runtime checks. */
	from(this: void, arr: [BrandedIdentifier, BrandedNamespace] | [BrandedIdentifier, BrandedNamespace, boolean]): Identifier {
		return arr;
	},
	/** The same fast path for many names of one package: the given array of names is cast in place, so the literal you pass is the only array involved. */
	fromAll(this: void, namespace: BrandedNamespace, names: BrandedIdentifier[]): Identifier[] {
		const ids = names as unknown as Identifier[];
		for(let i = 0; i < names.length; i++) {
			ids[i] = [names[i], namespace];
		}
		return ids;
	},
	/** The names as every one of the given packages exports them, for a function one package owns and others re-export unchanged (`dplyr::%>%` is `magrittr::%>%`). */
	fromAllIn(this: void, namespaces: readonly BrandedNamespace[], names: readonly BrandedIdentifier[]): Identifier[] {
		return namespaces.flatMap(namespace => names.map((name): Identifier => [name, namespace]));
	},
	/** Verify whether an unknown element has a valid identifier shape! */
	is(this: void, id: unknown): id is Identifier {
		if(typeof id === 'string') {
			return true;
		}
		if(!Array.isArray(id) || typeof id[0] !== 'string' || typeof id[1] !== 'string') {
			return false;
		}
		return id.length === 2 || (id.length === 3 && typeof id[2] === 'boolean');
	},
	/** Parse an identifier from its string representation, Please note, that in R if one writes `"pkg::a"` this refers to a symbol named `pkg::a` and NOT to the namespaced identifier `a` in package `pkg`. */
	parse(this: void, str: BrandedIdentifier): Identifier {
		const at = namespaceSeparatorAt(str);
		if(at < 0) {
			return str;
		}
		const internal = str[at + 2] === ':';
		return [str.slice(at + (internal ? 3 : 2)), str.slice(0, at), internal] as Identifier;
	},
	/** Get the name part of the identifier, `undefined` if there is no identifier. */
	getName: ((id?: Identifier) => Array.isArray(id) ? id[0] : id) as Accessor<Identifier, BrandedIdentifier>,
	/** Get the namespace part of the identifier, `undefined` if there is none (or no identifier). */
	getNamespace(this: void, id: Identifier | undefined): BrandedNamespace | undefined {
		return Array.isArray(id) ? id[1] : undefined;
	},
	/** Check if the identifier accesses internal objects (`:::`), `undefined` if it says nothing about it. */
	accessesInternal(this: void, id: Identifier | undefined): boolean | undefined {
		return Array.isArray(id) ? id[2] : undefined;
	},

	/** Convert the identifier to a **valid R** string representation, this will properly quote namespaces that contain `::` to avoid confusion. */
	toString: ((id?: Identifier) => {
		if(id === undefined) {
			return undefined;
		} else if(Array.isArray(id)) {
			return `${id[1].includes('::') ? JSON.stringify(id[1]) : id[1]}${id[2] ? ':::' : '::'}${id[0]}`;
		}
		return id.includes('::') ? JSON.stringify(id) : id;
	}) as Accessor<Identifier, string>,
	/** Check if two identifiers match. */
	matches(this: void, id: Identifier, target: Identifier, s3: boolean = false): boolean {
		const idName = Identifier.getName(id);
		const targetName = Identifier.getName(target);
		if(idName !== targetName) {
			return s3 && targetName.startsWith(idName + '.');
		}
		const idNs = Identifier.getNamespace(id);
		if(idNs === undefined) {
			return true;
		}
		if(idNs !== Identifier.getNamespace(target)) {
			return false;
		}
		if(Identifier.accessesInternal(id) === true) {
			return true;
		}
		/* an omitted flag is the same as an explicit `false`, `pkg::fn` written either way is one identifier */
		return Identifier.accessesInternal(target) !== true;
	},
	/** Helper to create a regular expression that matches against an array of {@link Identifier} values. */
	regex(this: void, ...identifiers: readonly Identifier[]): RegExp {
		// if the passed identifier is not namespaced, we match against *any* namespace. if it is namespaced, we match against the correct namespace or no namespace
		return new RegExp(`^(${identifiers.map(i => {
			const namespace = Identifier.getNamespace(i);
			return `(${namespace === undefined ? '.+' : escapeRegex(namespace)}:::?)?${escapeRegex(Identifier.getName(i))}`;
		}).join('|')})$`);
	},
	/** Special identifier for the `...` argument */
	dotdotdot(this: void): BrandedIdentifier {
		return '...';
	},
	/** The name `id` is bound as, `...` for its accesses like `..1` */
	boundAs<I extends Identifier | undefined>(this: void, id: I): I | BrandedIdentifier {
		return id !== undefined && Identifier.isDotDotDotAccess(id) ? Identifier.dotdotdot() : id;
	},
	/** Check if the identifier is the special `...` argument / or one of its accesses like `..1`, `..2`, etc. This always returns false for namespaced identifiers. */
	isDotDotDotAccess(this: void, id: Identifier): boolean {
		return !Array.isArray(id) && (dotDotDotAccess.test(id) || id === '...');
	},
	/** Functor over the name of the identifier */
	mapName(this: void, id: Identifier, fn: (name: BrandedIdentifier) => BrandedIdentifier): Identifier {
		return Array.isArray(id) ? [fn(id[0]), id[1], id[2]] : fn(id);
	},
	/** Functor over the namespace of the identifier */
	mapNamespace(this: void, id: Identifier, fn: (ns: BrandedNamespace) => BrandedNamespace): Identifier {
		return Array.isArray(id) ? [id[0], fn(id[1]), id[2]] : id;
	},
	/** Convert the identifier to its array representation */
	toArray(this: void, id: Identifier): [BrandedIdentifier, BrandedNamespace | undefined, boolean | undefined] {
		return Array.isArray(id) ? [id[0], id[1], id[2]] : [id, undefined, undefined];
	},
	/** The package-qualified identifier of a call, resolved in order of decreasing certainty: 1. */
	toQualified(this: void, origins: readonly Origin[] | undefined, name?: Identifier, qualifyBaseR = true): Identifier | undefined {
		let sawUserDefinition = false;
		for(const origin of origins ?? []) {
			if('proc' in origin) {
				const pkgFn = NodeId.toPkgFn(origin.proc);
				if(pkgFn) {
					return Identifier.make(pkgFn[1], pkgFn[0]);
				} else if(Identifier.getNamespace(origin.fn.name) !== undefined) {
					return origin.fn.name;
				}
			} else if(!NodeId.isBuiltIn(origin.id)) {
				/* a read that lands on a built-in (e.g. the constant `pi`) is no user definition and must not block step 3 */
				sawUserDefinition = true;
			}
		}
		if(name === undefined || Identifier.getNamespace(name) !== undefined) {
			return name;
		}
		if(!qualifyBaseR || sawUserDefinition) {
			return undefined;
		}
		const bare = Identifier.getName(name);
		const owner = baseRExportOwner(bare);
		return owner === undefined ? undefined : Identifier.make(bare, owner);
	},
	/** Wraps the identifier in an {@link IdentifierView|view} offering property access (`id.name`, `id.namespace`) and methods. */
	view: ((id?: Identifier) => id === undefined ? undefined : new IdentifierView(id)) as Accessor<Identifier, IdentifierView>
} as const;

/** An object-oriented read-only view on an {@link Identifier}. */
export class IdentifierView {
	/** @param raw - the underlying identifier; use it whenever you need the plain representation back */
	constructor(readonly raw: Identifier) {}

	/** the name part, so the `fn` of a `pkg::fn` */
	get name(): BrandedIdentifier {
		return Identifier.getName(this.raw);
	}

	/** the namespace part, `undefined` for a name written without one */
	get namespace(): BrandedNamespace | undefined {
		return Identifier.getNamespace(this.raw);
	}

	/** whether the identifier reaches for an internal object (`:::`), `undefined` if it says nothing about it */
	get isInternal(): boolean | undefined {
		return Identifier.accessesInternal(this.raw);
	}

	/** whether the identifier names its package, i.e. whether it carries a namespace */
	get isQualified(): boolean {
		return Array.isArray(this.raw);
	}

	/** whether this is the `...` argument or one of its accesses (`..1`, `..2`, ...) */
	get isDotDotDot(): boolean {
		return Identifier.isDotDotDotAccess(this.raw);
	}

	/** @see {@link Identifier.matches} */
	matches(target: IdentifierLike, s3 = false): boolean {
		return Identifier.matches(this.raw, rawIdentifier(target), s3);
	}

	/** Whether both name the very same thing, namespace and `:::` flag included. */
	equals(other: IdentifierLike): boolean {
		const target = rawIdentifier(other);
		return this.name === Identifier.getName(target)
			&& this.namespace === Identifier.getNamespace(target)
			&& (this.isInternal ?? false) === (Identifier.accessesInternal(target) ?? false);
	}

	/** @see {@link Identifier.mapName} */
	mapName(fn: (name: BrandedIdentifier) => BrandedIdentifier): IdentifierView {
		return new IdentifierView(Identifier.mapName(this.raw, fn));
	}

	/** @see {@link Identifier.mapNamespace} */
	mapNamespace(fn: (ns: BrandedNamespace) => BrandedNamespace): IdentifierView {
		return new IdentifierView(Identifier.mapNamespace(this.raw, fn));
	}

	/** @see {@link Identifier.toString} - the **valid R** spelling, so `pkg::fn` for a qualified name */
	toString(): string {
		return Identifier.toString(this.raw);
	}

	/** Serializes to the underlying identifier, so a view is interchangeable with one in JSON output. */
	toJSON(): Identifier {
		return this.raw;
	}
}

/** An {@link Identifier} or a {@link IdentifierView} of one. Accepted wherever an identifier is only read. */
export type IdentifierLike = Identifier | IdentifierView;

/** Unwraps an {@link IdentifierView} to its identifier, passing bare identifiers through unchanged. */
function rawIdentifier(of: IdentifierLike): Identifier {
	return of instanceof IdentifierView ? of.raw : of;
}

/** The index of the `::` separating namespace from name, skipping backtick-quoted spans; `-1` if there is none. */
function namespaceSeparatorAt(str: BrandedIdentifier): number {
	let quoted = false;
	for(let i = 0; i < str.length; i++) {
		if(str[i] === '`') {
			quoted = !quoted;
		} else if(!quoted && str[i] === ':' && str[i + 1] === ':') {
			return i;
		}
	}
	return -1;
}

/** Each reference has exactly one reference type, stored as the respective number. */
export enum ReferenceType {
	/** The identifier type is unknown */
	Unknown = 1 << 0,
	/** The identifier is defined by a function (includes built-in function) */
	Function = 1 << 1,
	/** The identifier is defined by a variable (includes parameter and argument) */
	Variable = 1 << 2,
	/** The identifier is defined by a constant (includes built-in constant) */
	Constant = 1 << 3,
	/** The identifier is defined by a parameter (which we know nothing about at the moment) */
	Parameter = 1 << 4,
	/** The identifier is defined by an argument (which we know nothing about at the moment) */
	Argument = 1 << 5,
	/** The identifier is defined by a built-in value/constant */
	BuiltInConstant = 1 << 6,
	/** The identifier is defined by a built-in function */
	BuiltInFunction = 1 << 7,
	/** Prefix to identify S3 methods, use this, to for example dispatch a call to `f` which will then link to `f.*` */
	S3MethodPrefix = 1 << 8,
	/** Prefix to identify S7 methods, use this, to for example dispatch a call to `f` which will then link to `f<7>*` */
	S7MethodPrefix = 1 << 9,
	/** Only ever a lookup target, never the type of a definition: everything a value position may see. */
	NonFunction = 1 << 10
}

/** Reverse mapping of the reference types so you can get the name from the bitmask (useful for debugging) */
export const ReferenceTypeReverseMapping = new Map<ReferenceType, string>(Object.entries(ReferenceType).filter(([name]) => Number.isNaN(Number(name))).map(([name, value]) => [value as ReferenceType, name]));

/** Check if the reference types have an overlapping type! */
export function isReferenceType(t: ReferenceType, target: ReferenceType): boolean {
	return (t & target) !== 0;
}

/** Describes all types of reference (definitions) that can appear within a graph (i.e., that are not built-in like the default definition for the assignment operator `<-`). */
export type InGraphReferenceType = Exclude<ReferenceType, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction | ReferenceType.NonFunction>;

/** An identifier reference points to a variable like `a` in `b <- a`. */
export interface IdentifierReference {
	/** The id of the node which represents the reference in the {@link NormalizedAst|normalized AST} and the {@link DataflowGraph|dataflow graph}. */
	readonly nodeId:  NodeId
	/** Name the reference is identified by (e.g., the name of the variable), undefined if the reference is "artificial" (e.g., anonymous) */
	readonly name:    Identifier | undefined
	/** Type of the reference to be resolved */
	readonly type:    ReferenceType;
	/** If the reference is only effective, if, for example, an if-then-else condition is true, this references the root of the `if`. */
	cds?:             readonly ControlDependency[] | undefined
	/** Whether the read is evaluated in the global environment (`source()` within a function), so no frame below it can bind it */
	readonly global?: boolean
}

/** The name of an S4, S7, reference, or R6 class. */
export type ClassName = string & { __brand?: 'class' };


/** The definition of an {@link Identifier|identifier} within the {@link DataflowGraph|graph}. */
export interface InGraphIdentifierDefinition extends IdentifierReference {
	readonly type:             InGraphReferenceType
	/** The assignment node which ultimately defined this identifier (the arrow operator for e.g. `x <- 3`, or `assign` call in `assign("x", 3)`) */
	readonly definedAt:        NodeId
	/** For value tracking, this contains all nodeIds of constant values that may be made available to this identifier For example, in `x <- 3; y <- x`, the definition of `y` will have the value `3` in its value set */
	readonly value?:           NodeId[]
	/** If this variable holds an R environment (created by `new.env()` etc.), this tracks the current known state of that environment. */
	readonly envState?:        REnvironmentInformation
	/** Names the environment object {@link envState} tracks, so that every variable aliasing it sees the same writes. */
	readonly envId?:           NodeId
	/** Whether {@link envState} holds only the writes a function makes into the environment a free variable names: the environment itself is the one the name is bound to where the function is called, which adds these writes to it. */
	readonly envWrites?:       true
	/** Whether {@link envState} tracks the frame of the closure this variable holds (`environment(fn)`), rather than an environment it holds. */
	readonly closureFrame?:    true
	/** If this is a function that returns a tracked environment, stores the envState that the function returns (best-effort: only set when statically detectable). */
	readonly returnsEnvState?: REnvironmentInformation
	/** Whether {@link value} names the sequence this identifier iterates over rather than what it holds, as a `for` loop's variable does: it takes one element of that sequence at a time. */
	readonly iterated?:        boolean
	/** The ambient state reading this identifier may change, as forcing a promise (`delayedAssign`) whose code writes it does. */
	readonly forces?:          readonly AmbientStateName[]
	/** The ambient state forcing the promise this identifier binds reads, which it reads where it is forced. */
	readonly forcedReads?:     readonly AmbientStateName[]
	/** Whether the ambient state is only assumed written, by a body flowR cannot see. */
	readonly assumed?:         true
	/** For a registered finalizer, the variable holding the object it is registered for. */
	readonly holder?:          BrandedIdentifier
	/** For a registered finalizer, the ambient state running it writes. */
	readonly writes?:          readonly AmbientStateName[]
}

/** Whether a definition stems from the analyzed code rather than from a built-in. */
export function isInGraphDefinition(definition: IdentifierDefinition): definition is InGraphIdentifierDefinition {
	return !NodeId.isBuiltIn(definition.definedAt);
}

/** Whether a definition holds a tracked environment, i.e. carries an {@link InGraphIdentifierDefinition#envState}. */
export function hasEnvState(definition: IdentifierDefinition | undefined): definition is InGraphIdentifierDefinition & { envState: REnvironmentInformation } {
	return (definition as InGraphIdentifierDefinition | undefined)?.envState !== undefined;
}

/** A narrowed variant of {@link InGraphIdentifierDefinition} that is guaranteed to have a non-undefined `name`. */
export type NamedInGraphIdentifierDefinition<Name extends Identifier = Identifier> = InGraphIdentifierDefinition & { readonly name: Name };

/** A named definition known to hold a tracked environment, which every variable aliasing that environment shares. */
export type EnvHolderDefinition = NamedInGraphIdentifierDefinition & { readonly envState: REnvironmentInformation };

/** The nodes that bind or read each name. */
export type NodesByName = ReadonlyMap<BrandedIdentifier, readonly NodeId[]>;

/** Stores the definition of an identifier within an {@link IEnvironment}. */
export type IdentifierDefinition = InGraphIdentifierDefinition | (InGraphIdentifierDefinition & AttachedBuiltIn) | BuiltInIdentifierDefinition | BuiltInIdentifierConstant;
