import { Writable } from 'ts-essentials'
import { Feature, FeatureProcessorInput } from '../feature'
import { RType, visitAst } from '../../../r-bridge'

// TODO: average etc measurements?
const initialExpressionListInfo = {
	allExpressionLists: 0,
	deepestNesting:     0
}
export type ExpressionList = Writable<typeof initialExpressionListInfo>

function visitLists(info: ExpressionList, input: FeatureProcessorInput): void {
	let nest = -1 // we start with nesting 0
	let total = 0

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type === RType.ExpressionList) {
				nest++
				total++
				info.deepestNesting = Math.max(info.deepestNesting, nest)
			}
		}, node => {
			if(node.type === RType.ExpressionList) {
				nest--
			}
		}
	)

	info.allExpressionLists += total
}

export const expressionList: Feature<ExpressionList> = {
	name:        'Expression Lists',
	description: 'Counts expression list nestings',

	process(existing: ExpressionList, input: FeatureProcessorInput): ExpressionList {
		visitLists(existing, input)
		return existing
	},

	initialValue: initialExpressionListInfo
}
