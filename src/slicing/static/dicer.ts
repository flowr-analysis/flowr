import { DataflowGraph } from "../../dataflow/graph/graph";
import { NormalizedAst } from "../../r-bridge/lang-4.x/ast/model/processing/decorate";
import { SlicingCriteria } from "../criterion/parse";
import { SliceResult } from "./slicer-types";
import { staticSlicing } from "./static-slicer";



export function staticDicing(graph: DataflowGraph, ast: NormalizedAst, endCriteria: SlicingCriteria, startCriteria: SlicingCriteria, threshold = 75):  Readonly<SliceResult> {
    const backwardsSlice = staticSlicing(graph, ast, endCriteria, threshold)
    const forwardSlice = forwardSlicing(graph, ast, startCriteria, threshold)

    return {timesHitThreshold: backwardsSlice.timesHitThreshold, result: backwardsSlice.result.intersection(forwardSlice.result), decodedCriteria: backwardsSlice.decodedCriteria}
}

function forwardSlicing(graph: DataflowGraph, ast: NormalizedAst, criteria: SlicingCriteria, threshold = 75): Readonly<SliceResult> {

}