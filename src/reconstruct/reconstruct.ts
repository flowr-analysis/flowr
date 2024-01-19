/**
 * This module has one goal (and is to be rewritten soon to achieve that goal,
 * as the file itself is way too long). See {@link reconstructToCode}.
 * @module
 */

//imports {note: as of current, do not change}
import {
	ParentInformation,
	RAccess,
	RArgument,
	RBinaryOp,
	RExpressionList,
	RForLoop,
	RFunctionCall,
	RFunctionDefinition,
	RIfThenElse,
	RNodeWithParent,
	RParameter,
	RRepeatLoop,
	RWhileLoop,
	RType,
	RPipe,
	StatefulFoldFunctions
} from '../r-bridge'
import { log } from '../util/log'
import { guard, isNotNull } from '../util/assert'
import { MergeableRecord } from '../util/objects'
import {
	Selection,
	prettyPrintPartToString,
	PrettyPrintLine,
	plain,
	Code,
	indentBy,
	isSelected,
	removeExpressionListWrap,
	AutoSelectPredicate,
	getIndentString, merge } from './helper'
import { SourceRange} from '../util/range'

/*
--logger--
*/
export const reconstructLogger = log.getSubLogger({ name: 'reconstruct' })

/*
--helper function--
*/
const getLexeme = (n: RNodeWithParent) => n.info.fullLexeme ?? n.lexeme ?? ''

/*
--reconstruct--
*/
const reconstructAsLeaf = (leaf: RNodeWithParent, configuration: ReconstructionConfiguration): Code => {
	const selectionHasLeaf = configuration.selection.has(leaf.info.id) || configuration.autoSelectIf(leaf)
	if(selectionHasLeaf) {
		return foldToConst(leaf)
	} else {
		return []
	}
	// reconstructLogger.trace(`reconstructAsLeaf: ${leaf.info.id} (${selectionHasLeaf ? 'y' : 'n'}):  ${JSON.stringify(wouldBe)}`)
	// return selectionHasLeaf ? wouldBe : []
}

const foldToConst = (n: RNodeWithParent): Code => plain(getLexeme(n), n.location? n.location.start : {line: 0, column: 0})

/*
--reconstruct--
*/
function reconstructExpressionList(exprList: RExpressionList<ParentInformation>, expressions: Code[], configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, exprList)) {
		const positionStart = exprList.location? exprList.location.start : {line: 0, column: 0}
		return plain(getLexeme(exprList), positionStart)
	}

	const subExpressions = expressions.filter(e => e.length > 0)
	if(subExpressions.length === 0) {
		return []
	} else {
		const additionalTokens = reconstructAdditionalTokens(exprList)
		return merge([
			...subExpressions,
			...additionalTokens
		])
	}
}

/*
--reconstruct--
*/
function reconstructRawBinaryOperator(lhs: PrettyPrintLine[], n: string, rhs: PrettyPrintLine[]): Code {
	return [  // inline pretty print
		...lhs.slice(0, lhs.length - 1),
		{ linePart: [{ part: `${lhs[lhs.length - 1].linePart[lhs.length - 1].part} ${n} ${rhs[0].linePart[0].part}`, loc: lhs[lhs.length - 1].linePart[lhs.length - 1].loc }], indent: 0 },
		...indentBy(rhs.slice(1, rhs.length), 1)
	]
}

/*
--reconstruct--
*/
function reconstructUnaryOp(leaf: RNodeWithParent, operand: Code, configuration: ReconstructionConfiguration) {
	if(configuration.selection.has(leaf.info.id)) {
		return foldToConst(leaf)
	}
	else if(operand.length === 0) {
		return []
	} else {
		return foldToConst(leaf)
	}
}

