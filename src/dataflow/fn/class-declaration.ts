/**
 * What a class *declaration* states, across R's object systems, and how the declarations of one analysis relate.
 *
 * The systems say the same handful of things in different words, so one model carries them all: a name, the
 * classes it {@link ClassDeclaration.contains|contains}, the {@link ClassMember|members} it declares, and
 * whether it can be instantiated. What differs is which argument says what, and that is stated per built-in in
 * a {@link ClassDeclarationConfig} rather than guessed from the call.
 */

import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RFunctionCall, type PotentiallyEmptyRArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { DataflowGraph } from '../graph/graph';
import { NoEdges } from '../graph/graph';
import { DfEdge, EdgeType } from '../graph/edge';
import { isNotUndefined } from '../../util/assert';
import type { SigClassInfo } from '../../project/sigdb/schema';
import { FunctionCallVertex, VertexType  } from '../graph/vertex';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexInfo } from '../graph/vertex';

/** The object system a declaration belongs to. */
export const enum ClassSystem {
	/** `setClass`, `setClassUnion`, `setIs`, `setValidity` */
	S4 = 's4',
	/** Reference Classes, `setRefClass` */
	RefClass = 'rc',
	/** `S7::new_class` */
	S7 = 's7',
	/** `R6::R6Class` */
	R6 = 'r6'
}

/** Where a member of an R6/Reference class lives; R6 also has active bindings, which read like fields. */
export const enum MemberVisibility {
	Public  = 'public',
	Private = 'private',
	/** an R6 active binding: a function that is read and written like a field */
	Active  = 'active'
}

/** One declared member of a class: an S4 slot, an S7 property, an RC field, or an R6 public/private entry. */
export interface ClassMember {
	readonly name:        string;
	/**
	 * The type the declaration states for the member, when it states one: an S4 slot's class
	 * (`slots = c(x = "numeric")`), an RC field's, or the S7 property class as written. R6 declares no types.
	 */
	readonly type?:       string;
	/** whether the member is a function, i.e. a method rather than a field (R6/RC, where both share one list) */
	readonly method?:     boolean;
	readonly visibility?: MemberVisibility;
}

/** What one class-declaring call states. Everything but {@link system} is best-effort: an argument that does not resolve statically is left out rather than guessed. */
export interface ClassDeclaration {
	readonly system:     ClassSystem;
	/** the declared class name, absent when the naming argument does not resolve to a literal */
	readonly name?:      string;
	/** the direct superclasses, in the order the declaration lists them (S7/R6 have at most one) */
	readonly contains:   readonly string[];
	/** the slots/properties/fields the declaration states, in order */
	readonly members:    readonly ClassMember[];
	/** the class cannot be instantiated: `representation("VIRTUAL")`, `contains = "VIRTUAL"`, S7 `abstract = TRUE`, or a class union */
	readonly virtual?:   boolean;
	/** the members of a `setClassUnion`, which are subclasses of it rather than superclasses */
	readonly union?:     readonly string[];
	/** the members the `prototype` gives a default for; the defaults themselves are values, which no declaration model carries */
	readonly prototype?: readonly string[];
	/** the declaration only *relates* two existing classes (`setIs`) or attaches a validator (`setValidity`), it declares no class of its own */
	readonly relation?:  'is' | 'validity';
	/** names the declaration references rather than states as literals, e.g. an R6 `inherit = Generator` */
	readonly byVariable: readonly string[];
}

/** Which argument of a class-declaring built-in says what; `idx` is the position when the call names no argument. */
export interface ClassArgRef {
	readonly idx?:  number;
	readonly name?: string;
}

/** A member-carrying argument, plus how its entries are to be read. */
export interface ClassMemberArgRef extends ClassArgRef {
	/** the visibility every entry of this argument has (R6's `public`/`private`/`active`) */
	readonly visibility?: MemberVisibility;
	/** the entries state a type (S4 `slots`, RC `fields`), rather than a value or a function (R6, RC `methods`) */
	readonly typed?:      boolean;
	/** every entry of this argument is a method, whatever it looks like (RC's `methods`) */
	readonly methods?:    boolean;
}

/**
 * How one built-in declares a class, stated alongside the built-in the way `setMethod`'s `target`/`definition`
 * arguments already are, so no processor has to guess an argument's meaning from its position.
 */
