/**
 * An edge consist of only of the type (source and target are encoded with the Dataflow Graph).
 * Multiple edges are encoded by joining the respective type bits.
 * @see {@link EdgeType} for the basis.
 * @see {@link DfEdge} for helper functions.
 */
export interface DfEdge {
	types: EdgeTypeBits
}

/**
 * Represents the relationship between the source and the target vertex in the dataflow graph.
 * The actual value is represented as a bitmask, so please refer to {@link DfEdge} for helpful functions.
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

export type EdgeTypeBits = number;

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

type DfEdgeLike = { types: number };

/**
 * Helper Functions to work with {@link DfEdge} and {@link EdgeType}.
 */
export const DfEdge = {
	/**
	 * Takes joint edge types and returns their human-readable names.
	 */
	typesToNames(this: void, { types }: DfEdgeLike): Set<EdgeTypeName> {
		const rTypes = new Set<EdgeTypeName>();
		for(const [bit, name] of edgeTypeToHumanReadableName.entries()) {
			if((types & bit) !== 0) {
				rTypes.add(name);
			}
		}
		return rTypes;
	},
	/**
	 * Takes joint edge types and splits them into their individual components.
	 * @example
	 * ```ts
	 * DfEdge.splitTypes({ types: EdgeType.Reads | EdgeType.DefinedBy });
	 * // returns [EdgeType.Reads, EdgeType.DefinedBy]
	 * ```
	 */
	splitTypes(this: void, { types }: DfEdgeLike): EdgeType[] {
		const split = [];
		for(const bit of edgeTypeToHumanReadableName.keys()) {
			if((types & bit) !== 0) {
				split.push(bit);
			}
		}
		return split;
	},
	/**
	 * Only use this function to retrieve a human-readable name if you know that it is a single bitmask.
	 * Otherwise, use {@link DfEdge#typesToNames} which handles these cases.
	 */
	typeToName(this: void, type: EdgeType): string {
		return edgeTypeToHumanReadableName.get(type) as string;
	},
	/**
	 * Check if the given-edge type has any of the given types.
	 * As types are bitmasks, you can combine multiple types with a bitwise OR (`|`).
	 * @example
	 *
	 * ```ts
	 * edgeIncludesType({ types: EdgeType.Reads }, EdgeType.Reads | EdgeType.DefinedBy) // true
	 *```
	 *
	 * Counterpart of {@link DfEdge#doesNotIncludeType}.
	 */
	includesType(this: void, { types }: DfEdgeLike, typesToInclude: EdgeType): boolean {
		return (typesToInclude & types) !== 0;
	},
	/**
	 * Check if the given-edge type does not include the given type.
	 * As types are bitmasks, you can combine multiple types with a bitwise OR (`|`).
	 * Counterpart of {@link DfEdge#includesType}.
	 */
	doesNotIncludeType(this: void, { types }: DfEdgeLike, any: EdgeType): boolean {
		return (any & types) === 0;
	},
} as const;


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


const alwaysTraverseEdgeTypes = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.Argument | EdgeType.Calls;

const definedByOnCallTypes = EdgeType.DefinesOnCall | EdgeType.DefinedByOnCall;

/**
 * Determines whether an edge should be traversed during dataflow analysis.
 */
export function shouldTraverseEdge(e: DfEdge): TraverseEdge {
	if(DfEdge.includesType(e, EdgeType.NonStandardEvaluation)) {
		return TraverseEdge.Never;
	} else if(DfEdge.includesType(e, alwaysTraverseEdgeTypes)) {
		return TraverseEdge.Always;
	} else if(DfEdge.includesType(e, definedByOnCallTypes)) {
		return TraverseEdge.OnlyIfBoth;
	} else if(DfEdge.includesType(e, EdgeType.SideEffectOnCall)) {
		return TraverseEdge.SideEffect;
	}
	return TraverseEdge.Never;
}