/*
--reconstruct--
*/
function reconstructBinaryOp(n: RBinaryOp<ParentInformation> | RPipe<ParentInformation>, lhs: Code, rhs: Code, configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, n)) {
		//console.log(`lhs at ${JSON.stringify(n.lhs.location?.start)}, ${JSON.stringify(n.lhs.location?.end)}`)
		//console.log(`${getLexeme(n)} at ${JSON.stringify(n.location.start)}, ${JSON.stringify(n.location.end)}`)
		return plain(getLexeme(n), n.lhs.location? n.lhs.location.start : n.location.start)
	}

	if(lhs.length === 0 && rhs.length === 0) {
		return []
	}
	if(lhs.length === 0) { // if we have no lhs, only return rhs
		return rhs
	}
	if(rhs.length === 0) {
		//console.log(`lhs at ${JSON.stringify(n.lhs.location?.start)}, ${JSON.stringify(n.lhs.location?.end)}`)
		//console.log(`${getLexeme(n)} at ${JSON.stringify(n.location.start)}, ${JSON.stringify(n.location.end)}`)
		// if we have no rhs we have to keep everything to get the rhs
		return plain(getLexeme(n), n.lhs.location? n.lhs.location.start : n.location.start)
	}

	return reconstructRawBinaryOperator(lhs, n.type === RType.Pipe ? '|>' : n.operator, rhs)
}

/*
--reconstruct--
*/
function reconstructForLoop(loop: RForLoop<ParentInformation>, variable: Code, vector: Code, body: Code, configuration: ReconstructionConfiguration): Code {
	const start = loop.info.fullRange?.start //may be unnesseccary
	const additionalTokens = reconstructAdditionalTokens(loop)
	const out = merge([
		[{ linePart: [{part: `for(${getLexeme(loop.variable)} in ${getLexeme(loop.vector)})`, loc: start ? start :loop.location.start}], indent: 0 }],
		body,
		...additionalTokens
	])
	return out
	/*if(isSelected(configuration, loop)) {
		return plain(getLexeme(loop), loop.location.start)
	}
	if(body.length === 0 && variable.length === 0 && vector.length === 0) {
		return []
	} else if(body.length !== 0 && (variable.length !== 0 || vector.length !== 0)) {
		const additionalTokens = reconstructAdditionalTokens(loop)
		const out = merge([
			[{ linePart: [{part: `for(${getLexeme(loop.variable)} in ${getLexeme(loop.vector)})`, loc: start ? start :loop.location.start}], indent: 0 }],
			body,
			...additionalTokens
		])
		return out
	} else {
		return body
	}*/
}

function reconstructAdditionalTokens(loop: RNodeWithParent): Code[] {
	return loop.info.additionalTokens?.filter(t => t.lexeme && t.location)
		.map(t => plain(t.lexeme as string, (t.location as SourceRange).start)) ?? []
}

/*
--reconstruct--
*/
function reconstructRepeatLoop(loop: RRepeatLoop<ParentInformation>, body: Code, configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, loop)) {
		return plain(getLexeme(loop), loop.location.start)
	} else if(body.length === 0) {
		return []
	} else {
		const additionalTokens = reconstructAdditionalTokens(loop)
		return merge([
			[{ linePart: [{part: 'repeat', loc: loop.location.start}], indent: 0 }],
			body,
			...additionalTokens
		])
	}
}

