
enum ExecutionState{
	ALWAYS,
	MAYBE,
	NEVER
}


export interface IExecutionTuple {
	readonly executed:               ExecutionState
	readonly influencingExpressions: Array<>
}