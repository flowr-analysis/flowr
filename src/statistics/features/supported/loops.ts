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

function visitLoops(info: LoopInfo, input: FeatureProcessorInput): void {
	// holds number of loops and their nesting depths
	const loopStack: RNodeWithParent[] = []

	visitAst(input.normalizedRAst.ast,
		node => {
			switch(node.type) {
				case RType.Next:         info.nextStatements++; return
				case RType.Break:        info.breakStatements++; return
				case RType.FunctionCall:
					if(node.flavor === 'named' && isImplicitLoop.test(node.functionName.lexeme)) {
						info.implicitLoops++
						appendStatisticsFile(loops.name, 'implicit-loop', [node.functionName.info.fullLexeme ?? node.functionName.lexeme], input.filepath)
					}
					return
				case RType.ForLoop:    info.forLoops++; break
				case RType.WhileLoop:  info.whileLoops++; break
				case RType.RepeatLoop: info.repeatLoops++; break
				default: return
			}

			appendStatisticsFile(loops.name, 'all-loops', [node.info.fullLexeme ?? node.lexeme], input.filepath)
			if(loopStack.length > 0) {
				info.nestedExplicitLoops++
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
		visitLoops(existing, input)
		return existing
	},

	initialValue: initialLoopInfo
}
