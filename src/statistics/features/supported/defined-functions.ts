import { Feature, FeatureProcessorInput, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { appendStatisticsFile, extractNodeContent } from '../../output'
import { Writable } from 'ts-essentials'
import { SourcePosition } from '../../../util/range'
import { MergeableRecord } from '../../../util/objects'
import { ParentInformation, RFunctionDefinition, RNodeWithParent, RType, visitAst } from '../../../r-bridge'
import { usedFunctions } from './used-functions'
import { EdgeType } from '../../../dataflow'
import { guard, isNotUndefined } from '../../../util/assert'

const initialFunctionDefinitionInfo = {
	/** all, anonymous, assigned, non-assigned, ... */
	total:             0,
	/** how many are really using OP-Lambda? */
	lambdasOnly:       0,
	/** using `<<-`, `<-`, `=`, `->` `->>` */
	assignedFunctions: 0,
	usedArgumentNames: 0,
	nestedFunctions:   0,
	/** functions that in some easily detectable way call themselves */
	recursive:         0,
	deepestNesting:    0
}

export type FunctionDefinitionInfo = Writable<typeof initialFunctionDefinitionInfo>


// note, that this can not work with assign, setGeneric and so on for now
const queryAnyFunctionDefinition: Query = xpath.parse('//FUNCTION')
const queryAnyLambdaDefinition: Query = xpath.parse('//OP-LAMBDA')

// we do not care on how these functions are defined
const queryAssignedFunctionDefinitions: Query = xpath.parse(`
  //LEFT_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //EQ_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //RIGHT_ASSIGN[preceding-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/following-sibling::expr[count(*)=1]/SYMBOL
`)

const queryUsedArgumentNames: Query = xpath.parse(`
  //FUNCTION/../SYMBOL_FORMALS
`)

// this is probably not completely correct
const defineFunctionsToBeCalled: Query = xpath.parse(`
  //expr/expr/*[self::FUNCTION or self::OP-LAMBDA]/parent::expr[preceding-sibling::OP-LEFT-PAREN or preceding-sibling::OP-LEFT-BRACE]/parent::expr[following-sibling::OP-LEFT-PAREN]
`)

const nestedFunctionsQuery: Query = xpath.parse(`
  //expr[preceding-sibling::FUNCTION or preceding-sibling::OP-LAMBDA]//*[self::FUNCTION or self::OP-LAMBDA]
`)


// expects to be invoked in the context of the parent function name
const functionCallWithNameQuery: Query = xpath.parse(`
  ../following-sibling::expr/*[last()]//SYMBOL_FUNCTION_CALL[text() = $name]
  |
  ../preceding-sibling::expr/*[last()]//SYMBOL_FUNCTION_CALL[text() = $name]
`)
function testRecursive(node: Node, name: string): boolean {
	const result = functionCallWithNameQuery.select({ node, variables: { name } })
	return result.length > 0

}


interface FunctionDefinitionInformation extends MergeableRecord {
	location:  SourcePosition,
	/** locations of all direct call sites */
	callsites: SourcePosition[],
	// for each return site, classifies if it is implicit or explicit (i.e., with return)
	returns:   { explicit: boolean, location: SourcePosition }[],
	length:   {
		lines:                   number,
		characters:              number,
		nonWhitespaceCharacters: number
	}
}


function retrieveAllCallsites(input: FeatureProcessorInput, node: RFunctionDefinition<ParentInformation>) {
	const dfStart = input.dataflow.graph.outgoingEdges(node.info.id)
	const callsites = []
	for(const [target, edge] of dfStart ?? []) {
		if(!edge.types.has(EdgeType.Calls)) {
			continue
		}
		const loc = input.normalizedRAst.idMap.get(target)?.location?.start
		if(loc) {
			callsites.push(loc)
		}
	}
	return callsites
}

function visitDefinitions(info: FunctionDefinitionInfo, input: FeatureProcessorInput): void {
	const definitionStack: RNodeWithParent[] = []
	const allDefinitions: FunctionDefinitionInformation[] = []

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type !== RType.FunctionDefinition) {
				return
			}

			const graph = input.dataflow.graph
			const dfNode = graph.get(node.info.id, true)
			guard(dfNode !== undefined, 'No dataflow node for a function definition')
			const [fnDefinition] = dfNode
			guard(fnDefinition.tag === 'function-definition', 'Dataflow node is not a function definition')

			const returnTypes = fnDefinition.exitPoints.map(ep => graph.get(ep, true)).filter(isNotUndefined)
				.map(([vertex]) => ({
					explicit: vertex.tag === 'exit-point',
					location: input.normalizedRAst.idMap.get(vertex.id)?.location?.start ?? { line: -1, column: -1 }
				}))

			definitionStack.push(node)
			allDefinitions.push({
				location:  node.location.start,
				callsites: retrieveAllCallsites(input, node),
				returns:   returnTypes,
				length:    {
					lines:                   node.location.end.line - node.location.start.line,
					characters:              node.location.end.column - node.location.start.column,
					nonWhitespaceCharacters: node.info.fullLexeme?.replaceAll(/\s/, '').length ?? 0
				}
			})
		}, node => {
			// drop again :D
			if(node.type === RType.FunctionDefinition) {
				definitionStack.pop()
			}
		}
	)

	info.total += allDefinitions.length
	appendStatisticsFile(usedFunctions.name, 'all-definitions', allDefinitions.map(s => JSON.stringify(s)), input.filepath)
}



export const definedFunctions: Feature<FunctionDefinitionInfo> = {
	name:        'Defined Functions',
	description: 'All functions defined within the document',

	process(existing: FunctionDefinitionInfo, input: FeatureProcessorInput): FunctionDefinitionInfo {
		const allFunctions = queryAnyFunctionDefinition.select({ node: input.parsedRAst }).length
		const allLambdas = queryAnyLambdaDefinition.select({ node: input.parsedRAst })

		appendStatisticsFile(this.name, 'allLambdas', allLambdas, input.filepath)

		existing.total += allFunctions + allLambdas.length
		existing.lambdasOnly += allLambdas.length

		const usedArgumentNames = queryUsedArgumentNames.select({ node: input.parsedRAst })
		existing.usedArgumentNames += usedArgumentNames.length
		appendStatisticsFile(this.name, 'usedArgumentNames', usedArgumentNames, input.filepath)

		existing.functionsDirectlyCalled += defineFunctionsToBeCalled.select({ node: input.parsedRAst }).length
		existing.nestedFunctions += nestedFunctionsQuery.select({ node: input.parsedRAst }).length

		const assignedFunctions = queryAssignedFunctionDefinitions.select({ node: input.parsedRAst })
		const assignedNames = assignedFunctions.map(extractNodeContent)
		existing.assignedFunctions += assignedFunctions.length
		appendStatisticsFile(this.name, 'assignedFunctions', assignedNames, input.filepath)

		const recursiveFunctions = []
		for(let i = 0; i < assignedFunctions.length; i++) {
			const name = assignedNames[i]
			if(testRecursive(assignedFunctions[i], name)) {
				recursiveFunctions.push(name)
			}
		}
		existing.recursive += recursiveFunctions.length
		appendStatisticsFile(this.name, 'recursiveFunctions', recursiveFunctions, input.filepath)

		return existing
	},
	initialValue: initialFunctionDefinitionInfo
}