/*
--reconstruct--
*/
function reconstructIfThenElse(ifThenElse: RIfThenElse<ParentInformation>, condition: Code, when: Code, otherwise: Code | undefined, configuration: ReconstructionConfiguration): Code {
	const startPos = ifThenElse.location.start
	const endPos = ifThenElse.location.end
	const conditionPos = ifThenElse.condition.location? ifThenElse.condition.location.start : {line: 0, column: 0}
	if(isSelected(configuration, ifThenElse)) {
		return plain(getLexeme(ifThenElse), startPos)
	}
	otherwise ??= []
	if(condition.length === 0 && when.length === 0 && otherwise.length === 0) {
		return []
	}
	if(otherwise.length === 0 && when.length === 0) {
		return [
			{ linePart: [{part: `if(${getLexeme(ifThenElse.condition)}) { }`, loc: startPos}], indent: 0 }
		]
	} else if(otherwise.length === 0) {
		return [
			{ linePart: [{part: `if(${getLexeme(ifThenElse.condition)}) {`, loc: startPos}], indent: 0 },
			...indentBy(removeExpressionListWrap(when), 1),
			{ linePart: [{part: '}', loc: endPos}], indent: 0 }
		]
	} else if(when.length === 0) {
		return [
			{ linePart: [{part: `if(${getLexeme(ifThenElse.condition)}) { } else {`, loc: startPos}], indent: 0 },
			...indentBy(removeExpressionListWrap(otherwise), 1),
			{ linePart: [{part: '}', loc: startPos}], indent: 0 }
		]
	} else {
		return [
			{ linePart: [{part: `if(${getLexeme(ifThenElse.condition)}) {`, loc: startPos}], indent: 0 },
			...indentBy(removeExpressionListWrap(when), 1),
			{ linePart: [{part: '} else {', loc: conditionPos}], indent: 0 },
			...indentBy(removeExpressionListWrap(otherwise), 1),
			{ linePart: [{part: '}', loc: endPos}], indent: 0 }
		]
	}
}

/*
--reconstruct--
*/
function reconstructWhileLoop(loop: RWhileLoop<ParentInformation>, condition: Code, body: Code, configuration: ReconstructionConfiguration): Code {
	const start = loop.location.start
	if(isSelected(configuration, loop)) {
		return plain(getLexeme(loop), start)
	}
	if(body.length === 0 && condition.length === 0) {
		return []
	} else {
		if(body.length <= 1) {
			// 'inline'
			return [{ linePart: [{part: `while(${getLexeme(loop.condition)}) ${body.length === 0 ? '{}' : body[0].linePart[0].part}`, loc: start}], indent: 0 }]
		} else if(body[0].linePart[0].part === '{' && body[body.length - 1].linePart[body[body.length - 1].linePart.length - 1].part === '}') {
			// 'block'
			return [
				{ linePart: [{part: `while(${getLexeme(loop.condition)}) {`, loc: start}], indent: 0 },
				...body.slice(1, body.length - 1),
				{ linePart: [{part: '}', loc: loop.location.end}], indent: 0 }
			]
		} else {
			// unknown
			return [
				{ linePart: [{part: `while(${getLexeme(loop.condition)})`, loc: start}], indent: 0 },
				...indentBy(body, 1)
			]
		}
	}
}

/*
--reconstruct--
*/
function reconstructParameters(parameters: RParameter<ParentInformation>[]): string[] {
	// const baseParameters = parameters.flatMap(p => plain(getLexeme(p)))
	return parameters.map(p => {
		if(p.defaultValue !== undefined) {
			return `${getLexeme(p.name)}=${getLexeme(p.defaultValue)}`
		} else {
			return getLexeme(p)
		}
	})
}


//foldAccess?? Arrayzugriffe
/*
--reconstruct--
*/
function reconstructFoldAccess(node: RAccess<ParentInformation>, accessed: Code, access: string | (Code | null)[], configuration: ReconstructionConfiguration): Code {
	const start = node.location.start
	if(isSelected(configuration, node)) {
		return plain(getLexeme(node), start)
	}

	if(accessed.length === 0) {
		if(typeof access === 'string') {
			return []
		} else {
			return access.filter(isNotNull).flat()
		}
	}

	return plain(getLexeme(node), start)
}

/*
--reconstruct--
*/
function reconstructArgument(argument: RArgument<ParentInformation>, name: Code | undefined, value: Code | undefined, configuration: ReconstructionConfiguration): Code {
	const start = argument.location.start
	if(isSelected(configuration, argument)) {
		return plain(getLexeme(argument), start)
	}

	if(argument.name !== undefined && name !== undefined && name.length > 0) {
		return plain(`${getLexeme(argument.name)}=${argument.value ? getLexeme(argument.value) : ''}`, start)
	} else {
		return value ?? []
	}
}