export interface ClassDeclarationConfig {
	readonly system:        ClassSystem;
	/** the argument naming the class */
	readonly nameArg?:      ClassArgRef;
	/** the argument carrying the direct superclass(es): S4 `contains`, S7 `parent`, R6 `inherit`, RC `contains` */
	readonly containsArg?:  ClassArgRef;
	/** the arguments carrying members, in the order they are to be read */
	readonly memberArgs?:   readonly ClassMemberArgRef[];
	/** the argument saying the class cannot be instantiated (S7 `abstract`) */
	readonly virtualArg?:   ClassArgRef;
	/** the argument listing the members of a class union (`setClassUnion`) */
	readonly unionArg?:     ClassArgRef;
	/** the argument carrying the member defaults (S4 `prototype`) */
	readonly prototypeArg?: ClassArgRef;
	/** the declaration relates existing classes rather than declaring one */
	readonly relation?:     'is' | 'validity';
}

/** the class name R uses to mark a class as non-instantiable */
const VirtualClass = 'VIRTUAL';

/** The argument `ref` names, by name when the call gives one and by position among the unnamed ones otherwise. */
function argFor<Info>(
	args: readonly PotentiallyEmptyRArgument<Info & ParentInformation>[],
	ref:  ClassArgRef | undefined
): RNode<Info & ParentInformation> | undefined {
	if(ref === undefined) {
		return undefined;
	}
	if(ref.name !== undefined) {
		const named = args.find(a => !RArgument.isEmpty(a) && a.name?.content === ref.name);
		if(named !== undefined && !RArgument.isEmpty(named)) {
			return named.value;
		}
	}
	if(ref.idx === undefined) {
		return undefined;
	}
	let pos = 0;
	for(const a of args) {
		if(RArgument.isEmpty(a) || a.name !== undefined) {
			continue;
		}
		if(pos++ === ref.idx) {
			return a.value;
		}
	}
	return undefined;
}

/** The string a node states literally, `undefined` for anything that is not a literal (a variable, a call, ...). */
function literal<Info>(node: RNode<Info & ParentInformation> | undefined): string | undefined {
	return node !== undefined && RString.is(node) ? node.content.str : undefined;
}

/** The character vector a node states: a literal, or the literals of a `c(...)`/`list(...)` around them. */
function literalVector<Info>(node: RNode<Info & ParentInformation> | undefined): { values: string[], byVariable: string[] } {
	const values: string[] = [];
	const byVariable: string[] = [];
	if(node === undefined) {
		return { values, byVariable };
	}
	const collect = (n: RNode<Info & ParentInformation>): void => {
		const str = literal(n);
		if(str !== undefined) {
			values.push(str);
		} else if(RSymbol.is(n)) {
			/* `inherit = Generator` / `parent = Cls`: the name is there, it is just not a string */
			byVariable.push(n.lexeme);
		} else if(RFunctionCall.isNamed(n)) {
			for(const arg of n.arguments) {
				if(!RArgument.isEmpty(arg) && arg.value !== undefined) {
					collect(arg.value);
				}
			}
		}
	};
	collect(node);
	return { values, byVariable };
}

/**
 * The members a `c(x = "numeric")` / `list(x = ...)` / `representation(...)` argument states: one entry per
 * named element, plus the bare strings such a call may carry (an RC `fields = c("x", "y")` names untyped
 * fields, and a bare `"VIRTUAL"` marks the class virtual instead).
 */
function membersOf<Info>(node: RNode<Info & ParentInformation> | undefined, ref: ClassMemberArgRef): { members: ClassMember[], virtual: boolean } {
	const members: ClassMember[] = [];
	let virtual = false;
	if(node === undefined) {
		return { members, virtual };
	}
	const shared = { ...(ref.visibility !== undefined ? { visibility: ref.visibility } : {}) };
	if(!RFunctionCall.isNamed(node)) {
		const single = literal(node);
		if(single === VirtualClass) {
			return { members, virtual: true };
		}
		return { members, virtual };
	}
	for(const arg of node.arguments) {
		if(RArgument.isEmpty(arg) || arg.value === undefined) {
			continue;
		}
		const name = arg.name?.content;
		if(name === undefined) {
			/* an unnamed entry names a member itself (`fields = c("x")`), unless it is the VIRTUAL marker */
			const bare = literal(arg.value);
			if(bare === VirtualClass) {
				virtual = true;
			} else if(bare !== undefined) {
				members.push({ name: bare, ...shared, ...(ref.methods ? { method: true } : {}) });
			}
			continue;
		}
		/* S7 states a property's class as the `class_numeric` object, S4 as the `"numeric"` string; both name it */
		const type = ref.typed ? literal(arg.value) ?? (RSymbol.is(arg.value) ? arg.value.lexeme : undefined) : undefined;
		const isMethod = ref.methods === true || RFunctionDefinition.is(arg.value);
		members.push({
			name,
			...(type !== undefined ? { type } : {}),
			...(isMethod ? { method: true } : {}),
			...shared
		});
	}
	return { members, virtual };
}

