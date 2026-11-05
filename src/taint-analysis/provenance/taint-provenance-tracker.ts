import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { TaintRole } from '../taint-mapping';
import { type DataflowGraph, FunctionArgument } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import type { ResolvedTaint } from '../taint-resolve';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { SourceLocation } from '../../util/range';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';

export interface TaintProvenanceEntry {
	readonly call:      NodeId
	readonly role?:     TaintRole
	readonly category?: string
	readonly inputs?:   readonly { readonly node: NodeId, readonly taint: AnyAbstractDomain | undefined }[]
	readonly value:     AnyAbstractDomain
	readonly notes:     readonly string[]
}

export interface TaintProvenanceTracker {
	record(call: DataflowGraphVertexFunctionCall, resolved: ResolvedTaint, projectArg: (id: NodeId) => AnyAbstractDomain | undefined): void
	entries(): readonly TaintProvenanceEntry[]
}

export type TaintOrigin = TaintProvenanceEntry & {
	readonly code?: string
	readonly loc?:  SourceLocation
};

export class CallProvenanceTracker implements TaintProvenanceTracker {
	private readonly byCall = new Map<NodeId, TaintProvenanceEntry>();

	public record(call: DataflowGraphVertexFunctionCall, { value, role, category, recordProvenance, defaultSuppressed, notes }: ResolvedTaint, projectArg: (id: NodeId) => AnyAbstractDomain | undefined): void {
		if(!recordProvenance) {
			this.byCall.delete(call.id);
			return;
		}
		if(defaultSuppressed) {
			this.byCall.set(call.id, { call: call.id, role, category, value, notes });
			return;
		}
		const inputs = call.args.filter(FunctionArgument.isNotEmpty).map(arg => ({ node: arg.nodeId, taint: projectArg(arg.nodeId) }));
		const unchanged = inputs.some(input => input.taint !== undefined && value.equals(input.taint));
		if(!unchanged && !value.isTop()) {
			this.byCall.set(call.id, { call: call.id, role, category, inputs, value, notes });
		} else {
			this.byCall.delete(call.id);
		}
	}

	public entries(): readonly TaintProvenanceEntry[] {
		return [...this.byCall.values()];
	}
}

/**
 * Collects the recorded calls and taint flows for a given node.
 */
export function findOrigins(tracker: TaintProvenanceTracker | undefined, nodeId: NodeId, dfg: DataflowGraph, idMap: AstIdMap): TaintOrigin[] {
	if(tracker === undefined) {
		return [];
	}
	const reaching = Dataflow.provenance(nodeId, dfg);
	return tracker.entries()
		.filter(entry => reaching.has(entry.call))
		.map(entry => {
			const node = idMap.get(entry.call);
			return { ...entry, loc: SourceLocation.fromNode(node), code: RNode.lexeme(node) };
		})
		.sort((a, b) => a.loc && b.loc ? SourceLocation.compare(b.loc, a.loc) : 0);
}
