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
import { Selection } from './helper'
import { PrettyPrintLine } from './helper'
import { plain } from './helper'
import { Code } from './helper'
import { indentBy } from './helper'
import { isSelected } from './helper'
import { removeExpressionListWrap } from './helper'
import { AutoSelectPredicate } from './helper'
import { getIndentString } from './helper'

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

const foldToConst = (n: RNodeWithParent): Code => plain(getLexeme(n), n.location? n.location.start.column : 0)

/*
--reconstruct--
*/
function reconstructExpressionList(exprList: RExpressionList<ParentInformation>, expressions: Code[], configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, exprList)) {
		return plain(getLexeme(exprList), exprList.location? exprList.location.start.column : 0)
	}

	const subExpressions = expressions.filter(e => e.length > 0)
	if(subExpressions.length === 0) {
		return []
	} else if(subExpressions.length === 1) {
		return subExpressions[0]
	} else {
		return [
			{ line: '{', indent: 0 },
			...indentBy(subExpressions.flat(), 1),
			{ line: '}', indent: 0 }
		]
	}
}

/*
--reconstruct--
*/
function reconstructRawBinaryOperator(lhs: PrettyPrintLine[], n: string, rhs: PrettyPrintLine[]) {
	return [  // inline pretty print
		...lhs.slice(0, lhs.length - 1),
		{ line: `${lhs[lhs.length - 1].line} ${n} ${rhs[0].line}`, indent: 0 },
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
		return plain(getLexeme(n),n.location? n.location.start.column : 0)
	}

	if(lhs.length === 0 && rhs.length === 0) {
		return []
	}
	if(lhs.length === 0) { // if we have no lhs, only return rhs
		return rhs
	}
	if(rhs.length === 0) { // if we have no rhs we have to keep everything to get the rhs
		return plain(getLexeme(n), n.location? n.location.start.column : 0)
	}

	return reconstructRawBinaryOperator(lhs, n.type === RType.Pipe ? '|>' : n.operator, rhs)
}

/*
--reconstruct--
*/
function reconstructForLoop(loop: RForLoop<ParentInformation>, variable: Code, vector: Code, body: Code, configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, loop)) {
		return plain(getLexeme(loop), loop.location? loop.location.start.column : 0)
	}
	if(body.length === 0 && variable.length === 0 && vector.length === 0) {
		return []
	} else {
		if(body.length <= 1) {
			// 'inline'
			return [{ line: `for(${getLexeme(loop.variable)} in ${getLexeme(loop.vector)}) ${body.length === 0 ? '{}' : body[0].line}`, indent: 0 }]
		} else if(body[0].line === '{' && body[body.length - 1].line === '}') {
			// 'block'
			return [
				{ line: `for(${getLexeme(loop.variable)} in ${getLexeme(loop.vector)}) {`, indent: 0 },
				...body.slice(1, body.length - 1),
				{ line: '}', indent: 0 }
			]
		} else {
			// unknown
			return [
				{ line: `for(${getLexeme(loop.variable)} in ${getLexeme(loop.vector)})`, indent: 0 },
				...indentBy(body, 1)
			]
		}
	}
}

/*
--reconstruct--
*/
function reconstructRepeatLoop(loop: RRepeatLoop<ParentInformation>, body: Code, configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, loop)) {
		return plain(getLexeme(loop), loop.location? loop.location.start.column : 0)
	} else if(body.length === 0) {
		return []
	} else {
		if(body.length <= 1) {
			// 'inline'
			return [{ line: `repeat ${body.length === 0 ? '{}' : body[0].line}`, indent: 0 }]
		} else if(body[0].line === '{' && body[body.length - 1].line === '}') {
			// 'block'
			return [
				{ line: 'repeat {', indent: 0 },
				...body.slice(1, body.length - 1),
				{ line: '}', indent: 0 }
			]
		} else {
			// unknown
			return [
				{ line: 'repeat', indent: 0 },
				...indentBy(body, 1)
			]
		}
	}
}

/*
--reconstruct--
*/
function reconstructIfThenElse(ifThenElse: RIfThenElse<ParentInformation>, condition: Code, when: Code, otherwise: Code | undefined, configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, ifThenElse)) {
		return plain(getLexeme(ifThenElse), ifThenElse.location? ifThenElse.location.start.column : 0)
	}
	otherwise ??= []
	if(condition.length === 0 && when.length === 0 && otherwise.length === 0) {
		return []
	}
	if(otherwise.length === 0 && when.length === 0) {
		return [
			{ line: `if(${getLexeme(ifThenElse.condition)}) { }`, indent: 0 }
		]
	} else if(otherwise.length === 0) {
		return [
			{ line: `if(${getLexeme(ifThenElse.condition)}) {`, indent: 0 },
			...indentBy(removeExpressionListWrap(when), 1),
			{ line: '}', indent: 0 }
		]
	} else if(when.length === 0) {
		return [
			{ line: `if(${getLexeme(ifThenElse.condition)}) { } else {`, indent: 0 },
			...indentBy(removeExpressionListWrap(otherwise), 1),
			{ line: '}', indent: 0 }
		]
	} else {
		return [
			{ line: `if(${getLexeme(ifThenElse.condition)}) {`, indent: 0 },
			...indentBy(removeExpressionListWrap(when), 1),
			{ line: '} else {', indent: 0 },
			...indentBy(removeExpressionListWrap(otherwise), 1),
			{ line: '}', indent: 0 }
		]
	}
}