/** Whether an argument states a literal `TRUE`. */
function isTrue<Info>(node: RNode<Info & ParentInformation> | undefined): boolean {
	return node?.lexeme === 'TRUE' || node?.lexeme === 'T';
}

/**
 * Reads the {@link ClassDeclaration} a call states, following the argument mapping its built-in declares.
 * Nothing is guessed: an argument that resolves to no literal contributes a
 * {@link ClassDeclaration.byVariable|by-variable} name or nothing at all.
 * @param config - what the built-in says about its own arguments
 * @param args   - the arguments of the call, in source order
 */
export function classDeclarationOf<Info>(
	config: ClassDeclarationConfig,
	args:   readonly PotentiallyEmptyRArgument<Info & ParentInformation>[]
): ClassDeclaration {
	const byVariable: string[] = [];
	const nameNode = argFor(args, config.nameArg);
	const name = literal(nameNode);
	if(name === undefined && nameNode !== undefined && RSymbol.is(nameNode)) {
		byVariable.push(nameNode.lexeme);
	}

	const parents = literalVector(argFor(args, config.containsArg));
	byVariable.push(...parents.byVariable);
	const contains = parents.values.filter(c => c !== VirtualClass);
	let virtual = parents.values.includes(VirtualClass) || isTrue(argFor(args, config.virtualArg));

	const members: ClassMember[] = [];
	for(const ref of config.memberArgs ?? []) {
		const found = membersOf(argFor(args, ref), ref);
		members.push(...found.members);
		virtual ||= found.virtual;
	}

	const union = config.unionArg === undefined ? undefined : literalVector(argFor(args, config.unionArg)).values;
	const prototype = config.prototypeArg === undefined ? []
		: membersOf(argFor(args, config.prototypeArg), config.prototypeArg).members.map(m => m.name);

	return {
		system: config.system,
		...(name !== undefined ? { name } : {}),
		contains,
		members,
		/* a class union is virtual by construction: it exists to be extended, never to be instantiated */
		...(virtual || (union !== undefined && union.length > 0) ? { virtual: true } : {}),
		...(union !== undefined && union.length > 0 ? { union } : {}),
		...(prototype.length > 0 ? { prototype } : {}),
		...(config.relation !== undefined ? { relation: config.relation } : {}),
		byVariable
	};
}

/** One class the analysis saw declared, with the call that declared it. */
export interface DeclaredClass extends ClassDeclaration {
	/** the id of the declaring call */
	readonly id:   NodeId;
	/** the class name, which a {@link DeclaredClass} always has (an unnamed declaration is not one) */
	readonly name: string;
}

/**
 * Every class the graph declares, keyed by name. A later declaration of the same name wins, as it would in R.
 * @param graph - the dataflow graph to read
 */
export function declaredClasses(graph: DataflowGraph): Map<string, DeclaredClass> {
	const classes = new Map<string, DeclaredClass>();
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const decl = (vertex as DataflowGraphVertexFunctionCall).classDecl;
		if(decl?.name === undefined || decl.relation !== undefined) {
			continue;
		}
		classes.set(decl.name, { ...decl, id, name: decl.name });
	}
	/* R6 and S7 name their parent by the generator *variable*, so `Employee <- R6Class(inherit = Person)`
	   only says "Person"; the assignment that bound the generator says which class that is */
	const byGenerator = generatorVariables(graph, classes);
	for(const [name, declared] of classes) {
		const resolved = declared.byVariable.map(v => byGenerator.get(v)).filter(isNotUndefined)
			.filter(c => c !== name && !declared.contains.includes(c));
		if(resolved.length > 0) {
			classes.set(name, { ...declared, contains: [...declared.contains, ...resolved] });
		}
	}
	/* a `setClassUnion` states its members as subclasses, which is the same fact written the other way round */
	for(const [, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const decl = (vertex as DataflowGraphVertexFunctionCall).classDecl;
		if(decl?.name === undefined) {
			continue;
		}
		for(const member of decl.union ?? []) {
			const existing = classes.get(member);
			if(existing !== undefined && !existing.contains.includes(decl.name)) {
				classes.set(member, { ...existing, contains: [...existing.contains, decl.name] });
			}
		}
		/* `setIs(class1, class2)` states the same is-a relation `contains` does */
		if(decl.relation === 'is') {
			const [sub, sup] = [decl.name, decl.contains[0]];
			const existing = classes.get(sub);
			if(existing !== undefined && sup !== undefined && !existing.contains.includes(sup)) {
				classes.set(sub, { ...existing, contains: [...existing.contains, sup] });
			}
		}
	}
	return classes;
}

