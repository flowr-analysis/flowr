import { Feature, FeatureProcessorInput, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { appendStatisticsFile } from '../../output'
import { Writable } from 'ts-essentials'
import { RNodeWithParent, RType, visitAst } from '../../../r-bridge'


const initialLoopInfo = {
	forLoops:        0,
	whileLoops:      0,
	repeatLoops:     0,
	breakStatements: 0,
	nextStatements:  0,
	/** apply, tapply, lapply, ...*/
	implicitLoops:   0,
	nestedLoops:     0,
	deepestNesting:  0
}

export type LoopInfo = Writable<typeof initialLoopInfo>

const implicitLoopQuery: Query = xpath.parse(`//SYMBOL_FUNCTION_CALL[
     text() = 'apply' 
  or text() = 'lapply' 
  or text() = 'sapply' 
  or text() = 'tapply' 
  or text() = 'mapply' 
  or text() = 'vapply'
]`)

function visitForLoops(info: LoopInfo, input: FeatureProcessorInput): void {
	// holds number of loops and their nesting depths
	const loopStack: RNodeWithParent[] = []

	visitAst(input.normalizedRAst.ast,
		node => {
		  if(node.type === RType.Next) {
				info.nextStatements++
				return false
			} else if(node.type === RType.Break) {
				info.breakStatements++
				return false
			} else if(node.type === RType.ForLoop) {
				info.forLoops++
			} else if(node.type === RType.WhileLoop) {
				info.whileLoops++
			} else if(node.type === RType.RepeatLoop) {
				info.repeatLoops++
			} else {
				return false
			}
			if(loopStack.length > 0) {
				info.nestedLoops++
				appendStatisticsFile(loops.name, 'nested-loop', [node.lexeme], input.filepath)
				info.deepestNesting = Math.max(info.deepestNesting, loopStack.length)
			}

			loopStack.push(node)
			return false
		}, node => {
			// drop again :D
			if(node.type === RType.ForLoop || node.type === RType.WhileLoop || node.type === RType.RepeatLoop) {
				loopStack.pop()
			}
		}
	)
}


export const loops: Feature<LoopInfo> = {
	name:        'Loops',
	description: 'All looping structures in the document',

	process(existing: LoopInfo, input: FeatureProcessorInput): LoopInfo {
		const implicitLoops = implicitLoopQuery.select({ node: input.parsedRAst })
		existing.implicitLoops += implicitLoops.length

		visitForLoops(existing, input)

		appendStatisticsFile(this.name, 'implicit-loops', implicitLoops, input.filepath)
		return existing
	},

	initialValue: initialLoopInfo
}
