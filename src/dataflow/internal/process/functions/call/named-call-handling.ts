import type { DataflowProcessorInformation } from '../../../../processor';
import { DataflowInformation } from '../../../../info';
import { processKnownFunctionCall } from './known-call-handling';
import { appendEnvironment } from '../../../../environments/append';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { resolveByName } from '../../../../environments/resolve-by-name';
import { VertexType } from '../../../../graph/vertex';
import { Identifier, ReferenceType } from '../../../../environments/identifier';
import { baseRExportOwner } from '../../../../../util/r-base-packages';
import type { InGraphIdentifierDefinition } from '../../../../environments/identifier';
import { EdgeType } from '../../../../graph/edge';
import { attachExportVertex, loadNodesForNamespace } from './built-in/built-in-library';
import type { DataflowGraph } from '../../../../graph/graph';


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
		exitPoints:        info.exitPoints.concat(newInfo.exitPoints),
		hooks:             info.hooks.concat(newInfo.hooks)
	};
}

/**
 * Marks the given function call node as only calling built-in functions.
 */
export function markAsOnlyBuiltIn(graph: DataflowGraph, rootId: NodeId): void {
	const v = graph.getVertex(rootId);
	if(v?.tag === VertexType.FunctionCall) {
		v.onlyBuiltin = true;
		v.environment = undefined;
	}
}

/**
 * Processes a named function call within the dataflow analysis.
 * For example, `myFunction(arg1, arg2)`, resolves against the environment.
 */
export function processNamedCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const resolved = resolveByName(name.content, data.environment, ReferenceType.Function) ?? [];
	let defaultProcessor = resolved.length === 0;

	/* if this call will be marked as built-in only (see below), its vertex needs no environment snapshot */
	if(resolved.length > 0
		&& resolved.every(r => r.type === ReferenceType.BuiltInFunction && typeof r.processor === 'function')
		&& resolved.some(r => r.type === ReferenceType.BuiltInFunction && r.config?.libFn !== true)) {
		data = { ...data, builtInNoEnv: rootId };
	}

	let information: DataflowInformation | undefined = undefined;
	let builtIn = false;
	for(const resolvedFunction of resolved) {
		if(resolvedFunction.type === ReferenceType.BuiltInFunction && typeof resolvedFunction.processor === 'function') {
			builtIn ||= resolvedFunction.config?.libFn !== true;
			information = mergeInformation(information, resolvedFunction.processor(name, args, rootId, data));
		} else {
			defaultProcessor = true;
		}
	}

	if(defaultProcessor) {
		/* if we do not know where we land, we force! reuse `resolved`, data.environment did not change above */
		const call = processKnownFunctionCall({ name, args, rootId, data, forceArgs: resolved.length > 0 ? undefined : 'all', origin: 'default' });
		information = mergeInformation(information, call.information);
	} else if(information && builtIn) {
		// mark the function call as built in only
		markAsOnlyBuiltIn(information.graph, rootId);
	}

	// on demand: materialize the built-in vertex for any package export this call resolves to and, when we
	// already know the loading call here, link to it (a function-local export is invisible to the later
	// top-level linkMaterializedExportsToLoaders pass, so we must catch it at the call site)
	if(information) {
		const sigdb = data.ctx.config.solver.sigdb;
		for(const r of resolved) {
			if(r.type === ReferenceType.Function && r.nodeId !== undefined && NodeId.isBuiltIn(r.nodeId)) {
				attachExportVertex(information.graph, r.nodeId, data.environment, data.ctx, data.cds);
				const definedAt = (r as Partial<InGraphIdentifierDefinition>).definedAt;
				if(definedAt !== undefined && !NodeId.isBuiltIn(definedAt)) {
					information.graph.addEdge(r.nodeId, definedAt, EdgeType.Reads | EdgeType.Calls);
					// the call itself reads the library() load that made this export resolvable
					information.graph.addEdge(rootId, definedAt, EdgeType.Reads);
				}
				// opt-in: a lightweight ref edge from the call to its sigdb-backed package function vertex
				if(sigdb.linkPackageCalls && NodeId.toPkgFn(r.nodeId) !== undefined) {
					information.graph.addEdge(rootId, r.nodeId, EdgeType.Reads);
				}
			}
		}
		const ns = Identifier.getNamespace(name.content);
		// an explicit `pkg::fn` links to a database-unresolved `library(pkg)` recorded below the global env
		if(ns !== undefined) {
			for(const loadNode of loadNodesForNamespace(data.environment, ns)) {
				information.graph.addEdge(rootId, loadNode, EdgeType.Reads);
			}
		}
		// opt-in: link a bare base-R call to its sigdb function vertex (base-R qualification is edge-free otherwise);
		// same guards as Identifier.toQualified -- not namespaced, not resolving to a user definition
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
