import { Feature, FeatureProcessorInput } from '../feature'
import { appendStatisticsFile } from '../../output'
import { Writable } from 'ts-essentials'
import { SourcePosition } from '../../../util/range'
import { MergeableRecord } from '../../../util/objects'
import { ParentInformation, RFunctionDefinition, RNodeWithParent, RType, visitAst } from '../../../r-bridge'
import { EdgeType } from '../../../dataflow'
import { guard, isNotUndefined } from '../../../util/assert'

const initialFunctionDefinitionInfo = {
	/** all, anonymous, assigned, non-assigned, ... */
	total:             0,
	/** how many are really using OP-Lambda? */
	lambdasOnly:       0,
	/** using `<<-`, `<-`, `=`, `->` `->>` */
	// TODO: assign functions etc. -> implement
	assignedFunctions: 0,
	nestedFunctions:   0,
	/** functions that in some easily detectable way call themselves */
	recursive:         0,
	deepestNesting:    0
}

export type FunctionDefinitionInfo = Writable<typeof initialFunctionDefinitionInfo>

interface FunctionDefinitionInformation extends MergeableRecord {
	location:           SourcePosition,
	/** locations of all direct call sites */
	callsites:          SourcePosition[],
	numberOfParameters: number,
	// for each return site, classifies if it is implicit or explicit (i.e., with return)
	returns:            { explicit: boolean, location: SourcePosition }[],
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
					explicit: vertex.tag === 'function-call' && vertex.name === 'return',
					location: input.normalizedRAst.idMap.get(vertex.id)?.location?.start ?? { line: -1, column: -1 }
				}))

			if(definitionStack.length > 0) {
				info.nestedFunctions++
				info.deepestNesting = Math.max(info.deepestNesting, definitionStack.length)
				appendStatisticsFile(definedFunctions.name, 'nested-definitions', [node.info.fullLexeme ?? node.lexeme], input.filepath)
			}

			// parameter names:
			const parameterNames = node.parameters.map(p => p.info.fullLexeme ?? p.lexeme)
			appendStatisticsFile(definedFunctions.name, 'usedParameterNames', parameterNames, input.filepath)

			const isLambda = node.lexeme.startsWith('\\')
			if(isLambda) {
				info.lambdasOnly++
				appendStatisticsFile(definedFunctions.name, 'allLambdas', [node.info.fullLexeme ?? node.lexeme], input.filepath)
			}

			definitionStack.push(node)

			// we find definitions with silly defined-by edges
			// TODO: invert, must be an incoming edge!
			const edges = input.dataflow.graph.outgoingEdges(node.info.id)
			if(edges !== undefined) {
				for(const [targetId, edge] of edges) {
					if(edge.types.has(EdgeType.DefinedBy)) {
						const target = input.normalizedRAst.idMap.get(targetId)
						guard(target !== undefined, 'Dataflow edge points to unknown node')
						const name = target.info.fullLexeme ?? target.lexeme
						info.assignedFunctions++
						appendStatisticsFile(definedFunctions.name, 'assignedFunctions', [name ?? '<unknown>'], input.filepath)
						break
					}
				}
			}

			/* TODO:
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
	 */

			const lexeme = node.info.fullLexeme
			const lexemeSplit= lexeme?.split('\n')

			allDefinitions.push({
				location:           node.location.start,
				callsites:          retrieveAllCallsites(input, node),
				numberOfParameters: node.parameters.length,
				returns:            returnTypes,
				length:             {
					lines:                   lexemeSplit?.length ?? -1,
					characters:              lexeme?.length ?? -1,
					nonWhitespaceCharacters: lexeme?.replaceAll(/\s/g, '').length ?? 0
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
	appendStatisticsFile(definedFunctions.name, 'all-definitions', allDefinitions.map(s => JSON.stringify(s)), input.filepath)
}



export const definedFunctions: Feature<FunctionDefinitionInfo> = {
	name:        'Defined Functions',
	description: 'All functions defined within the document',

	process(existing: FunctionDefinitionInfo, input: FeatureProcessorInput): FunctionDefinitionInfo {
		visitDefinitions(existing, input)
		return existing
	},
	initialValue: initialFunctionDefinitionInfo
}
