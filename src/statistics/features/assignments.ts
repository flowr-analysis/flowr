import { Feature, formatMap, Query } from '../feature'
import { MergeableRecord } from '../../util/objects'
import * as xpath from 'xpath-ts2'
import { groupCount } from '../../util/arrays'

export interface AssignmentInfo extends MergeableRecord {
  assignmentOperator:       string[]
  nestedOperatorAssignment: number
}

// TODO: integers, constants, etc.
export const initialAssignmentInfo = (): AssignmentInfo => ({
  assignmentOperator:       [],
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

export const assignments: Feature<AssignmentInfo> = {
  name:        'assignments',
  description: 'all ways to assign something in R',

  append(existing: AssignmentInfo, input: Document): AssignmentInfo {
    const assignmentOperators = defaultOperatorAssignmentQuery.select({ node: input }).map(n => n.textContent ?? '<unknown>')
    const nestedOperators = nestedOperatorAssignmentQuery.select({ node: input }).length

    existing.nestedOperatorAssignment += nestedOperators

    existing.assignmentOperator.push(...assignmentOperators)
    return existing
  },

  toString(data: AssignmentInfo, details: boolean): string {
    // TODO: separate between unique and total count
    return `---assignments-------------
\toperator assignments (${data.assignmentOperator.length} times)${formatMap(groupCount(data.assignmentOperator), details)}
\tnested operator assignments: ${data.nestedOperatorAssignment}
    `
  }
}
