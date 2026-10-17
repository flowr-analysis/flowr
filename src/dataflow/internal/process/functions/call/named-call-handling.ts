import type { DataflowProcessorInformation } from '../../../../processor';
import { hidesBody, readsAllAmbientState } from './built-in/built-in-ambient-state';
import { FunctionSemantics } from '../../../../fn/function-semantics';
import { DataflowInformation, type ExitPoint, withCds } from '../../../../info';
import { processKnownFunctionCall } from './known-call-handling';
import { appendEnvironment } from '../../../../environments/append';
import type { AstIdMap, ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RParameter } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RString } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RExpressionList } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { OperatorDatabase } from '../../../../../r-bridge/lang-4.x/ast/model/operators';
import { type PotentiallyEmptyRArgument, RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RBinaryOp } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RFunctionDefinition } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier, isReferenceType, ReferenceType } from '../../../../environments/identifier';
import { baseRExportOwner, isBaseRPackage } from '../../../../../util/r-base-packages';
import type { IdentifierDefinition, InGraphIdentifierDefinition } from '../../../../environments/identifier';
import type { BuiltInIdentifierDefinition } from '../../../../environments/built-in';
import { EdgeType } from '../../../../graph/edge';
import { attachExportVertex, loadNodesForNamespace } from './built-in/built-in-library';
import type { DataflowGraph } from '../../../../graph/graph';
import { DfgVertex } from '../../../../graph/vertex';
import { Resolve } from '../../../../environments/resolve-helper';
import { isNotUndefined } from '../../../../../util/assert';
import { CallProp, CallProps, SemanticCallTag } from '../../../../environments/built-in-props';
import { queryFnProps } from '../../../../environments/query-fn-props';

function mergeInformation(info: DataflowInformation | undefined, newInfo: DataflowInformation): DataflowInformation {
	if(info === undefined) {
		return newInfo;
	}
	return {
		unknownReferences: info.unknownReferences.concat(newInfo.unknownReferences),
		in:                info.in.concat(newInfo.in),
		out:               info.out.concat(newInfo.out),
		graph:             info.graph.mergeWith(newInfo.graph),
		environment:       appendEnvironment(info.environment, newInfo.environment),
		entryPoint:        newInfo.entryPoint,
		cfgEntry:          newInfo.cfgEntry,
		cfgExit:           newInfo.cfgExit,
		exitPoints:        info.exitPoints.concat(newInfo.exitPoints),
		hooks:             info.hooks.concat(newInfo.hooks)
	};
}

/**
 * The flowR definition of `pkg::fn` behind an export a signature database attached. Such an export binds the
 * name in a layer below the global environment, which hides the built-in environment underneath, and with it
 * everything the configuration models about the call: how it evaluates its arguments, the class it declares,
 * the value it folds to. Without this lookup, attaching the package would silently disable all of it, so
 * `library(dplyr); filter(df, id > 2)` would lose the data mask of `dplyr::filter`, and attaching `R6` would
 * lose the class `R6Class("P")` declares. The call itself stays a call to the export, it is only
 * processed by what flowR states about the very same name.
 */
function builtInBehindExport<OtherInfo>(
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	definition: IdentifierDefinition
): BuiltInIdentifierDefinition | undefined {
	if(definition.type !== ReferenceType.Function || definition.name === undefined || !NodeId.isBuiltIn(definition.nodeId)
		|| Identifier.getNamespace(definition.name) === undefined) {
		return undefined;
	}
	const known = data.ctx.env.builtInFunctionOf(definition.name);
	if(known !== undefined) {
		return known;
	}
	/* an alias binds the export under a name no built-in lookup finds, but attaching it carried what the
	   configuration states about the exported name along */
	const attached = definition as unknown as Partial<BuiltInIdentifierDefinition>;
	return typeof attached.processor === 'function' ? attached as BuiltInIdentifierDefinition : undefined;
}

/** Marks the given function call node as only calling built-in functions. */
export function markAsOnlyBuiltIn(graph: DataflowGraph, rootId: NodeId, keepEnvironment = false): void {
	const v = graph.getVertex(rootId);
	if(DfgVertex.isFunctionCall(v)) {
		v.onlyBuiltin = true;
		if(!keepEnvironment) {
			v.environment = undefined;
		}
	}
}

const HandedFunction = ReferenceType.Function | ReferenceType.Parameter | ReferenceType.Argument;

/** Whether `arg` hands over a function that may draw: a symbol bound to data (`d <- read.csv(f)`, `NA`) does not, nor does a built-in stating it does not (`mean`) */
function handsOverFunction<OtherInfo>(arg: PotentiallyEmptyRArgument<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	const value = arg === EmptyArgument ? undefined : arg.value;
	if(!RSymbol.is(value)) {
		return RFunctionDefinition.is(value);
	}
	const defs = Resolve.byNameAndType(value.content, data.environment, ReferenceType.Function) ?? [];
	return defs.some(d => isReferenceType(d.type, HandedFunction)) || (defs.some(d => d.type === ReferenceType.BuiltInFunction)
		&& CallProps.hasAny(queryFnProps(value.content, { environment: data.environment }), [CallProp.Configures, SemanticCallTag.Random]));
}

