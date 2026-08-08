import type { DependencyInfo } from './dependencies-query-format';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../../dataflow/info';
import { queryFnProps } from '../../../dataflow/environments/query-fn-props';
import { CallProp } from '../../../dataflow/environments/built-in-props';
import { VertexType } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { SourceRange } from '../../../util/range';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

/** the {@link CallProp} bits of the call `id` makes */
function propsOf(id: NodeId, { graph, environment }: DataflowInformation): number {
	const vertex = graph.getVertex(id);
	if(vertex?.tag !== VertexType.FunctionCall) {
		return 0;
	}
	const name = Dataflow.qualify(id, graph, false) ?? vertex.name;
	return queryFnProps(name, { environment: vertex.environment ?? environment })?.props ?? 0;
}

/**
 * Names the file each visualization lands in: a device opener (`pdf("a.pdf")`) takes every plot until the
 * device is closed (`dev.off()`), so those plots end up in its file instead of on screen. A plot outside any
 * open device keeps the value it had.
 *
 * Openers are the `write` entries that draw ({@link CallProp.Graphics}), closers the calls that end a device
 * ({@link CallProp.Closes}), and the order is the one the source states.
 */
export function linkPlotsToDevices(written: readonly DependencyInfo[], plots: DependencyInfo[], dataflow: DataflowInformation, ast: NormalizedAst): void {
	const opened = new Map(written
		.filter(w => w.value !== undefined && (propsOf(w.nodeId, dataflow) & CallProp.Graphics) !== 0)
		.map(w => [w.nodeId, w.value as string]));
	if(opened.size === 0) {
		return;
	}
	const closed = new Set(dataflow.graph.vertices(true)
		.filter(([id, v]) => v.tag === VertexType.FunctionCall && (propsOf(id, dataflow) & CallProp.Closes) !== 0)
		.map(([id]) => id));
	const plotAt = new Map(plots.map((p, index) => [p.nodeId, index]));
	const located = [...opened.keys(), ...closed, ...plotAt.keys()]
		.flatMap(id => {
			const at = ast.idMap.get(id)?.location; return at ? [[id, at] as const] : [];
		})
		.sort(([, a], [, b]) => SourceRange.compare(a, b));

	const devices: string[] = [];
	for(const [id] of located) {
		const file = opened.get(id);
		const plot = plotAt.get(id);
		if(file !== undefined) {
			devices.push(file);
		} else if(closed.has(id)) {
			devices.pop();
		} else if(plot !== undefined && devices.length > 0) {
			plots[plot] = { ...plots[plot], value: devices[devices.length - 1] };
		}
	}
}
