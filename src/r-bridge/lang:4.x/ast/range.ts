import { guard } from '../../../util/assert'

// xmlparsedata uses its own start and end only to break ties and calculates them on max col width approximation
interface SourcePosition {
  /** starts with 1 */
  line:   number
  /** starts with 1 */
  column: number
}

export interface SourceRange {
  /** inclusive start position */
  start: SourcePosition
  /** inclusive end position */
  end:   SourcePosition
}

// TODO: test
export function rangeFrom (line1: number | string, col1: number | string, line2: number | string, col2: number | string): SourceRange {
  // TODO: do we have to ensure ordering?
  return {
    start: {
      line:   Number(line1),
      column: Number(col1)
    },
    end: {
      line:   Number(line2),
      column: Number(col2)
    }
  }
}

// TODO: test more
export function mergeRanges (...rs: SourceRange[]): SourceRange {
  guard(rs.length > 0, 'Cannot merge no ranges')

  return {
    start: rs.reduce((acc, r) => acc.line < r.start.line || (acc.line === r.start.line && acc.column < r.start.column) ? acc : r.start, rs[0].start),
    end:   rs.reduce((acc, r) => acc.line > r.end.line || (acc.line === r.end.line && acc.column > r.end.column) ? acc : r.end, rs[0].end)
  }
}

/**
 * @returns \> 0 if r1 \> r2, \< 0 if r1 \< r2, 0 if r1 === r2
 */
// TODO: test
export function compareRanges (r1: SourceRange, r2: SourceRange): number {
  if (r1.start.line !== r2.start.line) {
    return r1.start.line - r2.start.line
  } else if (r1.start.column !== r2.start.column) {
    return r1.start.column - r2.start.column
  } else if (r1.end.line !== r2.end.line) {
    return r1.end.line - r2.end.line
  } else {
    return r1.end.column - r2.end.column
  }
}

// TODO: test
export function addRanges (r1: SourceRange, r2: SourceRange): SourceRange {
  return rangeFrom(r1.start.line + r2.start.line, r1.start.column + r2.start.column, r1.end.line + r2.end.line, r1.end.column + r2.end.column)
}
