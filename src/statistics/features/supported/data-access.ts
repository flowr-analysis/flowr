import { Feature, FeatureProcessorInput } from '../feature'
import { Writable } from 'ts-essentials'
import { NodeId, RNodeWithParent, RType, visitAst, RoleInParent, rolesOfParents } from '../../../r-bridge'
import { assertUnreachable, guard } from '../../../util/assert'
import { appendStatisticsFile } from '../../output'

const initialDataAccessInfo = {
	singleBracket:               0,
	singleBracketEmpty:          0,
	singleBracketConstant:       0,
	singleBracketSingleVariable: 0,
	singleBracketCommaAccess:    0,
	doubleBracket:               0,
	doubleBracketEmpty:          0,
	doubleBracketConstant:       0,
	doubleBracketSingleVariable: 0,
	doubleBracketCommaAccess:    0,
	chainedOrNestedAccess:       0,
	longestChain:                0,
	deepestNesting:              0,
	namedArguments:              0,
	byName:                      0,
	bySlot:                      0
}

export type DataAccessInfo = Writable<typeof initialDataAccessInfo>

const constantSymbolContent = /(NULL|NA|T|F)/

function visitAccess(info: DataAccessInfo, input: FeatureProcessorInput): void {
	const accessNest: RNodeWithParent[] = []
	const accessChain: RNodeWithParent[] = []
	const parentRoleCache = new Map<NodeId, { acc: boolean, idxAcc: boolean }>()

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type !== RType.Access) {
				return
			}

			const roles = rolesOfParents(node, input.normalizedRAst.idMap)

			let acc = false
			let idxAcc = false
			for(const role of roles) {
				if(role === RoleInParent.Accessed) {
					acc = true
					break // we only account for the first one
				} else if(role === RoleInParent.IndexAccess) {
					idxAcc = true
					break
				}
			}

			// here we have to check after the addition as we can only check the parental context
			if(acc) {
				accessChain.push(node)
				info.chainedOrNestedAccess++
				info.longestChain = Math.max(info.longestChain, accessChain.length)
			} else if(idxAcc) {
				accessNest.push(node)
				info.chainedOrNestedAccess++
				info.deepestNesting = Math.max(info.deepestNesting, accessNest.length)
			}
			parentRoleCache.set(node.info.id, { acc, idxAcc })


			if(accessNest.length === 0 && accessChain.length === 0) { // store topmost, after add as it must not be a child to do that
				appendStatisticsFile(dataAccess.name, 'dataAccess', [node.info.fullLexeme ?? node.lexeme], input.filepath)
			}

			const op = node.operator
			switch(op) {
				case '@': info.bySlot++;         return
				case '$': info.byName++;         return
				case '[': info.singleBracket++;  break
				case '[[': info.doubleBracket++; break
				default: assertUnreachable(op)
			}

			guard(Array.isArray(node.access), '[ and [[ must provide access as array')
			const prefix = op === '[' ? 'single' : 'double'
			if(node.access.length === 0) {
				info[`${prefix}BracketEmpty`]++
				return
			} else if(node.access.length > 1) {
				info[`${prefix}BracketCommaAccess`]++
			}

			for(const access of node.access) {
				if(access === null) {
					info[`${prefix}BracketEmpty`]++
					continue
				}
				const argContent = access.value

				if(access.name !== undefined) {
					info.namedArguments++
				}

				if(argContent.type === RType.Number || argContent.type === RType.String ||
					(argContent.type === RType.Symbol && constantSymbolContent.test(argContent.content))
				) {
					info[`${prefix}BracketConstant`]++
				} else if(argContent.type === RType.Symbol) {
					info[`${prefix}BracketSingleVariable`]++
				}
			}
		}, node => {
			// drop again :D
			if(node.type === RType.Access) {
				const ctx = parentRoleCache.get(node.info.id)
				if(ctx?.acc) {
					accessChain.pop()
				} else if(ctx?.idxAcc) {
					accessNest.pop()
				}

			}
		}
	)
}

export const dataAccess: Feature<DataAccessInfo> = {
	name:        'Data Access',
	description: 'Ways of accessing data structures in R',

	process(existing: DataAccessInfo, input: FeatureProcessorInput): DataAccessInfo {
		visitAccess(existing, input)
		return existing
	},
	initialValue: initialDataAccessInfo
}
