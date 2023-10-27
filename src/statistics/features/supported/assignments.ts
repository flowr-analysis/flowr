import { Feature, FeatureProcessorInput, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { appendStatisticsFile } from '../../output'
import { Writable } from 'ts-essentials'


const initialAssignmentInfo = {
	assignmentOperator:               0,
	specialAssignmentOps:             0,
	nestedOperatorAssignment:         0,
	directlyNestedOperatorAssignment: 0
}

export type AssignmentInfo = Writable<typeof initialAssignmentInfo>


const defaultOperatorAssignmentQuery: Query = xpath.parse('//EQ_ASSIGN|//LEFT_ASSIGN|//RIGHT_ASSIGN')
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
	for(let i = 0; i < siblings.length; i++) {
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

	process(existing: AssignmentInfo, input: FeatureProcessorInput): AssignmentInfo {
		const assignmentOperators = defaultOperatorAssignmentQuery.select({ node: input.parsedRAst })
		const nestedOperators = nestedOperatorAssignmentQuery.select({ node: input.parsedRAst })
		const directlyNestedOperators = directlyNestedOperatorAssignmentQuery.select({ node: input.parsedRAst })
		const specialAssignmentOps = bracketAssignQuery.select({ node: input.parsedRAst }).map(enrichOpForBracketAssign)

		existing.nestedOperatorAssignment += nestedOperators.length
		existing.directlyNestedOperatorAssignment += directlyNestedOperators.length
		existing.assignmentOperator += assignmentOperators.length
		existing.specialAssignmentOps += specialAssignmentOps.length

		appendStatisticsFile(this.name, 'assignmentOperator', assignmentOperators, input.filepath)
		appendStatisticsFile(this.name, 'specialAssignmentOps', specialAssignmentOps, input.filepath)

		return existing
	},

	initialValue: initialAssignmentInfo
}