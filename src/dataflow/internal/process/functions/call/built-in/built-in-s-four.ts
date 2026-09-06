import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { type ClassArgRef, argFor, ClassSystem } from '../../../../../fn/class-declaration';
import { type Identifier, type IdentifierReference, type InGraphReferenceType, ReferenceType } from '../../../../../environments/identifier';
import { define } from '../../../../../environments/define';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { DfgVertex } from '../../../../../graph/vertex';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { processKnownFunctionCall } from '../known-call-handling';

/** shorthand for the decorated-info generics every helper below carries through */
type Data<O> = DataflowProcessorInformation<O & ParentInformation>;
type Args<O> = readonly PotentiallyEmptyRArgument<O & ParentInformation>[];

/** marks a name in R's S4 class registry (the string-keyed table `setClass` writes and `new("P")` reads), separate from the variable scope so a class `P` stays apart from a variable `P` */
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
	/** the argument naming an S4 class the call adds to without declaring it (`to` in `setAs`): read and registered anew, so a later use depends on this call as well as on the declaration */
	readonly registersArg?: ClassArgRef;
}

export { argFor };

/** The names an argument states, looking through the `c(...)`/`signature(...)` wrappers a signature may use. */
function namesOf<O>(node: RNode<O & ParentInformation> | undefined, data: Data<O>): readonly string[] {
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
function readNames<O>(info: DataflowInformation, rootId: NodeId, names: Iterable<Identifier>, type: ReferenceType, data: Data<O>): void {
	const added: IdentifierReference[] = [];
	for(const name of names) {
		added.push({ nodeId: rootId, name, type, cds: data.cds });
	}
	if(added.length > 0) {
		info.in = [...info.in, ...added];
	}
}

/** Defines `name` in the environment and records it as an out-reference of the call at `rootId`. */
function defineOut<O>(info: DataflowInformation, rootId: NodeId, name: Identifier, type: InGraphReferenceType, data: Data<O>): void {
	info.environment = define({ name, nodeId: rootId, type, definedAt: rootId, cds: data.cds }, false, info.environment);
	info.out = [...info.out, { nodeId: rootId, name, type, cds: data.cds }];
}

/** wires the S4 registrations a call *uses* (the classes and generic its arguments name by string), read against the registry so the call depends on whatever `setClass`/`setGeneric` wrote them */
export function linkS4Uses<O>(info: DataflowInformation, args: Args<O>, rootId: NodeId, data: Data<O>, config: S4UseConfig): void {
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
			defineOut(info, rootId, s4ClassName(cls), ReferenceType.Variable, data);
		}
	}
}

/** wires what the attached {@link DataflowGraphVertexFunctionCall.classDecl|class declaration} states, S4 only: a declaration reads the classes it builds on and registers its own name; a mere relation (`setIs`, `setValidity`) reads and re-registers the class it names */
export function linkS4Declaration<O>(info: DataflowInformation, rootId: NodeId, data: Data<O>): void {
	const vertex = info.graph.getVertex(rootId);
	const decl = DfgVertex.isFunctionCall(vertex) ? vertex.classDecl : undefined;
	if(decl === undefined || decl.system !== ClassSystem.S4) {
		return;
	}
	const used = [...decl.contains, ...(decl.union ?? []), ...decl.members.map(m => m.type).filter(t => t !== undefined)];
	if(decl.relation !== undefined && decl.name !== undefined) {
		used.push(decl.name);
	}
	readNames(info, rootId, used.map(s4ClassName), ReferenceType.Variable, data);
	if(decl.name !== undefined) {
		defineOut(info, rootId, s4ClassName(decl.name), ReferenceType.Variable, data);
	}
}

/** Records that the call registers the S4 generics it names, which `setMethod` and a call of the name depend on. */
export function linkS4Generic<O>(info: DataflowInformation, rootId: NodeId, names: readonly string[], data: Data<O>): void {
	for(const name of names) {
		defineOut(info, rootId, name, ReferenceType.Function, data);
	}
}

/** Processes a call that consumes S4 registrations without declaring any, like `new("P")` or `getMethod("f", "P")`. */
export function processS4Use<O>(name: RSymbol<O & ParentInformation>, args: Args<O>, rootId: NodeId, data: Data<O>, config: S4UseConfig): DataflowInformation {
	const info = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.S4Use }).information;
	linkS4Uses(info, args, rootId, data, config);
	return info;
}
