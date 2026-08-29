import type { DependencyInfo } from './dependencies-query-format';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../../dataflow/info';
import { callFnProps } from '../../../dataflow/environments/query-fn-props';
import { CallProps, SemanticCallTag } from '../../../dataflow/environments/built-in-props';
import { Vertex } from '../../../dataflow/graph/vertex';
import { SourceRange } from '../../../util/range';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { PropSelector } from '../../../dataflow/environments/built-in-props';

function callHas(id: NodeId, dataflow: DataflowInformation, props: PropSelector): boolean {
	return CallProps.hasAny(callFnProps(id, dataflow), props);
}

/**
 * Names the file each visualization lands in, and the statements that build it.
 *
 * A device opener (`pdf("a.pdf")`) takes every plot until the device is closed (`dev.off()`), so those plots
 * end up in its file instead of on screen; a plot outside any open device keeps the value it had. Every plot
 * that lands in a file also reports the statements it takes to produce that file in
 * {@link DependencyInfo#parts}: the addons drawn onto it, plus the device opener and closer around it.
 * Closing a device ends the plot, so an addon after it builds whatever device is open then, not this file.
 *
 * Openers are the `write` entries that draw ({@link SemanticCallTag.Graphics}), closers the calls that end a device
 * ({@link SemanticCallTag.Closes}), and the order is the one the source states.
 */
export function linkPlotsToDevices(written: readonly DependencyInfo[], plots: DependencyInfo[], dataflow: DataflowInformation, ast: NormalizedAst): void {
	const opened = new Map(written
		.filter(w => w.value !== undefined && callHas(w.nodeId, dataflow, SemanticCallTag.Graphics))
		.map(w => [w.nodeId, w.value as string]));
	const closed = new Set(dataflow.graph.vertices(true)
		.filter(([id, v]) => Vertex.isFunctionCall(v) && callHas(id, dataflow, SemanticCallTag.Closes))
		.map(([id]) => id));
	const plotAt = new Map(plots.map((p, index) => [p.nodeId, index]));
	const located = [...opened.keys(), ...closed, ...plotAt.keys()]
		.flatMap(id => {
			const at = ast.idMap.get(id)?.location; return at ? [[id, at] as const] : [];
		})
		.sort(([, a], [, b]) => SourceRange.compare(a, b));

	/* an addon points at the creation it belongs to, a creation points at nothing */
	const linkOf = new Map(plots.filter(p => p.linkedIds?.length).map(p => [p.nodeId, p.linkedIds as readonly NodeId[]]));

	const devices: { file: string, opener: NodeId, plots: NodeId[] }[] = [];
	/* the opener/closer pair enclosing a plot, so it can report what it takes to produce its file */
	const around = new Map<NodeId, NodeId[]>();
	/* what each addon draws onto, and the creation each device window is currently showing */
	const builds = new Map<NodeId, NodeId>();
	const showing = new Map<NodeId | undefined, NodeId>();
	for(const [id] of located) {
		const file = opened.get(id);
		const plot = plotAt.get(id);
		if(file !== undefined) {
			devices.push({ file, opener: id, plots: [] });
			continue;
		} else if(closed.has(id)) {
			const device = devices.pop();
			for(const on of device?.plots ?? []) {
				around.set(on, [device?.opener as NodeId, id]);
			}
			continue;
		} else if(plot === undefined) {
			continue;
		}
		const device = devices[devices.length - 1];
		if(device !== undefined) {
			device.plots.push(id);
			around.set(id, [device.opener]);
			plots[plot] = { ...plots[plot], value: device.file };
		}
		const window = device?.opener;
		const linked = linkOf.get(id);
		if(linked === undefined) {
			/* a creation: whatever is drawn on this device from here on adds to it, as R keeps it current */
			showing.set(window, id);
			continue;
		}
		/*
		 * Prefer what the dataflow linked the addon to, which knows about `p <- ggplot(); p + geom_point()`.
		 * It only tracks position, though, so an addon after a nested device closed still points into that
		 * device; R hands the drawing back to the plot the restored device is showing, so take that instead.
		 */
		const inWindow = linked.find(to => (around.get(to)?.[0]) === window);
		const target = inWindow ?? showing.get(window);
		if(target !== undefined) {
			builds.set(id, target);
		}
	}

	const addonsOf = new Map<NodeId, NodeId[]>();
	for(const [addon, creation] of builds) {
		addonsOf.set(creation, [...addonsOf.get(creation) ?? [], addon]);
	}
	for(const [id, index] of plotAt) {
		const parts = [...addonsOf.get(id) ?? [], ...around.get(id) ?? []];
		if(parts.length > 0) {
			plots[index] = { ...plots[index], parts };
		}
	}
}