/** Whether a replacement function rewrote the value of `definition`, like `body(f) <- quote(runif(1))`, so its body is unknown. */
function rewrittenByReplacement<OtherInfo>(definition: IdentifierDefinition, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	const at = (definition as Partial<InGraphIdentifierDefinition>).definedAt;
	const node = definition.type === ReferenceType.Unknown && at !== undefined ? data.completeAst.idMap.get(at) : undefined;
	return RFunctionCall.is(node) || (RBinaryOp.is(node) && RFunctionCall.is(node.lhs));
}

const bindingFrames = new WeakMap<AstIdMap, ReadonlyMap<string, ReadonlySet<NodeId | undefined>>>();

/** for each name the program binds, the functions binding it (`undefined` for the global frame or a `<<-`) */
function framesBinding(idMap: AstIdMap): ReadonlyMap<string, ReadonlySet<NodeId | undefined>> {
	let frames = bindingFrames.get(idMap);
	if(frames === undefined) {
		const found = new Map<string, Set<NodeId | undefined>>();
		for(const node of idMap.values()) {
			const target = RBinaryOp.is(node) && OperatorDatabase[node.operator]?.usedAs === 'assignment' ? (node.operator.startsWith('-') ? node.rhs : node.lhs)
				: RParameter.is(node) ? node.name : undefined;
			const name = RSymbol.is(target) ? Identifier.getName(target.content) : RString.is(target) ? target.content.str : undefined;
			if(name !== undefined) {
				const global = RBinaryOp.is(node) && (node.operator === '<<-' || node.operator === '->>');
				const frame = global ? undefined : RNode.findEnclosing(node.info.id, idMap, RFunctionDefinition.is);
				found.set(name, new Set([...found.get(name) ?? [], frame]));
			}
		}
		bindingFrames.set(idMap, frames = found);
	}
	return frames;
}

/** whether the program binds `name` in a frame enclosing the function the call is in, which a built-in found there leaves out */
function mayBeShadowed(name: string, call: NodeId, idMap: AstIdMap): boolean {
	const frames = framesBinding(idMap).get(name);
	if(frames === undefined || RExpressionList.isImplicit(idMap.get(call))) {
		return false;
	}
	const own = RNode.findEnclosing(call, idMap, RFunctionDefinition.is);
	return frames.has(undefined) || [...RNode.iterateParents(idMap.get(own as NodeId), idMap)].some(p => frames.has(p.info.id));
}

/**
 * Processes a named function call within the dataflow analysis.
 * For example, `myFunction(arg1, arg2)`, resolves against the environment.
 */