/*
--reconstruct--
*/
function reconstructParameter(parameter: RParameter<ParentInformation>, name: Code, value: Code | undefined, configuration: ReconstructionConfiguration): Code {
	const start = parameter.location.start
	if(isSelected(configuration, parameter)) {
		return plain(getLexeme(parameter), start)
	}

	if(parameter.defaultValue !== undefined && name.length > 0) {
		return plain(`${getLexeme(parameter.name)}=${getLexeme(parameter.defaultValue)}`, start)
	} else if(parameter.defaultValue !== undefined && name.length === 0) {
		return plain(getLexeme(parameter.defaultValue), start)
	} else {
		return name
	}
}

/*
--reconstruct--
*/
function reconstructFunctionDefinition(definition: RFunctionDefinition<ParentInformation>, functionParameters: Code[], body: Code, configuration: ReconstructionConfiguration): Code {
	// if a definition is not selected, we only use the body - slicing will always select the definition
	if(!isSelected(configuration, definition) && functionParameters.every(p => p.length === 0)) {
		return body
	}
	const parameters = reconstructParameters(definition.parameters).join(', ')
	const startPos = definition.location.start
	const endPos = definition.location.end
	if(body.length <= 1) {
		// 'inline'
		const bodyStr = body.length === 0 ? '' : `${body[0].linePart[0].part} ` /* add suffix space */
		// we keep the braces in every case because I do not like no-brace functions
		return [{ linePart: [{part: `function(${parameters}) { ${bodyStr}}`, loc: startPos}], indent: 0 }]
	} else if(body[0].linePart[0].part === '{' && body[body.length - 1].linePart[body[body.length - 1].linePart.length - 1].part === '}') {
		// 'block'
		return [
			{ linePart: [{part: `function(${parameters}) {`, loc: startPos}], indent: 0 },
			...body.slice(1, body.length - 1),
			{ linePart: [{part: '}', loc: endPos}], indent: 0 }
		]
	} else {
		// unknown -> we add the braces just to be sure
		return [
			{ linePart: [{part: `function(${parameters}) {`, loc: startPos}], indent: 0 },
			...indentBy(body, 1),
			{ linePart: [{part: '}', loc: endPos}], indent: 0 }
		]
	}

}

/*
--reconstruct--
*/
function reconstructSpecialInfixFunctionCall(args: (Code | undefined)[], call: RFunctionCall<ParentInformation>): Code {
	guard(args.length === 2, () => `infix special call must have exactly two arguments, got: ${args.length} (${JSON.stringify(args)})`)
	guard(call.flavor === 'named', `infix special call must be named, got: ${call.flavor}`)
	const lhs = args[0]
	const rhs = args[1]

	if((lhs === undefined || lhs.length === 0) && (rhs === undefined || rhs.length === 0)) {
		return []
	}
	// else if (rhs === undefined || rhs.length === 0) {
	// if rhs is undefined we still  have to keep both now, but reconstruct manually :/
	if(lhs !== undefined && lhs.length > 0) {
		const lhsText = lhs.map(l => `${getIndentString(l.indent)}${prettyPrintPartToString(l.linePart, lhs[0].linePart[0].loc.column)}`).join('\n')
		if(rhs !== undefined && rhs.length > 0) {
			const rhsText = rhs.map(l => `${getIndentString(l.indent)}${prettyPrintPartToString(l.linePart, rhs[0].linePart[0].loc.column)}`).join('\n')
			return plain(`${lhsText} ${call.functionName.content} ${rhsText}`, call.location.start)
		} else {
			return plain(lhsText, call.location.start)
		}
	}
	return plain(`${getLexeme(call.arguments[0] as RArgument<ParentInformation>)} ${call.functionName.content} ${getLexeme(call.arguments[1] as RArgument<ParentInformation>)}`, call.location.start)
}

