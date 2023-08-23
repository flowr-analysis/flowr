import { assertDecoratedAst, retrieveAst, withShell } from '../helper/shell'
import { numVal } from "../helper/ast-builder"
import { rangeFrom } from "../../src/util/range"
import {
	Type,
	decorateAst,
	RNodeWithParent,
	deterministicCountingIdGenerator,
	collectAllIds,
	NodeId
} from '../../src/r-bridge'
import { assert } from 'chai'

describe("Assign unique Ids and Parents", withShell((shell) => {
	describe("Testing deterministic counting Id assignment", () => {
		const assertDecorated = (name: string, input: string, expected: RNodeWithParent): void => {
			assertDecoratedAst(name, shell, input,
				(ast) => decorateAst(ast, deterministicCountingIdGenerator()).decoratedAst,
				expected
			)
		}
		// decided to test with ast parsing, as we are dependent on these changes in reality
		describe("Single nodes (leafs)", () => {
			const exprList = (...children: RNodeWithParent[]): RNodeWithParent => ({
				type:   Type.ExpressionList,
				lexeme: undefined,
				info:   {
					parent: undefined,
					id:     "1"
				},
				children,
			})
			assertDecorated("String", '"hello"',
				exprList({
					type:     Type.String,
					location: rangeFrom(1, 1, 1, 7),
					lexeme:   '"hello"',
					content:  {
						str:    "hello",
						quotes: '"',
					},
					info: {
						parent: "1",
						id:     "0"
					},
				})
			)
			assertDecorated("Number", "42",
				exprList({
					type:     Type.Number,
					location: rangeFrom(1, 1, 1, 2),
					lexeme:   "42",
					content:  numVal(42),
					info:     {
						parent: "1",
						id:     "0"
					},
				})
			)
			assertDecorated("Logical", "FALSE",
				exprList({
					type:     Type.Logical,
					location: rangeFrom(1, 1, 1, 5),
					lexeme:   "FALSE",
					content:  false,
					info:     {
						parent: "1",
						id:     "0"
					},
				})
			)
			assertDecorated("Symbol", "k",
				exprList({
					type:      Type.Symbol,
					location:  rangeFrom(1, 1, 1, 1),
					namespace: undefined,
					lexeme:    "k",
					content:   "k",
					info:      {
						parent: "1",
						id:     "0"
					},
				})
			)
		})
	})
	describe("Collect all íds in ast", () => {
		function assertIds(name: string, input: string, expected: Set<NodeId>, stop?: (node: RNodeWithParent) => boolean) {
			it(name, async() => {
				const baseAst = await retrieveAst(shell, input)
				const ast = decorateAst(baseAst)
				const ids = collectAllIds(ast.decoratedAst, stop)
				assert.deepStrictEqual(ids, expected, `Ids do not match for input ${input}`)
			})
		}
		assertIds('Without stop', 'x <- 2', new Set(['0', '1', '2', '3']))
		assertIds('Stop one', 'x <- 2', new Set(['0', '2', '3']), n => n.type === Type.Number)
		assertIds('Multiple statements', 'x <- 2; if(TRUE) { a <- 4 }', new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']))
		// if, TRUE, [when]
		assertIds('Multiple statements blocking binary ops', 'x <- 2; if(TRUE) { a <- 4 }', new Set(['3', '7', '8', '9']), n => n.type === Type.BinaryOp)
	})
})
)
