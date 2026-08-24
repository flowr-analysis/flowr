import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ClassArgRef } from '../../../../../fn/class-declaration';
import { ClassSystem } from '../../../../../fn/class-declaration';
import { type Identifier, type IdentifierReference, ReferenceType } from '../../../../../environments/identifier';
import { define } from '../../../../../environments/define';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { FunctionCallVertex } from '../../../../../graph/vertex';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { processKnownFunctionCall } from '../known-call-handling';

/**
 * Marks a name in R's S4 class registry, the string-keyed table `setClass` writes and `new("P")` reads.
 * The registry is separate from the variable scope, so the mark keeps a class `P` apart from a variable `P`.
 */
const S4ClassMark = '﹕s4class﹕';

/** The registry name of the S4 class `cls`, see {@link S4ClassMark}. */
export function s4ClassName(cls: string): Identifier {
	return S4ClassMark + cls;
}

/** Which arguments of a call name S4 registrations it depends on rather than declares. */
export interface S4UseConfig {
	/** the argument naming the S4 generic the call answers or asks about (`f` in `setMethod`) */
	readonly genericArg?:   ClassArgRef;
	/** the arguments naming S4 classes the call uses (`Class` in `new`, `signature` in `setMethod`) */
	readonly classArgs?:    readonly ClassArgRef[];
	/**
	 * the argument naming an S4 class the call adds to without declaring it, like `to` in `setAs`: the class is
	 * read and registered anew, so a later use of the name depends on this call as well as on its declaration
	 */
	readonly registersArg?: ClassArgRef;
}

/** The argument `ref` names, by name when the call gives one and by position among the unnamed ones otherwise. */
function argFor<Info>(
	args: readonly PotentiallyEmptyRArgument<Info & ParentInformation>[],
	ref:  ClassArgRef
): RNode<Info & ParentInformation> | undefined {
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

/** The names an argument states, looking through the `c(...)`/`signature(...)` wrappers a signature may use. */
function namesOf<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation> | undefined,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): readonly string[] {
	if(node === undefined) {
		return [];
	}
	const known = NodeValue.knownStringsOf(node.info.id, data);
	if(known.length > 0 || !RFunctionCall.isNamed(node)) {
		return known;
	}
	const collected: string[] = [];
	for(const arg of node.arguments) {
		if(!RArgument.isEmpty(arg) && arg.value !== undefined) {
			collected.push(...namesOf(arg.value, data));
		}
	}
	return collected;
}

/** Adds a read of every given name to the call, so the call depends on whatever registered them. */
function readNames<OtherInfo>(
	info:   DataflowInformation,
	rootId: NodeId,
	names:  Iterable<Identifier>,
	type:   ReferenceType,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): void {
	const added: IdentifierReference[] = [];
	for(const name of names) {
		added.push({ nodeId: rootId, name, type, cds: data.cds });
	}
	if(added.length > 0) {
		info.in = [...info.in, ...added];
	}
}

/** Records that the call registers the S4 class `cls`, so a later use of the name depends on this call. */
function registerClass<OtherInfo>(
	info:   DataflowInformation,
	rootId: NodeId,
	cls:    string,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): void {
	const name = s4ClassName(cls);
	info.environment = define({ name, nodeId: rootId, type: ReferenceType.Variable, definedAt: rootId, cds: data.cds }, false, info.environment);
	info.out = [...info.out, { nodeId: rootId, name, type: ReferenceType.Variable, cds: data.cds }];
}

/**
 * Wires the S4 registrations a call *uses*: the classes and the generic its arguments name by string.
 * The names are read against the registry, so the call depends on whatever `setClass`/`setGeneric` wrote them.
 */
export function linkS4Uses<OtherInfo>(
	info:   DataflowInformation,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: S4UseConfig
): void {
	for(const ref of config.classArgs ?? []) {
		readNames(info, rootId, namesOf(argFor(args, ref), data).map(s4ClassName), ReferenceType.Variable, data);
	}
	if(config.genericArg !== undefined) {
		readNames(info, rootId, namesOf(argFor(args, config.genericArg), data), ReferenceType.Function, data);
	}
	if(config.registersArg !== undefined) {
		const registered = namesOf(argFor(args, config.registersArg), data);
		readNames(info, rootId, registered.map(s4ClassName), ReferenceType.Variable, data);
		for(const cls of registered) {
			registerClass(info, rootId, cls, data);
		}
	}
}

/**
 * Wires what the {@link DataflowGraphVertexFunctionCall.classDecl|class declaration} attached to the call states,
 * for S4 alone: the other systems bind a generator to a variable, S4 only writes the string-keyed registry.
 * A declaration registers its own name and reads the classes it builds on; a call that merely *relates* classes
 * (`setIs`, `setValidity`) reads the class it names and registers it anew, so a later use sees the relation too.
 */
export function linkS4Declaration<OtherInfo>(
	info:   DataflowInformation,
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): void {
	const vertex = info.graph.getVertex(rootId);
	const decl = FunctionCallVertex.is(vertex) ? vertex.classDecl : undefined;
	if(decl === undefined || decl.system !== ClassSystem.S4) {
		return;
	}
	const used = [...decl.contains, ...(decl.union ?? []), ...decl.members.map(m => m.type).filter(t => t !== undefined)];
	if(decl.relation !== undefined && decl.name !== undefined) {
		used.push(decl.name);
	}
	readNames(info, rootId, used.map(s4ClassName), ReferenceType.Variable, data);
	if(decl.name !== undefined) {
		registerClass(info, rootId, decl.name, data);
	}
}

/** Records that the call registers the S4 generics it names, which `setMethod` and a call of the name depend on. */
export function linkS4Generic<OtherInfo>(
	info:   DataflowInformation,
	rootId: NodeId,
	names:  readonly string[],
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): void {
	for(const name of names) {
		info.environment = define({ name, nodeId: rootId, type: ReferenceType.Function, definedAt: rootId, cds: data.cds }, false, info.environment);
		info.out = [...info.out, { nodeId: rootId, name, type: ReferenceType.Function, cds: data.cds }];
	}
}

/**
 * Processes a call that consumes S4 registrations without declaring any, like `new("P")` or `getMethod("f", "P")`.
 */
export function processS4Use<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: S4UseConfig
): DataflowInformation {
	const info = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.S4Use }).information;
	linkS4Uses(info, args, rootId, data, config);
	return info;
}