export function processNamedCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	callArguments: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const args = data.pipedArgument?.rootId === rootId ? [data.pipedArgument.argument, ...callArguments] : callArguments;
	const resolved = Resolve.byNameAndType(name.content, data.environment, ReferenceType.Function) ?? [];
	/* a function body sees its enclosing frames only where it is called, so a built-in there may be shadowed by the program */
	const shadowable = resolved.length > 0 && data.environment.level > 0 && resolved.every(r => r.type === ReferenceType.BuiltInFunction)
		&& mayBeShadowed(Identifier.getName(name.content), rootId, data.completeAst.idMap);
	let defaultProcessor = resolved.length === 0 || shadowable;

	/* a call whose meaning a later pass looks up in its environment has to keep it */
	const keepEnvironment = resolved.some(r => r.type === ReferenceType.BuiltInFunction && r.config?.keepEnvironment === true);

	/* a call marked as built-in only (see below) needs no environment snapshot */
	if(resolved.length > 0 && !keepEnvironment
		&& resolved.every(r => r.type === ReferenceType.BuiltInFunction && typeof r.processor === 'function')
		&& resolved.some(r => r.type === ReferenceType.BuiltInFunction && r.config?.libFn !== true)) {
		data = { ...data, builtInNoEnv: rootId };
	}

	let information: DataflowInformation | undefined;
	let builtIn = false;
	/* a set, because an export and the built-in behind it are two ways to the same definition */
	const toRun = new Set<BuiltInIdentifierDefinition>();
	/* within a function, a call may still resolve to a user function where the function is called, so only the top
	   level knows an unresolved call goes to a function we cannot see */
	let unknownBody = resolved.length === 0 && data.environment.level === 0;
	for(const resolvedFunction of resolved) {
		const isBuiltIn = resolvedFunction.type === ReferenceType.BuiltInFunction && typeof resolvedFunction.processor === 'function';
		/* a call through an attached export is not built-in only, but flowR's definition of it processes it */
		const own = isBuiltIn ? resolvedFunction : builtInBehindExport(data, resolvedFunction);
		if(own === undefined) {
			defaultProcessor = true;
			/* a user function's body states what it reads itself */
			unknownBody ||= hidesBody(resolvedFunction) || rewrittenByReplacement(resolvedFunction, data);
			continue;
		}
		builtIn ||= isBuiltIn && own.config?.libFn !== true;
		toRun.add(own);
	}
	/* flowR models what a package function does with its arguments, but not which of its options it reads */
	let packageFn = false;
	const alternatives: DataflowInformation[] = [];
	const processDefault = () => {
		/* if we do not know where we land, we force! reuse `resolved`, data.environment did not change above */
		const sig = resolved.length > 0 ? undefined : FunctionSemantics.call.signature.every;
		alternatives.push(processKnownFunctionCall({ name, args, rootId, data, sig, origin: 'default' }).information);
	};
	/* first, so the arguments keep the promise the shadowing function makes of them, which holds for a forcing built-in, too */
	if(shadowable) {
		processDefault();
	}
	for(const own of toRun) {
		alternatives.push(own.processor(name, args, rootId, data));
		const pkg = own.name === undefined ? undefined : Identifier.getNamespace(own.name);
		/* unless flowR states how it accesses the state, as for `withr::with_options` */
		packageFn ||= pkg !== undefined && !(own.config !== undefined && ('ambient' in own.config || 'scope' in own.config)) && !isBaseRPackage(String(pkg));
	}
	if(defaultProcessor && !shadowable) {
		processDefault();
	}
	for(const alternative of alternatives) {
		information = mergeInformation(information, alternative);
	}
	if(!defaultProcessor && information && builtIn) {
		markAsOnlyBuiltIn(information.graph, rootId, keepEnvironment);
	}
	/* an exit only some of the possible callees take is not certain */
	if(information !== undefined && alternatives.length > 1) {
		const inAll = (e: ExitPoint) => alternatives.every(a => a.exitPoints.some(o => o.nodeId === e.nodeId && o.type === e.type));
		information = { ...information, exitPoints: information.exitPoints.map(e => inAll(e) ? e : { ...e, cds: withCds(e.cds, [{ id: rootId, when: true }]) }) };
	}
	/* a function whose body we do not see may read any option or draw on the device */
	if(information !== undefined && (unknownBody || packageFn)) {
		/* a function handed in as a parameter may be anything, `runif` included, and a function handed a function may call it;
		   otherwise a package function draws only if flowR states it does */
		const draws = resolved.some(r => isReferenceType(r.type, ReferenceType.Parameter | ReferenceType.Argument) || rewrittenByReplacement(r, data)) || args.some(a => handsOverFunction(a, data));
		information = readsAllAmbientState(information, rootId, data, unknownBody, draws);
	}

	/* on demand: materialize the built-in vertex for any package export this call resolves to and, when we
	   already know the loading call here, link to it (a function-local export is invisible to the later
	   top-level linkMaterializedExportsToLoaders pass, so we must catch it at the call site) */
	if(information) {
		const sigdb = data.ctx.config.solver.sigdb;
		for(const r of resolved) {
			if(r.type === ReferenceType.Function && r.nodeId !== undefined && NodeId.isBuiltIn(r.nodeId)) {
				attachExportVertex(information.graph, r.nodeId, data.environment, data.ctx, data.cds);
				const definedAt = (r as Partial<InGraphIdentifierDefinition>).definedAt;
				if(definedAt !== undefined && !NodeId.isBuiltIn(definedAt)) {
					information.graph.addEdge(r.nodeId, definedAt, EdgeType.Reads | EdgeType.Calls);
					/* the call itself reads the library() load that made this export resolvable */
					information.graph.addEdge(rootId, definedAt, EdgeType.Reads);
				}
				/* opt-in: a lightweight ref edge from the call to its sigdb-backed package function vertex */
				if(sigdb.linkPackageCalls && NodeId.toPkgFn(r.nodeId) !== undefined) {
					information.graph.addEdge(rootId, r.nodeId, EdgeType.Reads);
				}
			}
		}
		const ns = Identifier.getNamespace(name.content);
		/* a call links to a database-unresolved `library(pkg)` recorded below the global env: `pkg::fn` names
		   its package, a bare call takes it from what flowR resolved it to, which is what ties
		   `filter(df, id > 2)` to the `library(dplyr)` that made it dplyr's */
		const owners = ns !== undefined ? [ns] : resolved
			.map(r => r.type === ReferenceType.BuiltInFunction && r.name !== undefined ? Identifier.getNamespace(r.name) : undefined)
			.filter(isNotUndefined);
		for(const owner of owners) {
			for(const loadNode of loadNodesForNamespace(data.environment, String(owner))) {
				information.graph.addEdge(rootId, loadNode, EdgeType.Reads);
			}
		}
		/* opt-in: link a bare base-R call to its sigdb function vertex (base-R qualification is edge-free otherwise);
		   same guards as Identifier.toQualified: not namespaced, not resolving to a user definition */
		if(sigdb.linkBaseRCalls && ns === undefined && !resolved.some(r => r.nodeId !== undefined && !NodeId.isBuiltIn(r.nodeId))) {
			const bare = Identifier.getName(name.content);
			const owner = baseRExportOwner(bare);
			if(owner !== undefined) {
				const builtInId = NodeId.fromPkgFn(owner, bare);
				attachExportVertex(information.graph, builtInId, data.environment, data.ctx, data.cds);
				information.graph.addEdge(rootId, builtInId, EdgeType.Reads);
			}
		}
	}

	return information ?? DataflowInformation.initialize(rootId, data);
}
