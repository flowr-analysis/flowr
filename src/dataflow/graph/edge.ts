/**
 * An edge consist of only of the type (source and target are encoded with the Dataflow Graph).
 * Multiple edges are encoded by joining the respective type bits.
 */
export interface DataflowGraphEdge {
	types: EdgeTypeBits
}

/**
 * Represents the relationship between the source and the target vertex in the dataflow graph.
 * The actual value is represented as a bitmask so use {@link edgeTypesToNames} to get something more human-readable.
 * Similarly, you can access {@link EdgeTypeName} to access the name counterpart.
 */
export enum EdgeType {
	/** The edge determines that source reads target */
	Reads = 1,
	/** The edge determines that source is defined by target */
	DefinedBy = 2,
	/** The edge determines that the source calls the target */
	Calls = 4,
	/** The source returns target on call */
	Returns = 8,
	/**
	 * The edge determines that source (probably argument) defines the target (probably parameter).
	 * This may also link a function call to definitions it causes to be active (as part of the closure) of the called function definition.
	 */
	DefinesOnCall = 16,
	/**
	 * Usually the inverse of `defines-on-call` (in the context of arguments and parameters).
	 * This may also link an open read (within a function) to the definition that is active at the call site.
	 */
	DefinedByOnCall = 32,
	/** Formal used as argument to a function call */
	Argument = 64,
	/** The edge determines that the source is a side effect that happens when the target is called */
	SideEffectOnCall = 128,
	/** The Edge determines that the reference is affected by a non-standard evaluation (e.g., a for-loop body or a quotation) */
	NonStandardEvaluation = 256
}

/**
 * See {@link EdgeType} for the basis.
 */
export const enum EdgeTypeName {
	Reads                 = 'reads',
	DefinedBy             = 'defined-by',
	Calls                 = 'calls',
	Returns               = 'returns',
	DefinesOnCall         = 'defines-on-call',
	DefinedByOnCall       = 'defined-by-on-call',
	Argument              = 'argument',
	SideEffectOnCall      = 'side-effect-on-call',
	NonStandardEvaluation = 'non-standard-evaluation'
}

export type EdgeTypeBits = number

const edgeTypeToHumanReadableName: ReadonlyMap<EdgeType, EdgeTypeName> = new Map<EdgeType, EdgeTypeName>([
	[EdgeType.Reads,                 EdgeTypeName.Reads                ],
	[EdgeType.DefinedBy,             EdgeTypeName.DefinedBy            ],
	[EdgeType.Calls,                 EdgeTypeName.Calls                ],
	[EdgeType.Returns,               EdgeTypeName.Returns              ],
	[EdgeType.DefinesOnCall,         EdgeTypeName.DefinesOnCall        ],
	[EdgeType.DefinedByOnCall,       EdgeTypeName.DefinedByOnCall      ],
	[EdgeType.Argument,              EdgeTypeName.Argument             ],
	[EdgeType.SideEffectOnCall,      EdgeTypeName.SideEffectOnCall     ],
	[EdgeType.NonStandardEvaluation, EdgeTypeName.NonStandardEvaluation]
]);

/**
 * Only use this function to retrieve a human-readable name if you know that it is a single bitmask.
 * Otherwise, use {@link edgeTypesToNames} which handles these cases.
 */
export function edgeTypeToName(type: EdgeType): string {
	return edgeTypeToHumanReadableName.get(type) as string;
}

export function splitEdgeTypes(types: EdgeTypeBits): EdgeType[] {
	const split = [];
	for(const bit of edgeTypeToHumanReadableName.keys()) {
		if((types & bit) !== 0) {
			split.push(bit);
		}
	}
	return split;
}

export function edgeTypesToNames(bits: EdgeTypeBits): Set<EdgeTypeName> {
	const types = new Set<EdgeTypeName>();
	for(const [bit, name] of edgeTypeToHumanReadableName.entries()) {
		if((bits & bit) !== 0) {
			types.add(name);
		}
	}
	return types;
}

export const enum TraverseEdge {
	/** Do not traverse this edge */
	Never = 0,
	/** Traverse the edge as a side effect */
	SideEffect = 1,
	/** Traverse this edge if the definition is relevant (i.e., if two matching edges trigger this state) */
	OnlyIfBoth = 2,
	/** Always traverse this edge */
	Always = 3
}

/**
 * Check if the given-edge type has any of the given types.
 * @example
 *
 * ```typescript
 * edgeIncludesType(EdgeType.Reads, EdgeType.Reads | EdgeType.DefinedBy) // true
 *```
 *
 * Counterpart of {@link edgeDoesNotIncludeType}.
 */
export function edgeIncludesType(type: EdgeTypeBits, typesToInclude: EdgeTypeBits): boolean {
	return (typesToInclude & type) !== 0;
}

/**
 * Check if the given-edge type does not include the given type.
 * Counterpart of {@link edgeIncludesType}.
 */
export function edgeDoesNotIncludeType(type: EdgeTypeBits, types: EdgeTypeBits): boolean {
	return (types & type) === 0;
}


const alwaysTraverseEdgeTypes = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.Argument | EdgeType.Calls;

const definedByOnCallTypes = EdgeType.DefinesOnCall | EdgeType.DefinedByOnCall;

export function shouldTraverseEdge(types: EdgeTypeBits): TraverseEdge {
	if(edgeIncludesType(types, alwaysTraverseEdgeTypes)) {
		return TraverseEdge.Always;
	} else if(edgeIncludesType(types, definedByOnCallTypes)) {
		return TraverseEdge.OnlyIfBoth;
	} else if(edgeIncludesType(types, EdgeType.SideEffectOnCall)) {
		return TraverseEdge.SideEffect;
	}
	return TraverseEdge.Never;
}
