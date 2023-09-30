import { Feature, FeatureProcessorInput } from '../feature'
import { appendStatisticsFile } from '../../output'
import { Writable } from 'ts-essentials'
import { RNodeWithParent, RType, visitAst } from '../../../r-bridge'


const initialLoopInfo = {
	forLoops:               0,
	whileLoops:             0,
	repeatLoops:            0,
	breakStatements:        0,
	nextStatements:         0,
	/** apply, tapply, lapply, ...*/
	implicitLoops:          0,
	nestedExplicitLoops:    0,
	deepestExplicitNesting: 0
}

export type LoopInfo = Writable<typeof initialLoopInfo>


const isImplicitLoop = /[lsvmt]?apply/

function visitForLoops(info: LoopInfo, input: FeatureProcessorInput): void {
	// holds number of loops and their nesting depths
	const loopStack: RNodeWithParent[] = []

	visitAst(input.normalizedRAst.ast,
		node => {
		  if(node.type === RType.Next) {
				info.nextStatements++
				return
			} else if(node.type === RType.Break) {
				info.breakStatements++
				return
			} else if(node.type === RType.FunctionCall) {
				if(node.flavor === 'named' && isImplicitLoop.test(node.functionName.lexeme)) {
					info.implicitLoops++
					appendStatisticsFile(loops.name, 'implicit-loop', [node.functionName.lexeme], input.filepath)
				}
				return
			} else if(node.type === RType.ForLoop) {
				info.forLoops++
			} else if(node.type === RType.WhileLoop) {
				info.whileLoops++
			} else if(node.type === RType.RepeatLoop) {
				info.repeatLoops++
			} else {
				return
			}
			if(loopStack.length > 0) {
				info.nestedExplicitLoops++
				appendStatisticsFile(loops.name, 'nested-loop', [node.lexeme], input.filepath)
				info.deepestExplicitNesting = Math.max(info.deepestExplicitNesting, loopStack.length)
			}

			loopStack.push(node)
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
		visitForLoops(existing, input)
		return existing
	},

	initialValue: initialLoopInfo
}
