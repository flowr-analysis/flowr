/**
 * An edge consist of:
 * - the target node (i.e., the variable or processing node),
 * - a type (if it is read or used in the context), and
 * - an attribute (if this edge exists for every program execution or if it is only one possible execution path).
 */
export interface DataflowGraphEdge {
	// currently multiple edges are represented by multiple types
	types: EdgeTypeBits
}


/**
 * Represents the relationship between the source and the target vertex in the dataflow graph.
 */
export const enum EdgeType {
	/** The edge determines that source reads target */
	Reads = 'reads',
	/** The edge determines that source is defined by target */
	DefinedBy = 'defined-by',
	/** The edge determines that the source calls the target */
	Calls = 'calls',
	/** The source returns target on call */
	Returns = 'returns',
	/** The edge determines that source (probably argument) defines the target (probably parameter), currently automatically created by `addEdge` */
	DefinesOnCall = 'defines-on-call',
	/** Inverse of `defines-on-call` currently only needed to get better results when slicing complex function calls */
	DefinedByOnCall = 'defined-by-on-call',
	/** Formal used as argument to a function call */
	Argument = 'argument',
	/** The edge determines that the source is a side effect that happens when the target is called */
	SideEffectOnCall = 'side-effect-on-call',
	/** The Edge determines that the reference is affected by a non-standard evaluation (e.g., a for-loop body or a quotation) */
	NonStandardEvaluation = 'non-standard-evaluation'
}

export type EdgeTypeBits = number

const edgeTypeToBitMapping: Record<EdgeType, EdgeTypeBits> = {
	[EdgeType.Reads]:                 1 << 0,
	[EdgeType.DefinedBy]:             1 << 1,
	[EdgeType.Calls]:                 1 << 2,
	[EdgeType.Returns]:               1 << 3,
	[EdgeType.DefinesOnCall]:         1 << 4,
	[EdgeType.DefinedByOnCall]:       1 << 5,
	[EdgeType.Argument]:              1 << 6,
	[EdgeType.SideEffectOnCall]:      1 << 7,
	[EdgeType.NonStandardEvaluation]: 1 << 8,
} as const

export function edgeTypeToBit(type: EdgeType): EdgeTypeBits {
	return edgeTypeToBitMapping[type]
}

export function bitsToEdgeTypes(bits: EdgeTypeBits): Set<EdgeType> {
	const types = new Set<EdgeType>()
	for(const [type, bit] of Object.entries(edgeTypeToBitMapping)) {
		if((bits & bit) !== 0) {
			types.add(type as EdgeType)
		}
	}
	return types
}

export const enum TraverseEdge {
	/** Do not traverse this edge */
	Never = 0,
	/** Traverse the edge as a side effect */
	SideEffect = 1,
	/** Traverse this edge if the definition is relevant */
	DefinedByOnCall = 2,
	/** Always traverse this edge */
	Always = 3
}

export function shouldTraverseEdge(types: EdgeTypeBits): TraverseEdge {
	if((types & (edgeTypeToBit(EdgeType.Reads) | edgeTypeToBit(EdgeType.DefinedBy) | edgeTypeToBit(EdgeType.Argument) | edgeTypeToBit(EdgeType.Calls) | edgeTypeToBit(EdgeType.DefinesOnCall))) != 0) {
		return TraverseEdge.Always
	}
	if((types & edgeTypeToBit(EdgeType.DefinedByOnCall)) != 0) {
		return TraverseEdge.DefinedByOnCall
	}
	if((types & edgeTypeToBit(EdgeType.SideEffectOnCall)) != 0) {
		return TraverseEdge.SideEffect
	}
	return TraverseEdge.Never
}
