/**
 * What a class declaration states across R's object systems (S4, RC, S7, R6) and how declarations relate;
 * which argument means what is configured per built-in in {@link ClassDeclarationConfig}, not guessed.
 */

import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RFunctionCall, type PotentiallyEmptyRArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { DataflowGraph } from '../graph/graph';
import { EdgeType } from '../graph/edge';
import { isNotUndefined } from '../../util/assert';
import { compactRecord } from '../../util/objects';
import type { SigClassInfo } from '../../project/sigdb/schema';
import { DfgVertex, VertexType } from '../graph/vertex';
import type { ResolveInfo } from '../eval/resolve/alias-tracking';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { NodeValue } from '../eval/resolve/node-value';
import { collectStrings } from '../eval/values/string/string-constants';
import { isValue } from '../eval/values/r-value';
import { edgeTargets, hasEdgeOfType } from './frame-reflection';

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
	/** the member's declared type, when one is stated (S4/RC/S7); R6 declares no types */
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

/** How one built-in declares a class, so no processor has to guess an argument's meaning from its position. */
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
export function argForImpl<Info>(args: readonly PotentiallyEmptyRArgument<Info & ParentInformation>[], ref: ClassArgRef | undefined): RNode<Info & ParentInformation> | undefined {
	if(ref === undefined) {
		return undefined;
	}
	const named = ref.name === undefined ? undefined : args.find(a => !RArgument.isEmpty(a) && a.name?.content === ref.name);
	if(named !== undefined) {
		return RArgument.valueOf(named);
	}
	if(ref.idx === undefined) {
		return undefined;
	}
	const unnamed = args.filter(a => !RArgument.isEmpty(a) && a.name === undefined);
	return RArgument.valueOf(unnamed[ref.idx]);
}

/** The string a node states literally, `undefined` for anything that is not a literal (a variable, a call, ...). */
function literal<Info>(node: RNode<Info & ParentInformation> | undefined): string | undefined {
	return RString.is(node) ? node.content.str : undefined;
}

/** The character vector a node states: a literal, or the literals of a `c(...)`/`list(...)` around them. */
function literalVector<Info>(node: RNode<Info & ParentInformation> | undefined): { values: string[], byVariable: string[] } {
	const values: string[] = [];
	const byVariable: string[] = [];
	const collect = (n: RNode<Info & ParentInformation> | undefined): void => {
		const str = literal(n);
		if(str !== undefined) {
			values.push(str);
		} else if(RSymbol.is(n)) {
			/* `inherit = Generator` / `parent = Cls`: the name is there, it is just not a string */
			byVariable.push(n.lexeme);
		} else if(RFunctionCall.isNamed(n)) {
			n.arguments.forEach(a => collect(RArgument.valueOf(a)));
		}
	};
	collect(node);
	return { values, byVariable };
}

/**
 * The members a `c(x = "numeric")` / `list(x = ...)` / `representation(...)` argument states, one per named
 * element, plus the bare strings such a call may carry (an RC `fields = c("x", "y")`, or a `"VIRTUAL"` marker).
 */
function membersOf<Info>(node: RNode<Info & ParentInformation> | undefined, ref: ClassMemberArgRef): { members: ClassMember[], virtual: boolean } {
	if(!RFunctionCall.isNamed(node)) {
		return { members: [], virtual: literal(node) === VirtualClass };
	}
	const members: ClassMember[] = [];
	let virtual = false;
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
				members.push(compactRecord({ name: bare, visibility: ref.visibility, method: ref.methods ? true : undefined }));
			}
			continue;
		}
		/* S7 states a property's class as the `class_numeric` object, S4 as the `"numeric"` string; both name it */
		const type = ref.typed ? literal(arg.value) ?? (RSymbol.is(arg.value) ? arg.value.lexeme : undefined) : undefined;
		const isMethod = ref.methods === true || RFunctionDefinition.is(arg.value);
		members.push(compactRecord({ name, type, method: isMethod ? true : undefined, visibility: ref.visibility }));
	}
	return { members, virtual };
}

/** Whether an argument states a literal `TRUE`. */
function isTrue<Info>(node: RNode<Info & ParentInformation> | undefined): boolean {
	return node?.lexeme === 'TRUE' || node?.lexeme === 'T';
}

/**
 * Reads the {@link ClassDeclaration} a call states, following the argument mapping its built-in declares.
 * An argument that resolves to no literal contributes a {@link ClassDeclaration.byVariable|by-variable} name, or nothing.
 */