/** Variable name to the class its generator declares, for the `Cls <- R6Class(...)`/`Cls <- new_class(...)` bindings. */
function generatorVariables(graph: DataflowGraph, classes: ReadonlyMap<string, DeclaredClass>): Map<string, string> {
	const byName = new Map<NodeId, string>();
	for(const declared of classes.values()) {
		byName.set(declared.id, declared.name);
	}
	const generators = new Map<string, string>();
	for(const [id] of graph.verticesOfType(VertexType.VariableDefinition)) {
		const lexeme = graph.idMap?.get(id)?.lexeme;
		if(lexeme === undefined) {
			continue;
		}
		for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
			const cls = byName.get(target);
			if(cls !== undefined && DfEdge.includesType(edge, EdgeType.DefinedBy)) {
				generators.set(lexeme, cls);
			}
		}
	}
	return generators;
}

/**
 * The transitive superclasses of `name` among `classes`, nearest first and each named once. A class the
 * analysis never saw declared ends the chain, so what another package contributes is simply not in the answer.
 * @param name    - the class to start from
 * @param classes - what {@link declaredClasses} found
 */
export function superClassesOf(name: string, classes: ReadonlyMap<string, ClassDeclaration>): string[] {
	const chain: string[] = [];
	const seen = new Set<string>([name]);
	const queue = [...(classes.get(name)?.contains ?? [])];
	while(queue.length > 0) {
		const next = queue.shift() as string;
		if(seen.has(next)) {
			continue;
		}
		seen.add(next);
		chain.push(next);
		queue.push(...(classes.get(next)?.contains ?? []));
	}
	return chain;
}

/** Utilities for the class declarations of an analysis. */
export const ClassDeclarations = {
	name:     'ClassDeclarations',
	/** @see {@link classDeclarationOf} */
	of:       classDeclarationOf,
	/** @see {@link declaredClasses} */
	declared: declaredClasses,
	/** @see {@link superClassesOf} */
	superOf:  superClassesOf,
	/** Whether the vertex is a call that declares a class; its {@link DataflowGraphVertexFunctionCall.classDecl} is then set. */
	isDeclaring(this: void, vertex: DataflowGraphVertexInfo | undefined): boolean {
		return FunctionCallVertex.is(vertex) && vertex.classDecl !== undefined;
	}
} as const;

/**
 * The {@link SigClassInfo} records the signature database stores for the classes an analysis found, so what
 * flowR reads off `setClass`/`R6Class`/`new_class` and what a bundle carries are the same facts.
 *
 * A class the analysis declared is the package's own, so it carries no `package`. For anything it only
 * references* -- a superclass declared elsewhere -- `ownerOf` decides which package defines it; a referenced
 * class it answers for becomes a `foreign` record, and one it cannot place is left out rather than invented.
 * @param classes - what {@link declaredClasses} found
 * @param ownerOf - the package defining a class the analysis did not declare, e.g. `src.classOwner`
 */
export function toSigClasses(classes: ReadonlyMap<string, DeclaredClass>, ownerOf?: (name: string) => string | undefined): SigClassInfo[] {
	const records: SigClassInfo[] = [];
	for(const declared of classes.values()) {
		records.push({
			name:   declared.name,
			system: declared.system,
			supers: declared.union ?? declared.contains,
			slots:  declared.members.filter(m => !m.method)
				.map(m => ({ name: m.name, ...(m.type !== undefined ? { type: m.type } : {}) })),
			...(declared.virtual ? { virtual: true } : {}),
			...(declared.union !== undefined ? { union: true } : {})
		});
	}
	if(ownerOf === undefined) {
		return records;
	}
	/* a superclass the analysis never declared belongs to whoever does define it, which is what makes an
	   inherited class distinguishable from one the package owns */
	for(const referenced of new Set(records.flatMap(r => r.supers))) {
		if(classes.has(referenced)) {
			continue;
		}
		const owner = ownerOf(referenced);
		if(owner !== undefined) {
			records.push({ name: referenced, system: 's4', supers: [], slots: [], package: owner });
		}
	}
	return records;
}
