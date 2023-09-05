import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { ParentInformation, RBinaryOp } from '../../../../r-bridge'
import { appendEnvironments, overwriteEnvironments } from '../../../environments'

export function processNonAssignmentBinaryOp<OtherInfo>(op: RBinaryOp<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const lhs = processDataflowFor(op.lhs, data)
	const rhs = processDataflowFor(op.rhs, data)

	const ingoing = [...lhs.in, ...rhs.in, ...lhs.unknownReferences, ...rhs.unknownReferences]
	const nextGraph = lhs.graph.mergeWith(rhs.graph)

	// logical operations may not execute the right hand side (e.g., `FALSE && (x <- TRUE)`)
	const merger = op.flavor === 'logical' ? appendEnvironments : overwriteEnvironments

	return {
		unknownReferences: [], // binary ops require reads as without assignments there is no definition
		in:                ingoing,
		out:               [...lhs.out, ...rhs.out],
		environments:      merger(lhs.environments, rhs.environments),
		graph:             nextGraph,
		scope:             data.activeScope,
	}
}
