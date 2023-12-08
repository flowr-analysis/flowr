import { NodeId, ParentInformation, RNode, RType } from '../r-bridge'
import { SourcePosition } from '../util/range'
import { ReconstructionConfiguration } from './reconstruct'


/*
--helper function--
*/
export type Code = PrettyPrintLine[]
export type Selection = Set<NodeId>
interface PrettyPrintLinePart {
	part: string
	loc:  SourcePosition
}
export interface PrettyPrintLine {
	linePart: PrettyPrintLinePart[]
	indent:   number
}

/**
 * Splits text on linebreak to create lineParts and encapsulates them in the Code type
 */
export function plain(text: string, location: SourcePosition): Code {
	const printLine: PrettyPrintLine = {linePart: [], indent: 0}
	const split = text.split('\n')
	let locationLine = location.line

	for(const line of split) {
		printLine.linePart.push({part: line, loc: { column: location.column, line: locationLine++ }})
	}
	return [printLine]
}

/**
 * this function will merge up to n code pieces into a singular code piece, garanting that there are no duplicate lines and all lines are in order
 */
export function merge(snipbits: Code[]): Code {
	const buckets: PrettyPrintLine[] = []
	const result:Code = []

	//separate and group lineParts by lines
	for(const code of snipbits) {
		for(const line of code) {
			for(const part of line.linePart) {
				buckets[part.loc.line].linePart.push(part)
			}
		}
	}

	//sort buckets by column and stich lines into single code piece
	for(const line of buckets) {
		line.linePart.sort((a, b) => a.loc.column - b.loc.column)
		result.push(line)
	}

	return result
}

export function prettyPrintPartToString(line: PrettyPrintLinePart[]): string {
	let result = ''
	for(const part of line) {
		result += ' '.repeat(part.loc.column)
		result = result.concat(part.part)
	}
	return result
}

/*
--helper function--
*/
export function indentBy(lines: Code, indent: number): Code {
	return lines.map(({ linePart, indent: i }) => ({ linePart, indent: i + indent }))
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
	if(code.length > 0 && code[0].linePart[0].part === '{' && code[code.length - 1].linePart[code[code.length - 1].linePart.length - 1].part === '}') {
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
	return code.map(({ linePart, indent }) => `${getIndentString(indent)}${prettyPrintPartToString(linePart)}`).join(lf)
}

/*
--helper function--
*/
export function removeOuterExpressionListIfApplicable(result: PrettyPrintLine[], autoSelected: number) {
	if(result.length > 1 && result[0].linePart[0].part === '{' && result[result.length - 1].linePart[result[result.length - 1].linePart.length - 1].part === '}') {
		// remove outer block
		return { code: prettyPrintCodeToString(indentBy(result.slice(1, result.length - 1), -1)), autoSelected }
	} else {
		return { code: prettyPrintCodeToString(result), autoSelected }
	}
}