/*
--reconstruct--
*/
function reconstructFunctionCall(call: RFunctionCall<ParentInformation>, functionName: Code, args: (Code | undefined)[], configuration: ReconstructionConfiguration): Code {
	if(call.infixSpecial === true) {
		return reconstructSpecialInfixFunctionCall(args, call)
	}
	if(call.flavor === 'named' && isSelected(configuration, call)) {
		return plain(getLexeme(call), call.location.start)
	}
	const filteredArgs = args.filter(a => a !== undefined && a.length > 0)
	if(functionName.length === 0 && filteredArgs.length === 0) {
		return []
	}

	if(args.length === 0) {
		guard(functionName.length === 1, `without args, we need the function name to be present! got: ${JSON.stringify(functionName)}`)
		if(call.flavor === 'unnamed' && !functionName[0].linePart[functionName[0].linePart.length - 1].part.endsWith(')')) {
			functionName[0].linePart[0].part = `(${functionName[0].linePart[0].part})`
		}

		if(!functionName[0].linePart[functionName[0].linePart.length - 1].part.endsWith('()')) {
			// add empty call braces if not present
			functionName[0].linePart[functionName[0].linePart.length - 1].part += '()'
		}
		return [{ linePart: functionName[0].linePart, indent: functionName[0].indent }]
	} else {
		return plain(getLexeme(call), call.location.start)
	}
}

/*
--interface--
*/
export interface ReconstructionConfiguration extends MergeableRecord {
	selection:    Selection
	/** if true, this will force the ast part to be reconstructed, this can be used, for example, to force include `library` statements */
	autoSelectIf: AutoSelectPredicate
}

/*
--reconstruct--
*/
/**
 * The fold functions used to reconstruct the ast in {@link reconstructToCode}.
 */
// escalates with undefined if all are undefined
export const reconstructAstFolds: StatefulFoldFunctions<ParentInformation, ReconstructionConfiguration, Code> = {
	// we just pass down the state information so everyone has them
	down:        (_n, c) => c,
	foldNumber:  reconstructAsLeaf,
	foldString:  reconstructAsLeaf,
	foldLogical: reconstructAsLeaf,
	foldSymbol:  reconstructAsLeaf,
	foldAccess:  reconstructFoldAccess,
	binaryOp:    {
		foldLogicalOp:    reconstructBinaryOp,
		foldArithmeticOp: reconstructBinaryOp,
		foldComparisonOp: reconstructBinaryOp,
		foldAssignment:   reconstructBinaryOp,
		foldPipe:         reconstructBinaryOp,
		foldModelFormula: reconstructBinaryOp
	},
	unaryOp: {
		foldArithmeticOp: reconstructUnaryOp,
		foldLogicalOp:    reconstructUnaryOp,
		foldModelFormula: reconstructUnaryOp
	},
	other: {
		foldComment:       reconstructAsLeaf,
		foldLineDirective: reconstructAsLeaf
	},
	loop: {
		foldFor:    reconstructForLoop,
		foldRepeat: reconstructRepeatLoop,
		foldWhile:  reconstructWhileLoop,
		foldBreak:  reconstructAsLeaf,
		foldNext:   reconstructAsLeaf
	},
	foldIfThenElse: reconstructIfThenElse,
	foldExprList:   reconstructExpressionList,
	functions:      {
		foldFunctionDefinition: reconstructFunctionDefinition,
		foldFunctionCall:       reconstructFunctionCall,
		foldParameter:          reconstructParameter,
		foldArgument:           reconstructArgument
	}
}


/*
--interface--
*/
export interface ReconstructionResult {
	code:         string
	/** number of nodes that triggered the `autoSelectIf` predicate {@link reconstructToCode} */
	autoSelected: number
}


