import { Feature, FeatureInfo, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { append } from '../../output/statisticsFile'

export interface LoopInfo extends FeatureInfo {
  forLoops:        number
  whileLoops:      number
  repeatLoops:     number
  breakStatements: number
  nextStatements:  number
}

export const initialLoopInfo = (): LoopInfo => ({
  forLoops:        0,
  whileLoops:      0,
  repeatLoops:     0,
  breakStatements: 0,
  nextStatements:  0,
  /** apply, tapply, lapply, ...*/
  implicitLoops:   0
})


const forLoopQuery: Query = xpath.parse(`//FOR`)
const whileLoopQuery: Query = xpath.parse(`//WHILE`)
const repeatLoopQuery: Query = xpath.parse(`//REPEAT`)
const breakStatementQuery: Query = xpath.parse(`//BREAK`)
const nextStatementQuery: Query = xpath.parse(`//NEXT`)
const implicitLoopQuery: Query = xpath.parse(`//SYMBOL_FUNCTION_CALL[
     text() = 'apply' 
  or text() = 'lapply' 
  or text() = 'sapply' 
  or text() = 'tapply' 
  or text() = 'mapply' 
  or text() = 'vapply'
]`)

export const loops: Feature<LoopInfo> = {
  name:        'Loops',
  description: 'All looping structures in the document',

  process(existing: LoopInfo, input: Document, filepath: string | undefined): LoopInfo {
    const forLoops = forLoopQuery.select({ node: input })
    const whileLoops = whileLoopQuery.select({ node: input })
    const repeatLoops = repeatLoopQuery.select({ node: input })
    const breakStatements = breakStatementQuery.select({ node: input })
    const nextStatements = nextStatementQuery.select({ node: input })
    const implicitLoops = implicitLoopQuery.select({ node: input })

    existing.forLoops += forLoops.length
    existing.whileLoops += whileLoops.length
    existing.repeatLoops += repeatLoops.length
    existing.breakStatements += breakStatements.length
    existing.nextStatements += nextStatements.length
    existing.implicitLoops += implicitLoops.length
    append(this.name, 'implicit-loops', implicitLoops, filepath)
    return existing
  }
}
