import { Feature, formatMap, Query } from '../feature'
import { MergeableRecord } from '../../util/objects'
import * as xpath from 'xpath-ts2'
import { groupCount } from '../../util/arrays'
import { RNumHexFloatRegex } from '../../r-bridge/lang:4.x/values'

export interface AssignmentInfo extends MergeableRecord {
  assignmentOperator: string[]
}

// TODO: integers, constants, etc.
export const initialAssignmentInfo = (): AssignmentInfo => ({
  assignmentOperator: []
})

const defaultOperatorAssignmentQuery: Query = xpath.parse(`//EQ_ASSIGN|//LEFT_ASSIGN|//RIGHT_ASSIGN`)


export const assignments: Feature<AssignmentInfo> = {
  name:        'assignments',
  description: 'all ways to assign something in R',

  append(existing: AssignmentInfo, input: Document): AssignmentInfo {
    const assignmentOperators = defaultOperatorAssignmentQuery.select({ node: input }).map(n => n.textContent ?? '<unknown>')
    existing.assignmentOperator.push(...assignmentOperators)
    return existing
  },

  toString(data: AssignmentInfo, details: boolean): string {
    // TODO: separate between unique and total count
    return `---assignments-------------
\toperator assignments (${data.assignmentOperator.length} times)${formatMap(groupCount(data.assignmentOperator), details)}
    `
  }
}
