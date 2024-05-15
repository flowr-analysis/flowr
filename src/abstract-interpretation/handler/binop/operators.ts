import {guard} from '../../../util/assert'
import {BinOpOperators} from './binop'
import {addDomains, narrowDomain, NarrowKind, subtractDomains} from '../../domain'
import {AINodeStore} from '../../ainode'

export const operators: BinOpOperators = {
	'assignment': (lhs, rhs, node) => {
		return AINodeStore.from({
			nodeId:       lhs.nodeId,
			expressionId: node.info.id,
			domain:       rhs.domain,
			astNode:      node.lhs,
		})
	},
	'arithmetic': (lhs, rhs, node) => {
		switch(node.operator) {
			case '+':
				return AINodeStore.from({
					nodeId:       node.info.id,
					expressionId: node.info.id,
					domain:       addDomains(lhs.domain, rhs.domain),
					astNode:      node,
				})
			case '-':
				return AINodeStore.from({
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
		let narrowKind: NarrowKind
		switch(node.operator) {
			case '<': narrowKind = NarrowKind.Smaller; break
			case '>': narrowKind = NarrowKind.Greater; break
			case '<=': narrowKind = NarrowKind.Smaller | NarrowKind.Equal; break
			case '>=': narrowKind = NarrowKind.Greater | NarrowKind.Equal; break
			default: guard(false, `Unknown binary operator ${node.operator}`)
		}
		// FIXME: We should not set the domain of the operands!
		//        But if we would only set the domain of the whole expression, we could only narrow one operand.
		return AINodeStore.from([{
			nodeId:       lhs.nodeId,
			expressionId: node.info.id,
			domain:       narrowDomain(lhs.domain, rhs.domain, narrowKind),
			astNode:      node,
		}, {
			nodeId:       rhs.nodeId,
			expressionId: node.info.id,
			domain:       narrowDomain(rhs.domain, lhs.domain, narrowKind ^ 0b110 /* flip < and > but leave = */),
			astNode:      node,
		}])
	}
}
