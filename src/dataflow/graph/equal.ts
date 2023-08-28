import { environmentsEqual, equalIdentifierReferences, IdentifierReference } from '../environments'
import { NodeId } from '../../r-bridge'
import { FunctionArgument, OutgoingEdges, PositionalFunctionArgument } from './graph'
import { DataflowGraphVertices, dataflowLogger } from '../index'
import { guard } from '../../util/assert'
import { displayEnvReplacer } from '../../util/json'
import { setEquals } from '../../util/set'

function equalFunctionArgumentsReferences(a: IdentifierReference | '<value>', b: IdentifierReference | '<value>'): boolean {
	if(a === '<value>' || b === '<value>') {
		return a === b
	}
	return equalIdentifierReferences(a, b)
}

export function equalExitPoints(a: NodeId[] | undefined, b: NodeId[] | undefined): boolean {
	if(a === undefined || b === undefined) {
		return a === b
	}
	if(a.length !== b.length) {
		return false
	}
	for(let i = 0; i < a.length; ++i) {
		if(a[i] !== b[i]) {
			return false
		}
	}
	return true
}

export function equalFunctionArguments(a: false | FunctionArgument[], b: false | FunctionArgument[]): boolean {
	if(a === false || b === false) {
		return a === b
	}
	else if(a.length !== b.length) {
		return false
	}
	for(let i = 0; i < a.length; ++i) {
		const aArg = a[i]
		const bArg = b[i]
		if(Array.isArray(aArg) && Array.isArray(bArg)) {
			// must have same name
			if(aArg[0] !== bArg[0]) {
				return false
			}
			if(!equalFunctionArgumentsReferences(aArg[1], bArg[1])) {
				return false
			}
		} else if(!equalFunctionArgumentsReferences(aArg as PositionalFunctionArgument, bArg as PositionalFunctionArgument)) {
			return false
		}
	}
	return true
}


export function equalVertices(our: DataflowGraphVertices, other: DataflowGraphVertices): boolean {
	if(our.size !== other.size) {
		dataflowLogger.warn(`graph size does not match: ${our.size} vs ${other.size}`)
		return false
	}
	for(const [id, info] of our) {
		const otherInfo = other.get(id)
		if(otherInfo === undefined || info.tag !== otherInfo.tag || info.name !== otherInfo.name) {
			dataflowLogger.warn(`node ${id} does not match (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
			return false
		}

		if(info.tag === 'variable-definition' || info.tag === 'function-definition') {
			guard(info.tag === otherInfo.tag, () => `node ${id} does not match on tag (${info.tag} vs ${otherInfo.tag})`)
			if(info.scope !== otherInfo.scope) {
				dataflowLogger.warn(`node ${id} does not match on scope (${JSON.stringify(info.scope)} vs ${JSON.stringify(otherInfo.scope)})`)
				return false
			}
		}

		if(info.when !== otherInfo.when) {
			dataflowLogger.warn(`node ${id} does not match on when (${JSON.stringify(info.when)} vs ${JSON.stringify(otherInfo.when)})`)
			return false
		}

		if(!environmentsEqual(info.environment, otherInfo.environment)) {
			dataflowLogger.warn(`node ${id} does not match on environments (${JSON.stringify(info.environment)} vs ${JSON.stringify(otherInfo.environment)})`)
			return false
		}

		if(info.tag === 'function-call') {
			guard(otherInfo.tag === 'function-call', 'otherInfo must be a function call as well')
			if(!equalFunctionArguments(info.args, otherInfo.args)) {
				dataflowLogger.warn(`node ${id} does not match on function arguments (${JSON.stringify(info.args)} vs ${JSON.stringify(otherInfo.args)})`)
				return false
			}
		}

		if(info.tag === 'function-definition') {
			guard(otherInfo.tag === 'function-definition', 'otherInfo must be a function definition as well')

			if(!equalExitPoints(info.exitPoints, otherInfo.exitPoints)) {
				dataflowLogger.warn(`node ${id} does not match on exit points (${JSON.stringify(info.exitPoints)} vs ${JSON.stringify(otherInfo.exitPoints)})`)
				return false
			}

			if(info.subflow.scope !== otherInfo.subflow.scope || !environmentsEqual(info.subflow.environments, otherInfo.subflow.environments)) {
				dataflowLogger.warn(`node ${id} does not match on subflow (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
				return false
			}
			if(!setEquals(info.subflow.graph, otherInfo.subflow.graph)) {
				dataflowLogger.warn(`node ${id} does not match on subflow graph (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
				return false
			}
		}
	}
	return true
}




export function equalEdges(id: NodeId, our: OutgoingEdges | undefined, other: OutgoingEdges | undefined): boolean {
	if(our === undefined || other === undefined) {
		return our === other
	}

	if(our.size !== other.size) {
		dataflowLogger.warn(`total edge size for ${id} does not match: ${our.size} vs ${other.size} (${JSON.stringify(our, displayEnvReplacer)}, ${JSON.stringify(other, displayEnvReplacer)})`)
		return false
	}
	// order independent compare
	for(const [target, edge] of our) {
		const otherEdge = other.get(target)
		if(otherEdge === undefined || edge.types.size !== otherEdge.types.size || [...edge.types].some(e => !otherEdge.types.has(e)) || edge.attribute !== otherEdge.attribute) {
			dataflowLogger.warn(`edge with ${id}->${target} does not match (${JSON.stringify(edge, displayEnvReplacer)} vs ${JSON.stringify(otherEdge, displayEnvReplacer)})`)
			return false
		}
	}
	return true
}

