import { Feature, FeatureInfo, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { append, extractNodeContent } from '../../output'

export interface DataAccess extends FeatureInfo {
  singleBracket:               number
  singleBracketEmpty:          number
  singleBracketConstant:       number
  singleBracketSingleVariable: number
  singleBracketCommaAccess:    number
  doubleBracket:               number
  doubleBracketEmpty:          number
  doubleBracketConstant:       number
  doubleBracketSingleVariable: number
  doubleBracketCommaAccess:    number
  chainedOrNestedAccess:       number
  byName:                      number
  bySlot:                      number
}
// TODO: single bracket comma access

const initialDataAccessInfo = (): DataAccess => ({
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
	byName:                      0,
	bySlot:                      0
})

const singleBracketAccess: Query = xpath.parse(`//expr/SYMBOL/../../*[preceding-sibling::OP-LEFT-BRACKET][1]`)
const doubleBracketAccess: Query = xpath.parse(`//expr/SYMBOL/../../*[preceding-sibling::LBB][1]`)
const namedAccess: Query = xpath.parse(`//expr/SYMBOL/../../*[preceding-sibling::OP-DOLLAR][1]`)
const slottedAccess: Query = xpath.parse(`//expr/SYMBOL/../../*[preceding-sibling::OP-AT][1]`)
const chainedOrNestedAccess: Query = xpath.parse(`
//*[following-sibling::OP-LEFT-BRACKET or following-sibling::LBB or following-sibling::OP-DOLLAR or following-sibling::OP-AT]//
    *[self::OP-LEFT-BRACKET or self::LBB or self::OP-DOLLAR or self::OP-AT][1]
`)

// TODO: merge with if queries etc?
const constantAccess: Query = xpath.parse(`
  ./NUM_CONST
  |
  ./NULL_CONST
  |
  ./STR_CONST
  |
  ./SYMBOL[text() = 'T' or text() = 'F']`)
const singleVariableAccess: Query = xpath.parse(`./SYMBOL[text() != 'T' and text() != 'F']`)
const commaAccess: Query = xpath.parse(`../OP-COMMA`)

function processForBracketAccess(existing: DataAccess, nodes: Node[], access: 'singleBracket' | 'doubleBracket', filepath: string | undefined) {
// we use the parent node to get more information in the output if applicable
	append(dataAccess.name, access, nodes.map(n => n.parentNode ?? n), filepath)

	existing[access] += nodes.length
	const constantAccesses = nodes.flatMap(n => constantAccess.select({ node: n }))
	const singleVariableAccesses = nodes.flatMap(n => singleVariableAccess.select({ node: n }))

	existing[`${access}Empty`] += nodes.map(extractNodeContent).filter(n => n === ']').length
	existing[`${access}Constant`] += constantAccesses.length
	existing[`${access}SingleVariable`] += singleVariableAccesses.length

	const commaAccesses = nodes.flatMap(n => commaAccess.select({ node: n }))
	existing[`${access}CommaAccess`] += commaAccesses.length
}


export const dataAccess: Feature<DataAccess> = {
	name:        'Data Access',
	description: 'Ways of accessing data structures in R',

	process(existing: DataAccess, input: Document, filepath: string | undefined): DataAccess {
		const singleBracketAccesses = singleBracketAccess.select({ node: input })
		const doubleBracketAccesses = doubleBracketAccess.select({ node: input })

		processForBracketAccess(existing, singleBracketAccesses, 'singleBracket', filepath)
		processForBracketAccess(existing, doubleBracketAccesses, 'doubleBracket', filepath)

		const namedAccesses = namedAccess.select({ node: input })
		append(dataAccess.name, 'byName', namedAccesses.map(n => n.parentNode ?? n), filepath)
		existing.byName += namedAccesses.length

		const slottedAccesses = slottedAccess.select({ node: input })
		append(dataAccess.name, 'bySlot', slottedAccesses.map(n => n.parentNode ?? n), filepath)
		existing.bySlot += slottedAccesses.length


		const chainedOrNestedAccesses = chainedOrNestedAccess.select({ node: input })
		append(dataAccess.name, 'chainedOrNestedAccess', chainedOrNestedAccesses.map(n => n.parentNode ?? n), filepath)
		existing.chainedOrNestedAccess += chainedOrNestedAccesses.length

		return existing
	},
	initialValue: initialDataAccessInfo
}
