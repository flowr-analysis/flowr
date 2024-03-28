import {guard} from '../../../util/assert'
import {BinOpOperators} from './binop'
import {NarrowKind, addDomains, narrowDomain, subtractDomains} from '../../domain'
import { AINodeStore } from '../../ainode'

export const operators: BinOpOperators = {
	'assignment': (lhs, rhs, node) => {
		return new AINodeStore({
			nodeId:       lhs.nodeId,
			expressionId: node.info.id,
			domain:       rhs.domain,
			astNode:      node.lhs,
		})
	},
	'arithmetic': (lhs, rhs, node) => {
		switch(node.operator) {
			case '+':
				return new AINodeStore({
					nodeId:       node.info.id,
					expressionId: node.info.id,
					domain:       addDomains(lhs.domain, rhs.domain),
					astNode:      node,
				})
			case '-':
				return new AINodeStore({
					nodeId:       node.info.id,
					expressionId: node.info.id,
					domain:       subtractDomains(lhs.domain, rhs.domain),
					astNode:      node,
				})
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
		let lhsNarrowedDomain
		let rhsNarrowedDomain
		switch(node.operator) {
			case '<':
				lhsNarrowedDomain = narrowDomain(lhs.domain, rhs.domain, NarrowKind.Smaller)
				rhsNarrowedDomain = narrowDomain(rhs.domain, lhs.domain, NarrowKind.Greater)
				break
			case '>':
				lhsNarrowedDomain = narrowDomain(lhs.domain, rhs.domain, NarrowKind.Greater)
				rhsNarrowedDomain = narrowDomain(rhs.domain, lhs.domain, NarrowKind.Smaller)
				break
			case '<=':
				lhsNarrowedDomain = narrowDomain(lhs.domain, rhs.domain, NarrowKind.Smaller | NarrowKind.Equal)
				rhsNarrowedDomain = narrowDomain(rhs.domain, lhs.domain, NarrowKind.Greater | NarrowKind.Equal)
				break
			case '>=':
				lhsNarrowedDomain = narrowDomain(lhs.domain, rhs.domain, NarrowKind.Greater | NarrowKind.Equal)
				rhsNarrowedDomain = narrowDomain(rhs.domain, lhs.domain, NarrowKind.Smaller | NarrowKind.Equal)
				break
			default:
				guard(false, `Unknown binary operator ${node.operator}`)
		}
		return new AINodeStore([{
			nodeId:       lhs.nodeId,
			expressionId: node.info.id,
			domain:       lhsNarrowedDomain,
			astNode:      node,
		}, {
			nodeId:       rhs.nodeId,
			expressionId: node.info.id,
			domain:       rhsNarrowedDomain,
			astNode:      node,
		}])
	}
}
