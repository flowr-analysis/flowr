import {guard} from '../../../util/assert'
import {BinOpOperators} from './binop'
import {addDomains, Domain, narrowDomain, NarrowKind, subtractDomains} from '../../domain'
import {AINode, AINodeStore} from '../../ainode'

export const operators: BinOpOperators = {
	'assignment': (_, rhs, node) => {
		return AINodeStore.from(new AINode(rhs.domain, node.lhs, node.info.id))
	},
	'arithmetic': (lhs, rhs, node) => {
		switch(node.operator) {
			case '+':
				return AINodeStore.from(new AINode(addDomains(lhs.domain, rhs.domain), node))
			case '-':
				return AINodeStore.from(new AINode(subtractDomains(lhs.domain, rhs.domain), node))
			default:
				guard(false, `Unknown binary operator ${node.operator}`)
		}
	},
	'logical': () => {
		guard(false, 'Not implemented yet')
	},
	'model formula': () => {
		guard(false, 'Not implemented yet')
	},
	'comparison': (lhs, rhs, node) => {
		let narrowKind: NarrowKind
		switch(node.operator) {
			case '<': narrowKind = NarrowKind.Smaller; break
			case '>': narrowKind = NarrowKind.Greater; break
			case '<=': narrowKind = NarrowKind.Smaller | NarrowKind.Equal; break
			case '>=': narrowKind = NarrowKind.Greater | NarrowKind.Equal; break
			default: guard(false, `Unknown binary operator ${node.operator}`)
		}
		const calculateDomains = (lhs: AINode, rhs: AINode, narrowKind: NarrowKind, idSuffix = ''): AINode[] => {
			const lhsNarrowed = narrowDomain(lhs.domain, rhs.domain, narrowKind)
			const rhsNarrowed = narrowDomain(rhs.domain, lhs.domain, narrowKind ^ 0b110 /* flip < and > but not = */)
			return [{
				nodeId:       node.info.id + idSuffix,
				expressionId: node.info.id,
				domain:       lhsNarrowed.isBottom() && rhsNarrowed.isBottom() ? Domain.bottom() : Domain.top(),
				astNode:      node,
			},
			{
				nodeId:       lhs.nodeId + idSuffix,
				expressionId: node.info.id,
				domain:       lhsNarrowed,
				astNode:      node,
			}, {
				nodeId:       rhs.nodeId + idSuffix,
				expressionId: node.info.id,
				domain:       rhsNarrowed,
				astNode:      node,
			}]
		}
		const thenDomains = calculateDomains(lhs, rhs, narrowKind)
		const elseDomains = calculateDomains(lhs, rhs, narrowKind ^ 0b111 /* flip everything */, '-else')
		return AINodeStore.from(thenDomains.concat(elseDomains))
	}
}
