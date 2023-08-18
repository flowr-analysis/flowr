import { Feature, FeatureInfo, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { append } from '../../output'

export interface AssignmentInfo extends FeatureInfo {
	assignmentOperator:               number
	nestedOperatorAssignment:         number
	directlyNestedOperatorAssignment: number
	specialAssignmentOps:             number
}

// TODO: integers, constants, etc.
const initialAssignmentInfo = (): AssignmentInfo => ({
	assignmentOperator:               0,
	specialAssignmentOps:             0,
	nestedOperatorAssignment:         0,
	directlyNestedOperatorAssignment: 0
})

const defaultOperatorAssignmentQuery: Query = xpath.parse(`//EQ_ASSIGN|//LEFT_ASSIGN|//RIGHT_ASSIGN`)
// either <-/<<-/=, with a nested rhs, or ->/->> with a nested lhs
const nestedOperatorAssignmentQuery: Query = xpath.parse(`//*[
  (self::LEFT_ASSIGN or self::EQ_ASSIGN) and following-sibling::expr//*[self::LEFT_ASSIGN or self::EQ_ASSIGN or self::RIGHT_ASSIGN]
 ]
 |
 //RIGHT_ASSIGN[preceding-sibling::expr//*[self::LEFT_ASSIGN or self::EQ_ASSIGN or self::RIGHT_ASSIGN]]
`)

// the rhs must be an assignment directly
const directlyNestedOperatorAssignmentQuery: Query = xpath.parse(`//*[
  (self::LEFT_ASSIGN or self::EQ_ASSIGN) and following-sibling::expr/*[self::LEFT_ASSIGN or self::EQ_ASSIGN or self::RIGHT_ASSIGN]
 ]
 |
 //RIGHT_ASSIGN[preceding-sibling::expr/*[self::LEFT_ASSIGN or self::EQ_ASSIGN or self::RIGHT_ASSIGN]]
`)

// LBB for double '[[<-', OP-LEFT-BRACKET for '[<-', 'OP-DOLLAR' for '$<-', OP-AT for '@<-' (similar with EQ_ASSIGN, swapped for RIGHT_ASSIGN)
const bracketAssignQuery: Query = xpath.parse(`
  //expr/*[(self::LBB or self::OP-LEFT-BRACKET or self::OP-DOLLAR or self::OP-AT) 
        and (
          ../following-sibling::LEFT_ASSIGN or ../following-sibling::EQ_ASSIGN
          or
          ../preceding-sibling::RIGHT_ASSIGN
     )]
 `)

function enrichOpForBracketAssign(node: Node): string {
	let operator: string | null = null
	const siblings = node.parentNode?.parentNode?.childNodes
	if(siblings == null) {
		return `${node.textContent ?? '<unknown>'}??`
	}

	// next and previous sibling do not work to our liking (they are not entertained by the xpath-ts chain)
	for (let i = 0; i < siblings.length; i++) {
		const child = siblings.item(i)
		if(child.nodeName === 'LEFT_ASSIGN' || child.nodeName === 'EQ_ASSIGN' || child.nodeName === 'RIGHT_ASSIGN') {
			operator = child.textContent
			break
		}
	}

	return `${node.textContent ?? '<unknown>'}${operator ?? '??'}`
}

export const assignments: Feature<AssignmentInfo> = {
	name:        'Assignments',
	description: 'all ways to assign something in R',

	process(existing: AssignmentInfo, input: Document, filepath: string | undefined): AssignmentInfo {
		const assignmentOperators = defaultOperatorAssignmentQuery.select({ node: input })
		const nestedOperators = nestedOperatorAssignmentQuery.select({ node: input })
		const directlyNestedOperators = directlyNestedOperatorAssignmentQuery.select({ node: input })
		const specialAssignmentOps = bracketAssignQuery.select({ node: input }).map(enrichOpForBracketAssign)

		existing.nestedOperatorAssignment += nestedOperators.length
		existing.directlyNestedOperatorAssignment += directlyNestedOperators.length
		existing.assignmentOperator += assignmentOperators.length
		existing.specialAssignmentOps += specialAssignmentOps.length

		append(this.name, 'assignmentOperator', assignmentOperators, filepath)
		append(this.name, 'specialAssignmentOps', specialAssignmentOps, filepath)

		return existing
	},

	initialValue: initialAssignmentInfo
}
