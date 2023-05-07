import { Feature, Query } from '../feature'
import { MergeableRecord } from '../../util/objects'
import * as xpath from 'xpath-ts2'
import { append } from '../statisticsFile'

export interface AssignmentInfo extends MergeableRecord {
  assignmentOperator:       number
  nestedOperatorAssignment: number
  specialAssignmentOps:     number
}

// TODO: integers, constants, etc.
export const initialAssignmentInfo = (): AssignmentInfo => ({
  assignmentOperator:       0,
  specialAssignmentOps:     0,
  nestedOperatorAssignment: 0
})

const defaultOperatorAssignmentQuery: Query = xpath.parse(`//EQ_ASSIGN|//LEFT_ASSIGN|//RIGHT_ASSIGN`)
// either <-/<<-/=, with a nested rhs, or ->/->> with a nested lhs
const nestedOperatorAssignmentQuery: Query = xpath.parse(`//*[
  (self::LEFT_ASSIGN or self::EQ_ASSIGN) and following-sibling::expr//*[self::LEFT_ASSIGN or self::EQ_ASSIGN or self::RIGHT_ASSIGN]
 ]
 |
 //RIGHT_ASSIGN[preceding-sibling::expr//*[self::LEFT_ASSIGN or self::EQ_ASSIGN or self::RIGHT_ASSIGN]]
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
  let op: string | null = null
  const siblings = node.parentNode?.parentNode?.childNodes
  if(siblings == null) {
    return `${node.textContent ?? '<unknown>'}??`
  }

  // next and previous sibling do not work to our liking (they are not entertained by the xpath-ts chain)
  for (let i = 0; i < siblings.length; i++) {
    const child = siblings.item(i)
    if(child.nodeName === 'LEFT_ASSIGN' || child.nodeName === 'EQ_ASSIGN' || child.nodeName === 'RIGHT_ASSIGN') {
      op = child.textContent
      break
    }
  }

  return `${node.textContent ?? '<unknown>'}${op ?? '??'}`
}

export const assignments: Feature<AssignmentInfo> = {
  name:        'Assignments',
  description: 'all ways to assign something in R',

  append(existing: AssignmentInfo, input: Document): AssignmentInfo {
    const assignmentOperators = defaultOperatorAssignmentQuery.select({ node: input })
    const nestedOperators = nestedOperatorAssignmentQuery.select({ node: input })
    const specialAssignmentOps = bracketAssignQuery.select({ node: input }).map(enrichOpForBracketAssign)

    existing.nestedOperatorAssignment += nestedOperators.length
    existing.assignmentOperator += assignmentOperators.length
    existing.specialAssignmentOps += specialAssignmentOps.length

    append(this.name, 'assignmentOperator', assignmentOperators)
    append(this.name, 'specialAssignmentOps', specialAssignmentOps)

    return existing
  },

  toString(data: AssignmentInfo): string {
    // TODO: separate between unique and total count
    return `---assignments-------------
\toperator assignments:        ${data.assignmentOperator}
\tnested operator assignments: ${data.nestedOperatorAssignment}
\tspecial assignments:         ${data.specialAssignmentOps}
    `
  }
}
