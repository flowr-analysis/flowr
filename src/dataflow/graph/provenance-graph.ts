import type { DataflowGraph } from './graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { staticSlice } from '../../slicing/static/static-slicer';
import type { DataflowInformation } from '../info';
import type { FlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SlicingCriteria } from '../../slicing/criterion/parse';
import { SliceDirection } from '../../util/slice-direction';

/**
 * Given the id of a vertex (usually a variable use),
 * this returns the full provenance graph by calculating the backward slice
 * of the id and returning only vertices and edges that are fully enclosed in the dataflow graph.
 */
export function calculateProvenance(id: NodeId, info: DataflowInformation, nast: NormalizedAst, ctx: FlowrAnalyzerContext): DataflowGraph {
	const slice = staticSlice(
		ctx,
		info,
		nast,
		['$' + id] as SlicingCriteria,
		SliceDirection.Backward
	);
	console.log(slice);

	return info.graph;
}