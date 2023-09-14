import {
	NodeId,
	ParentInformation,
	RExpressionList,
	RFunctionDefinition, RIfThenElse, RLoopConstructs,
	RNode,
	Type
} from '../../../../r-bridge'
import { assertUnreachable } from '../../../../util/assert'

interface ExitPointsInformation {
	knownIds:     NodeId[]
	potentialIds: NodeId[]
}

export function retrieveExitPointsOfFunctionDefinition<OtherInfo>(functionDefinition: RFunctionDefinition<OtherInfo & ParentInformation>): NodeId[] {
	const exitPoints = visitExitPoints(functionDefinition.body)
	return exitPoints.knownIds.concat(exitPoints.potentialIds)
}

function visitExitPoints<OtherInfo>(node: RNode<OtherInfo & ParentInformation>): ExitPointsInformation {
	const type = node.type
	switch(type) {
		case Type.ExpressionList:
			return visitExpressionList(node)
		case Type.FunctionCall:
			if(node.flavor === 'named' && node.functionName.content === 'return') {
				return {
					knownIds:     [ node.info.id ],
					potentialIds: []
				}
			}
			break
		case Type.FunctionDefinition:
			// do not further investigate
			break
		case Type.ForLoop:
		case Type.WhileLoop:
		case Type.RepeatLoop:
			// loops return invisible null, as we do not trace values, but they may contain return statements
			return visitLoops(node)
		case Type.IfThenElse:
			return visitIf(node)
		case Type.Pipe:
		case Type.BinaryOp:
			// assignments return invisible rhs
			return knownIdsOfChildren(node.info.id, node.lhs, node.rhs)
		case Type.UnaryOp:
			return knownIdsOfChildren(node.info.id, node.operand)
		case Type.Parameter:
			return node.defaultValue ? knownIdsOfChildren(node.info.id, node.defaultValue) : { knownIds: [], potentialIds: [] }
		case Type.Argument:
			return knownIdsOfChildren(node.info.id, node.value)
		case Type.Symbol:
		case Type.Logical:
		case Type.Number:
		case Type.String:
		case Type.Access:
			// just use this node
			break
			// contain noting to return/return `invisible(null)`
		case Type.Comment:
		case Type.LineDirective:
		case Type.Break:
		case Type.Next:
			return { knownIds: [], potentialIds: [] }
		default:
			assertUnreachable(type)
	}

	return {
		knownIds:     [],
		potentialIds: [ node.info.id ]
	}
}


// we use keepSelfAsPotential in order to track nodes like 2 + 3, which keep themselves as potential exit points if there are no knownIds
function knownIdsOfChildren<OtherInfo>(keepSelfAsPotential: NodeId, ...children: RNode<OtherInfo & ParentInformation>[]): ExitPointsInformation {
	const knownIds = children.flatMap(child => visitExitPoints(child).knownIds)
	return {
		knownIds,
		potentialIds: knownIds.length === 0 ? [ keepSelfAsPotential ] : []
	}
}
function visitLoops<OtherInfo>(loop: RLoopConstructs<OtherInfo & ParentInformation>): ExitPointsInformation {
	const result = visitExitPoints(loop.body)
	// conditions may contain return statements which we have to keep
	let otherKnownIds: NodeId[] = []
	if(loop.type === Type.ForLoop) {
		otherKnownIds = visitExitPoints(loop.variable).knownIds
		otherKnownIds.push(...visitExitPoints(loop.vector).knownIds)
	} else if(loop.type === Type.WhileLoop) {
		otherKnownIds = visitExitPoints(loop.condition).knownIds
	}
	return {
		knownIds:     [...result.knownIds, ...otherKnownIds],
		potentialIds: []
	}
}

function visitExpressionList<OtherInfo>(node: RExpressionList<OtherInfo & ParentInformation>): ExitPointsInformation {
	const known: NodeId[] = []
	let lastPotentialIds: NodeId[] = []

	// we only keep the potential ids of the last expression, which is no comment
	for(const child of node.children) {
		const { knownIds, potentialIds } = visitExitPoints(child)
		known.push(...knownIds)
		if(child.type !== Type.Comment) {
			lastPotentialIds = potentialIds
		}
	}

	return {
		knownIds:     known,
		potentialIds: lastPotentialIds
	}
}

function visitIf<OtherInfo>(node: RIfThenElse<OtherInfo & ParentInformation>): ExitPointsInformation {
	// conditions can contain return statements
	const known: NodeId[] = visitExitPoints(node.condition).knownIds
	const potential: NodeId[] = []

	const thenCase = visitExitPoints(node.then)
	known.push(...thenCase.knownIds)
	potential.push(...thenCase.potentialIds)

	if(node.otherwise !== undefined) {
		const otherwiseCase = visitExitPoints(node.otherwise)
		known.push(...otherwiseCase.knownIds)
		potential.push(...otherwiseCase.potentialIds)
	}

	return {
		knownIds:     known,
		potentialIds: potential
	}
}
