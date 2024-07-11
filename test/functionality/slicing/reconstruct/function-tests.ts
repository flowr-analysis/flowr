import { assert } from 'chai'
import type { Code, PrettyPrintLinePart } from '../../../../src/reconstruct/helper'
import { plain, merge, prettyPrintCodeToString, prettyPrintPartToString, plainSplit } from '../../../../src/reconstruct/helper'
import { jsonReplacer } from '../../../../src/util/json'
import type { SourcePosition } from '../../../../src/util/range'

describe('Functions Reconstruct', () => {
	describe('plain', () => {
		function positive(input: string, line: number, column: number, expected: Code) {
			it(`${input} for ${line}:${column}`, () => {
				const result:Code = plain(input, [line,column]  )
				assert.deepStrictEqual(result,expected)
			})
		}

		for(const testCase of [
			{ input: 'Hello', line: 1, column: 1, expected: [{ linePart: [{ part: 'Hello', loc: [1, 1] }],indent: 0 }] as Code },
			{ input: 'Hello World', line: 4, column: 3, expected: [{ linePart: [{ part: 'Hello World', loc: [4, 3] }],indent: 0 }] as Code },
			{ input: 'Hello\nWorld', line: 1, column: 1, expected: [{ linePart: [{ part: 'Hello', loc: [1, 1] },{ part: 'World', loc: [2, 1] }],indent: 0 }] as Code },
			{ input: 'Hello\nWorld', line: 3, column: 4, expected: [{ linePart: [{ part: 'Hello', loc: [3, 4] },{ part: 'World', loc: [4, 4] }],indent: 0 }] as Code },
			{ input: 'Hello\n World\n24', line: 1, column: 1, expected: [{ linePart: [{ part: 'Hello', loc: [1, 1] },{ part: ' World', loc: [2, 1] },{ part: '24', loc: [3, 1] }],indent: 0 }] as Code }
		]) {
			positive(testCase.input, testCase.line, testCase.column, testCase.expected)
		}
	})
	describe('plainSplit', () => {
		function positive(input: string, startPos: SourcePosition, expected: Code) {
			it(`${input} for ${startPos[0]}:${startPos[1]}`, () => {
				const result:Code = plain(input, startPos)
				assert.deepStrictEqual(result,expected)
			})
		}
		const testCases = [
			{ input: 'Hello', line: 1, column: 1, expected: [{ linePart: [{ part: 'Hello', loc: [1, 1] }],indent: 0 }] as Code },
			{ input: 'Hello World', line: 4, column: 3, expected: [{ linePart: [{ part: 'Hello', loc: [4, 3] }, { part: 'World', loc: [4, 9] }],indent: 0 }] as Code },
			{ input: 'Hello\nWorld', line: 1, column: 1, expected: [{ linePart: [{ part: 'Hello', loc: [1, 1] }],indent: 0 }, { linePart: [{ part: 'World', loc: [2, 1] }],indent: 0 }] as Code },
			{ input: 'Hello\nWorld', line: 3, column: 4, expected: [{ linePart: [{ part: 'Hello', loc: [3, 4] }],indent: 0 }, { linePart: [{ part: 'World', loc: [4, 1] }],indent: 0 }] as Code }
			//{ input: 'Hello\n World\n24', line: 1, column: 1, expected: [{ linePart: [{ part: 'Hello', loc: [1, 1] },{ part: ' World', loc: [2, 1] },{ part: '24', loc: [3, 1] }],indent: 0 }] as Code }
		]
		for(const testCase of testCases) {
			positive(testCase.input, [testCase.line, testCase.column], testCase.expected)
		}
	}
	)
	describe('merge', () => {
		function positive(snipbits: Code[],expected: Code) {
			it(prettyPrintCodeToString(expected),() => {
				const result:Code = merge(...snipbits)
				assert.deepStrictEqual(result, expected)
			})
		}
		describe('single line merge', () => {
			for(const testCase of [
				{ snipbit: [[{ linePart: [{ part: 'Hello World', loc: [4, 3] }],indent: 0 }]] as [Code], expected: [{ linePart: [{ part: 'Hello World', loc: [4, 3] }],indent: 0 }] as Code },
				{ snipbit: [[{ linePart: [{ part: 'Hello', loc: [1, 1] },{ part: 'World', loc: [1, 1] }],indent: 0 }]] as [Code], expected: [{ linePart: [{ part: 'Hello', loc: [1, 1] },{ part: 'World', loc: [1, 1] }],indent: 0 }] as Code }
			]) {
				positive(testCase.snipbit, testCase.expected)
			}
		})
		describe('two lines merge', () => {
			const helloLocation = [0, 0] as SourcePosition
			const worldLocation = [1, 0] as SourcePosition
			const numLocation = [1, 7] as SourcePosition
			const testCases = [
				{
					snipbit:  [[{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 }], [{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }]] as [Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }]
				},
				{
					snipbit:  [[{ linePart: [{ part: 'Hello', loc: helloLocation }, { part: 'World', loc: worldLocation }], indent: 0 }]] as [Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }]
				},
				{
					snipbit:  [[{ linePart: [{ part: 'Hello', loc: helloLocation }, { part: 'World', loc: worldLocation }], indent: 0 }],[{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }]] as [Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }, { part: '24', loc: numLocation }], indent: 0 }]
				},
				//Case 2 (out of order)
				{
					snipbit:  [[{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }],[{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 }]] as [Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }]
				},
				{
					snipbit:  [[{ linePart: [{ part: 'World', loc: worldLocation }, { part: 'Hello', loc: helloLocation }], indent: 0 }]] as [Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }]
				},
				{
					snipbit:  [[{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }], [{ linePart: [{ part: 'Hello', loc: helloLocation }, { part: 'World', loc: worldLocation }], indent: 0 }]] as [Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }, { part: '24', loc: numLocation }], indent: 0 }]
				}
			]
			for(const testCase of testCases) {
				positive(testCase.snipbit, testCase.expected)
			}
		})
		describe('three lines merge', () => {
			const helloLocation = [0, 0] as SourcePosition
			const worldLocation = [1, 7] as SourcePosition
			const numLocation = [2, 7] as SourcePosition
			const testCases = [
				//Case 1 (in order) 123
				{
					snipbit:  [[{ linePart: [{ part: 'Hello', loc: helloLocation }, { part: 'World', loc: worldLocation }], indent: 0 }],[{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }]] as [Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 },{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }]
				},
				//Case 2 (2nd Line out of order) 213
				{
					snipbit:  [[{ linePart: [{ part: 'World', loc: worldLocation }, { part: 'Hello', loc: helloLocation }], indent: 0 }],[{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }]] as [Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 },{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }]
				},
				//Case 3 (3rd Line out of order) 231
				{
					snipbit:  [[{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }],[{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }], [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 }]] as [Code, Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 },{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }]
				},
				//Case 4 (reverse order) 321
				{
					snipbit:  [[{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }],[{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }], [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 }]] as [Code, Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 },{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }]
				},
				//Case 5 () 312
				{
					snipbit:  [[{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }], [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 }], [{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }]] as [Code, Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 },{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }]
				},
				//Case 6 () 132
				{
					snipbit:  [[{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 }], [{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }], [{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 }]] as [Code, Code, Code],
					expected: [{ linePart: [{ part: 'Hello', loc: helloLocation }], indent: 0 },{ linePart: [{ part: 'World', loc: worldLocation }], indent: 0 },{ linePart: [{ part: '24', loc: numLocation }], indent: 0 }]
				}
			]
			for(const testCase of testCases) {
				positive(testCase.snipbit, testCase.expected)
			}
		})
		describe('random lines merge', () => {
			function makeTestCase(lines: number): Code[] {
				const testCase = [] as Code[]
				const partPool = ['Hello', 'World', 'FlowR', 'Is', 'Incredible']
				for(let i = 0; i < lines; i++) {
					const line: Code = [{ linePart: [{ part: partPool[Math.random() % 5], loc: [Math.random() % lines, Math.random() % 15] }], indent: 0 }]
					testCase.push(line)
				}
				return testCase
			}
			function checkTestCase(code: Code): boolean {
				let currentLoc = [0, 0] as SourcePosition
				for(const line of code) {
					for(const part of line.linePart) {
						const nextLoc = part.loc
						if(currentLoc[0] <= nextLoc[0] && currentLoc[1] <= nextLoc[1]) {
							currentLoc = nextLoc
						} else {
							return false
						}
					}
				}
				return true
			}
			function positive(lines: number) {
				const snipbit = makeTestCase(lines)
				it(`case with ${lines} lines`, () => {
					const merged = merge(...snipbit)
					assert.isTrue(checkTestCase(merged), JSON.stringify(merged))
				})
			}
			for(let i = 0; i < 20; i++) {
				positive(i)
			}
		})
	})
	describe('printLinePart', () => {
		function positive(input: PrettyPrintLinePart[], expected: string, msg: string, columnOffset: number) {
			it(`Convert ${JSON.stringify(input)} to string`, () => {
				const out = prettyPrintPartToString(input, columnOffset)
				assert.strictEqual(out, expected, msg)
			})
		}
		for(const testCase of [
			{ input: [{ part: 'Hello', loc: [0, 0] }] as [PrettyPrintLinePart],expected: 'Hello',msg: 'No Spaces anywhere', columnOffset: 0 },
			{ input: [{ part: 'Hello World', loc: [0, 0] }] as [PrettyPrintLinePart],expected: 'Hello World',msg: 'Spaces get preserved', columnOffset: 0 },
			{ input: [{ part: 'Hello', loc: [0, 0] }, { part: 'World', loc: [0, 6] }] as [PrettyPrintLinePart, PrettyPrintLinePart],expected: 'Hello World',msg: 'Spaces get added within the string', columnOffset: 0 },
			{ input: [{ part: 'Hello', loc: [0, 6] }] as [PrettyPrintLinePart],expected: 'Hello',msg: 'Spaces get added at the beginning', columnOffset: 0 },
			{ input: [{ part: 'World', loc: [0, 6] },{ part: 'Hello', loc: [0, 0] }] as [PrettyPrintLinePart, PrettyPrintLinePart],expected: 'Hello World',msg: 'Spaces get added within the string, wrong order', columnOffset: 0 },
		]) {
			positive(testCase.input, testCase.expected, testCase.msg, testCase.columnOffset)
		}
	})
	describe('semicolon reconstruction', () => {
		function positive(input: string, expected: string, msg: string) {
			it(`Add semicolons to ${JSON.stringify(input, jsonReplacer)}`, () => {
				const convertedInput = plainSplit(input, [1, 1])
				const out = prettyPrintCodeToString(convertedInput)
				assert.strictEqual(out, expected, msg)
			})
		}

		const testCases = [
			{ input: 'a <- function (x) { x <- 2  x + 4 }', expected: 'a <- function (x) { x <- 2; x + 4 }', msg: 'semi in function that gets assigned' },
			{ input: 'function (x) { x <- 2  3 }', expected: 'function (x) { x <- 2; 3 }', msg: 'standart single line function' },
			{ input: 'x <- 3  y <- 4', expected: 'x <- 3; y <- 4', msg: 'single line, double assign' }
		]
		for(const testCase of testCases) {
			positive(testCase.input, testCase.expected, testCase.msg)
		}
	})
})