/*
--reconstruct--
*/
function reconstructWhileLoop(loop: RWhileLoop<ParentInformation>, condition: Code, body: Code, configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, loop)) {
		return plain(getLexeme(loop), loop.location? loop.location.start.column : 0)
	}
	if(body.length === 0 && condition.length === 0) {
		return []
	} else {
		if(body.length <= 1) {
			// 'inline'
			return [{ line: `while(${getLexeme(loop.condition)}) ${body.length === 0 ? '{}' : body[0].line}`, indent: 0 }]
		} else if(body[0].line === '{' && body[body.length - 1].line === '}') {
			// 'block'
			return [
				{ line: `while(${getLexeme(loop.condition)}) {`, indent: 0 },
				...body.slice(1, body.length - 1),
				{ line: '}', indent: 0 }
			]
		} else {
			// unknown
			return [
				{ line: `while(${getLexeme(loop.condition)})`, indent: 0 },
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
	if(isSelected(configuration, node)) {
		return plain(getLexeme(node), node.location? node.location.start.column : 0)
	}

	if(accessed.length === 0) {
		if(typeof access === 'string') {
			return []
		} else {
			return access.filter(isNotNull).flat()
		}
	}

	return plain(getLexeme(node), node.location? node.location.start.column : 0)
}

/*
--reconstruct--
*/
function reconstructArgument(argument: RArgument<ParentInformation>, name: Code | undefined, value: Code | undefined, configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, argument)) {
		return plain(getLexeme(argument), argument.location? argument.location.start.column : 0)
	}

	if(argument.name !== undefined && name !== undefined && name.length > 0) {
		return plain(`${getLexeme(argument.name)}=${argument.value ? getLexeme(argument.value) : ''}`, argument.location? argument.location.start.column : 0)
	} else {
		return value ?? []
	}
}

/*
--reconstruct--
*/
function reconstructParameter(parameter: RParameter<ParentInformation>, name: Code, value: Code | undefined, configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, parameter)) {
		return plain(getLexeme(parameter), parameter.location? parameter.location.start.column : 0)
	}

	if(parameter.defaultValue !== undefined && name.length > 0) {
		return plain(`${getLexeme(parameter.name)}=${getLexeme(parameter.defaultValue)}`, parameter.location? parameter.location.start.column : 0)
	} else if(parameter.defaultValue !== undefined && name.length === 0) {
		return plain(getLexeme(parameter.defaultValue), parameter.location? parameter.location.start.column : 0)
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
	if(body.length <= 1) {
		// 'inline'
		const bodyStr = body.length === 0 ? '' : `${body[0].line} ` /* add suffix space */
		// we keep the braces in every case because I do not like no-brace functions
		return [{ line: `function(${parameters}) { ${bodyStr}}`, indent: 0 }]
	} else if(body[0].line === '{' && body[body.length - 1].line === '}') {
		// 'block'
		return [
			{ line: `function(${parameters}) {`, indent: 0 },
			...body.slice(1, body.length - 1),
			{ line: '}', indent: 0 }
		]
	} else {
		// unknown -> we add the braces just to be sure
		return [
			{ line: `function(${parameters}) {`, indent: 0 },
			...indentBy(body, 1),
			{ line: '}', indent: 0 }
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
		const lhsText = lhs.map(l => `${getIndentString(l.indent)}${l.line}`).join('\n')
		if(rhs !== undefined && rhs.length > 0) {
			const rhsText = rhs.map(l => `${getIndentString(l.indent)}${l.line}`).join('\n')
			return plain(`${lhsText} ${call.functionName.content} ${rhsText}`, call.location? call.location.start.column : 0)
		} else {
			return plain(lhsText, call.location? call.location.start.column : 0)
		}
	}
	return plain(`${getLexeme(call.arguments[0] as RArgument<ParentInformation>)} ${call.functionName.content} ${getLexeme(call.arguments[1] as RArgument<ParentInformation>)}`, call.location? call.location.start.column : 0)
}

/*
--reconstruct--
*/
function reconstructFunctionCall(call: RFunctionCall<ParentInformation>, functionName: Code, args: (Code | undefined)[], configuration: ReconstructionConfiguration): Code {
	if(call.infixSpecial === true) {
		return reconstructSpecialInfixFunctionCall(args, call)
	}
	if(call.flavor === 'named' && isSelected(configuration, call)) {
		return plain(getLexeme(call), call.location? call.location.start.column : 0)
	}
	const filteredArgs = args.filter(a => a !== undefined && a.length > 0)
	if(functionName.length === 0 && filteredArgs.length === 0) {
		return []
	}

	if(args.length === 0) {
		guard(functionName.length === 1, `without args, we need the function name to be present! got: ${JSON.stringify(functionName)}`)
		if(call.flavor === 'unnamed' && !functionName[0].line.endsWith(')')) {
			functionName[0].line = `(${functionName[0].line})`
		}

		if(!functionName[0].line.endsWith('()')) {
			// add empty call braces if not present
			functionName[0].line += '()'
		}
		return [{ line: functionName[0].line, indent: functionName[0].indent }]
	} else {
		return plain(getLexeme(call), call.location? call.location.start.column : 0)
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


