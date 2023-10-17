import { Feature, FeatureProcessorInput } from '../feature'
import { Writable } from 'ts-essentials'
import { emptyCommonSyntaxTypeCounts, updateCommonSyntaxTypeCounts } from '../common-syntax-probability'
import { RNodeWithParent, RType, visitAst } from '../../../r-bridge'

const initialControlflowInfo = {
	ifThen:           emptyCommonSyntaxTypeCounts(),
	ifThenElse:       emptyCommonSyntaxTypeCounts(),
	/** can be nested with if-s or if-then-else's */
	nestedIfThen:     0,
	nestedIfThenElse: 0,
	deepestNesting:   0,
	/** switch(...) */
	switchCase:       emptyCommonSyntaxTypeCounts()
}

export type ControlflowInfo = Writable<typeof initialControlflowInfo>

// TODO: record numbers of nodes in normalized ast and unnormalized, just so we can say mining Xillions of ast nodes
function visitIfThenElse(info: ControlflowInfo, input: FeatureProcessorInput): void {
	const ifThenElseStack: RNodeWithParent[] = []

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type !== RType.IfThenElse) {
				if(node.type === RType.FunctionCall && node.flavor === 'named' && node.functionName.content === 'switch') {
					const initialArg = node.arguments[0]
					if(initialArg?.value) {
						info.switchCase = updateCommonSyntaxTypeCounts(info.switchCase, initialArg.value)
					}
				}
				return
			}
			const ifThenElse = node.otherwise !== undefined

			if(ifThenElseStack.length > 0) {
				if(ifThenElse) {
					info.nestedIfThenElse++
				} else {
					info.nestedIfThen++
				}
				info.deepestNesting = Math.max(info.deepestNesting, ifThenElseStack.length)
			}

			if(ifThenElse) {
				info.ifThenElse = updateCommonSyntaxTypeCounts(info.ifThenElse, node.condition)
			} else {
				info.ifThen = updateCommonSyntaxTypeCounts(info.ifThen, node.condition)
			}

		}, node => {
			// drop again :D
			if(node.type === RType.IfThenElse) {
				ifThenElseStack.pop()
			}
		}
	)
}


export const controlflow: Feature<ControlflowInfo> = {
	name:        'Controlflow',
	description: 'Deals with if-then-else and switch-case',

	process(existing: ControlflowInfo, input: FeatureProcessorInput): ControlflowInfo {
		visitIfThenElse(existing, input)
		return existing
	},
	initialValue: initialControlflowInfo
}