export function classDeclarationOfImpl<Info>(config: ClassDeclarationConfig, args: readonly PotentiallyEmptyRArgument<Info & ParentInformation>[]): ClassDeclaration {
	const nameNode = argForImpl(args, config.nameArg);
	const name = literal(nameNode);
	const parents = literalVector(argForImpl(args, config.containsArg));
	const byVariable = name === undefined && RSymbol.is(nameNode) ? [nameNode.lexeme, ...parents.byVariable] : parents.byVariable;
	let virtual = parents.values.includes(VirtualClass) || isTrue(argForImpl(args, config.virtualArg));
	const members: ClassMember[] = [];
	for(const ref of config.memberArgs ?? []) {
		const found = membersOf(argForImpl(args, ref), ref);
		members.push(...found.members);
		virtual ||= found.virtual;
	}
	const union = literalVector(argForImpl(args, config.unionArg)).values;
	const prototype = membersOf(argForImpl(args, config.prototypeArg), config.prototypeArg ?? {}).members.map(m => m.name);
	/* a class union is virtual by construction: it exists to be extended, never to be instantiated */
	const isUnion = union.length > 0;
	return compactRecord({
		system:    config.system,
		name,
		contains:  parents.values.filter(c => c !== VirtualClass),
		members,
		virtual:   virtual || isUnion ? true : undefined,
		union:     isUnion ? union : undefined,
		prototype: prototype.length > 0 ? prototype : undefined,
		relation:  config.relation,
		byVariable
	});
}

/** One class the analysis saw declared, with the call that declared it. */
export interface DeclaredClass extends ClassDeclaration {
	/** the id of the declaring call */
	readonly id:   NodeId;
	/** the class name, which a {@link DeclaredClass} always has (an unnamed declaration is not one) */
	readonly name: string;
}

/** Every class the graph declares, keyed by name. A later declaration of the same name wins, as it would in R. */
export function declaredClassesImpl(graph: DataflowGraph): Map<string, DeclaredClass> {
	const classes = new Map<string, DeclaredClass>();
	for(const [id, { classDecl }] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(classDecl?.name !== undefined && classDecl.relation === undefined) {
			classes.set(classDecl.name, { ...classDecl, id, name: classDecl.name });
		}
	}
	const addSuper = (sub: string, sup: string | undefined) => {
		const existing = classes.get(sub);
		if(existing !== undefined && sup !== undefined && !existing.contains.includes(sup)) {
			classes.set(sub, { ...existing, contains: [...existing.contains, sup] });
		}
	};
	/* R6 and S7 name their parent by the generator *variable*, so `Employee <- R6Class(inherit = Person)`
	   only says "Person"; the assignment that bound the generator says which class that is */
	const byGenerator = generatorVariables(graph, classes);
	for(const [name, declared] of classes) {
		for(const sup of declared.byVariable.map(v => byGenerator.get(v))) {
			if(sup !== name) {
				addSuper(name, sup);
			}
		}
	}
	for(const [, { classDecl }] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(classDecl?.name === undefined) {
			continue;
		}
		/* a `setClassUnion` states its members as subclasses, which is the same fact written the other way round */
		for(const member of classDecl.union ?? []) {
			addSuper(member, classDecl.name);
		}
		/* `setIs(class1, class2)` states the same is-a relation `contains` does */
		if(classDecl.relation === 'is') {
			addSuper(classDecl.name, classDecl.contains[0]);
		}
	}
	return classes;
}

/** Variable name to the class its generator declares, for the `Cls <- R6Class(...)`/`Cls <- new_class(...)` bindings. */
function generatorVariables(graph: DataflowGraph, classes: ReadonlyMap<string, DeclaredClass>): Map<string, string> {
	const classOfId = new Map(classes.values().map(d => [d.id, d.name] as const));
	const generators = new Map<string, string>();
	for(const [id] of graph.verticesOfType(VertexType.VariableDefinition)) {
		const lexeme = NodeId.recoverName(id, graph.idMap);
		if(lexeme === undefined) {
			continue;
		}
		for(const target of edgeTargets(graph, id, EdgeType.DefinedBy)) {
			const cls = classOfId.get(target);
			if(cls !== undefined) {
				generators.set(lexeme, cls);
			}
		}
	}
	return generators;
}

/**
 * The transitive superclasses of `name` among `classes`, nearest first and each named once. A class the
 * analysis never saw declared ends the chain, so what another package contributes is simply not in the answer.
 */
