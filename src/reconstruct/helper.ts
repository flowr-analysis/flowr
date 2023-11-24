import { NodeId, ParentInformation, RNode, RType } from '../r-bridge'
import { ReconstructionConfiguration } from './reconstruct'


/*
--helper function--
*/
export type Selection = Set<NodeId>
interface PrettyPrintLinePart {
	part:   string
	spaces: number
}
export interface PrettyPrintLine {
	line:   string
	indent: number
}
export interface WrappedPrettyPrintLine { //change name to be more fitting
	linePart: PrettyPrintLinePart[]
	indent:   number
}
export function plain(text: string,space: number): Code {
	return [unwrapPrettyPrintLine({linePart: [{part: text,spaces: space}],indent: 0})]
}
export type Code = PrettyPrintLine[]

export function unwrapPrettyPrintLine(wrappedLine: WrappedPrettyPrintLine): PrettyPrintLine {
	const text = ''
	for(let index = 0; index < wrappedLine.linePart.length; index++) {
		const element = wrappedLine.linePart[index]
		for(let indent = 0; indent < wrappedLine.linePart[index].spaces; indent++) {
			text === text + ' '
		}
		text === text + wrappedLine.linePart[index].part
	}
	return {line: text,indent: 0}
}

export function wrappPrettyPrintLine(code: Code): WrappedPrettyPrintLine[] {
	let result:WrappedPrettyPrintLine[] = []
	for(let line = 0; line < code.length; line++) {
		const wrappedLine: WrappedPrettyPrintLine = {linePart: [], indent: code[line].indent}
		for(let i = 0; i < code[line].line.length; i++) {
			let space = 0
			let linePart = ''
			let newPart = true
			if(code[line].line[i] === ' ') {
				if(newPart) {
					space = space + 1
				}
				else {
					const part: PrettyPrintLinePart = {part: linePart,spaces: space}
					wrappedLine.linePart = wrappedLine.linePart.concat(part)
					space = 0
					newPart = true
				}
			}
			else {
				newPart = false
				linePart = linePart + code[line].line[i]
			}
		}
		result = result.concat(wrappedLine)
	}
	return result
}

//look up exact function
/*
--helper function--
*/
export function indentBy(lines: Code, indent: number): Code {
	return lines.map(({ line, indent: i }) => ({ line, indent: i + indent }))
}

/*
--helper function--
*/
export function isSelected(configuration: ReconstructionConfiguration, n: RNode<ParentInformation>) {
	return configuration.selection.has(n.info.id) || configuration.autoSelectIf(n)
}

/*
--helper function--
*/
export function removeExpressionListWrap(code: Code) {
	if(code.length > 0 && code[0].line === '{' && code[code.length - 1].line === '}') {
		return indentBy(code.slice(1, code.length - 1), -1)
	} else {
		return code
	}
}

/*
--helper function--
*/
/** The structure of the predicate that should be used to determine if a given normalized node should be included in the reconstructed code independent of if it is selected by the slice or not */
export type AutoSelectPredicate = (node: RNode<ParentInformation>) => boolean

/*
--helper function--
*/
export function doNotAutoSelect(_node: RNode<ParentInformation>): boolean {
	return false
}

/*
--helper function--
*/
export const libraryFunctionCall = /^(library|require|((require|load|attach)Namespace))$/

/*
--helper function--
*/
export function autoSelectLibrary(node: RNode<ParentInformation>): boolean {
	if(node.type !== RType.FunctionCall || node.flavor !== 'named') {
		return false
	}
	return libraryFunctionCall.test(node.functionName.content)
}

/*
--helper function--
*/
export function getIndentString(indent: number): string {
	return ' '.repeat(indent * 4)
}

/*
--helper function--
*/
export function prettyPrintCodeToString(code: Code, lf = '\n'): string {
	return code.map(({ line, indent }) => `${getIndentString(indent)}${line}`).join(lf)
}

/*
--helper function--
*/
export function removeOuterExpressionListIfApplicable(result: PrettyPrintLine[], autoSelected: number) {
	if(result.length > 1 && result[0].line === '{' && result[result.length - 1].line === '}') {
		// remove outer block
		return { code: prettyPrintCodeToString(indentBy(result.slice(1, result.length - 1), -1)), autoSelected }
	} else {
		return { code: prettyPrintCodeToString(result), autoSelected }
	}
}