export function superClassesOfImpl(name: string, classes: ReadonlyMap<string, ClassDeclaration>): string[] {
	const seen = new Set([name]);
	/* a set iteration also visits what is added during it, so this walks the hierarchy breadth first */
	for(const next of seen) {
		for(const sup of classes.get(next)?.contains ?? []) {
			seen.add(sup);
		}
	}
	seen.delete(name);
	return [...seen];
}

/**
 * The {@link SigClassInfo} records the signature database stores for the classes an analysis found. A class
 * the analysis declared carries no `package`; a referenced class `ownerOf` can place becomes a `foreign` record.
 */
export function toSigClassesImpl(classes: ReadonlyMap<string, DeclaredClass>, ownerOf?: (name: string) => string | undefined): SigClassInfo[] {
	const records: SigClassInfo[] = classes.values().map(declared => compactRecord({
		name:    declared.name,
		system:  declared.system,
		supers:  declared.union ?? declared.contains,
		slots:   declared.members.filter(m => !m.method).map(m => compactRecord({ name: m.name, type: m.type })),
		virtual: declared.virtual ? true : undefined,
		union:   declared.union !== undefined ? true : undefined
	})).toArray();
	if(ownerOf === undefined) {
		return records;
	}
	/* a superclass the analysis never declared belongs to whoever does define it, which is what makes an
	   inherited class distinguishable from one the package owns */
	for(const referenced of new Set(records.flatMap(r => r.supers))) {
		const owner = classes.has(referenced) ? undefined : ownerOf(referenced);
		if(owner !== undefined) {
			records.push({ name: referenced, system: 's4', supers: [], slots: [], package: owner });
		}
	}
	return records;
}

/** The class vector S3 dispatch sees for the value at `id`: a `structure(..., class = )` or a constant, `undefined` if not statically known. */
function s3ClassOfValue(id: NodeId, info: ResolveInfo & { readonly graph: DataflowGraph, readonly idMap: AstIdMap }): readonly string[] | undefined {
	const node = info.idMap.get(id);
	if(RFunctionCall.is(node) && hasEdgeOfType(info.graph, id, NodeId.toBuiltIn('structure'), EdgeType.Calls)) {
		const cls = NodeValue.soleOf(argForImpl(node.arguments, { name: 'class' }), info);
		const strings = cls?.type === 'string' ? collectStrings([cls]) : cls?.type === 'vector' && isValue(cls.elements) ? collectStrings(cls.elements) : undefined;
		return strings?.length ? strings : undefined;
	}
	const value = NodeValue.soleOf(id, info);
	if(value?.type === 'string') {
		return ['character'];
	} else if(value?.type === 'logical') {
		return ['logical'];
	} else if(value?.type === 'number' && isValue(value.value)) {
		return value.value.complexNumber ? ['complex'] : value.value.markedAsInt ? ['integer', 'numeric'] : ['double', 'numeric'];
	}
	return undefined;
}

/** The value a plain assignment binds to the definition `def`, `undefined` for any other kind of definition (`class(x) <- `, `assign`, a parameter, ...). */
function assignedValueOf(def: NodeId, graph: DataflowGraph): NodeId | undefined {
	const vertex = graph.getVertex(def);
	const byAssignment = edgeTargets(graph, def, EdgeType.DefinedBy).some(t => DfgVertex.hasOrigin(graph.getVertex(t), BuiltInProcName.Assignment));
	return DfgVertex.isVariableDefinition(vertex) && byAssignment && vertex.source?.length === 1 ? vertex.source[0] : undefined;
}

/** The class vectors S3 dispatch may see for the argument at `id`, one per reaching definition, `undefined` unless all are known. */
export function s3DispatchClassesOf(id: NodeId, info: ResolveInfo & { readonly graph: DataflowGraph, readonly idMap: AstIdMap }): readonly (readonly string[])[] | undefined {
	const { graph } = info;
	const value = RArgument.valueOf(info.idMap.get(id))?.info.id;
	const isRead = value !== undefined && DfgVertex.isUse(graph.getVertex(value));
	const values = isRead ? edgeTargets(graph, value, EdgeType.Reads).map(def => assignedValueOf(def, graph)) : [value];
	const classes = values.map(v => v === undefined ? undefined : s3ClassOfValue(v, info));
	return classes.length > 0 && classes.every(isNotUndefined) ? classes : undefined;
}
