import { assertAst, withShell } from '../../../_helper/shell'
import {
	RNumberPool,
	RStringPool,
	RSymbolPool,
} from '../../../_helper/provider'
import { exprList } from '../../../_helper/ast-builder'
import { rangeFrom } from '../../../../../src/util/range'
import { parseCSV, retrieveCsvFromRCode, RType} from '../../../../../src'
import chai, { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { MIN_VERSION_RAW_STABLE } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions'
import {csvToRecord} from '../../../../../src/r-bridge/lang-4.x/ast/parser/csv/format'
chai.use(chaiAsPromised)

describe('CSV parsing', withShell(shell => {
	it('simple', async() => {
		const code = await retrieveCsvFromRCode({
			request:                'text',
			content:                'x <- 1',
			ensurePackageInstalled: false
		}, shell)
		assert.equal(code, `
"id2dummy",line1,col1,line2,col2,id,parent,token,terminal,text
7,1,1,1,6,7,0,expr,FALSE,
1,1,1,1,1,1,3,SYMBOL,TRUE,x
3,1,1,1,1,3,7,expr,FALSE,
2,1,3,1,4,2,7,LEFT_ASSIGN,TRUE,<-
4,1,6,1,6,4,5,NUM_CONST,TRUE,1
5,1,6,1,6,5,7,expr,FALSE,
`.trimStart())
	})

	it('to object', async() => {
		const code = await retrieveCsvFromRCode({
			request:                'text',
			content:                'x <- 1',
			ensurePackageInstalled: false
		}, shell)
		const parsed = csvToRecord(parseCSV(code))
		assert.equal(JSON.stringify(parsed), '{' +
			'"1":{"line1":"1","col1":"1","line2":"1","col2":"1","id":"1","parent":"3","token":"SYMBOL","terminal":"TRUE","text":"x"},' +
			'"2":{"line1":"1","col1":"3","line2":"1","col2":"4","id":"2","parent":"7","token":"LEFT_ASSIGN","terminal":"TRUE","text":"<-"},' +
			'"3":{"line1":"1","col1":"1","line2":"1","col2":"1","id":"3","parent":"7","token":"expr","terminal":"FALSE","text":""},' +
			'"4":{"line1":"1","col1":"6","line2":"1","col2":"6","id":"4","parent":"5","token":"NUM_CONST","terminal":"TRUE","text":"1"},' +
			'"5":{"line1":"1","col1":"6","line2":"1","col2":"6","id":"5","parent":"7","token":"expr","terminal":"FALSE","text":""},' +
			'"7":{"line1":"1","col1":"1","line2":"1","col2":"6","id":"7","parent":"0","token":"expr","terminal":"FALSE","text":""}}')
	})
}))

describe('Constant Parsing',
	withShell(shell => {
		describe('parse empty', () => {
			assertAst(
				'nothing',
				shell,
				'',
				exprList()
			)
		})
		describe('parse single', () => {
			// TODO restore this test
			/*it('parse illegal', () =>
				assert.throws(retrieveCsvFromRCode({
					request:                'text',
					content:                '{',
					ensurePackageInstalled: true
				}, shell) as Promise<string>)
			)*/
			describe('numbers', () => {
				for(const number of RNumberPool) {
					const range = rangeFrom(1, 1, 1, number.str.length)
					assertAst(
						number.str,
						shell,
						number.str,
						exprList({
							type:     RType.Number,
							location: range,
							lexeme:   number.str,
							content:  number.val,
							info:     {}
						})
					)
				}
			})
			describe('strings', () => {
				for(const string of RStringPool) {
					const range = rangeFrom(1, 1, 1, string.str.length)
					assertAst(
						string.str,
						shell,
						string.str,
						exprList({
							type:     RType.String,
							location: range,
							lexeme:   string.str,
							content:  string.val,
							info:     {}
						}),
						{
							// just a hackey way to not outright flag all
							minRVersion: string.str.startsWith('r') || string.str.startsWith('R') ? MIN_VERSION_RAW_STABLE : undefined
						}
					)
				}
			})
			describe('symbols', () => {
				for(const symbol of RSymbolPool) {
					const range = rangeFrom(
						1,
						symbol.symbolStart,
						1,
						symbol.symbolStart + symbol.val.length - 1
					)
					assertAst(
						symbol.str,
						shell,
						symbol.str,
						exprList({
							type:      RType.Symbol,
							namespace: symbol.namespace,
							location:  range,
							lexeme:    symbol.val,
							content:   symbol.val,
							info:      {}
						})
					)
				}
			})
			describe('logical', () => {
				for(const [lexeme, content] of [['TRUE', true], ['FALSE', false]] as const) {
					assertAst(
						`${lexeme} as ${JSON.stringify(content)}`,
						shell,
						lexeme,
						exprList({
							type:     RType.Logical,
							location: rangeFrom(1, 1, 1, lexeme.length),
							lexeme,
							content,
							info:     {}
						})
					)
				}
			})
			describe('comments', () => {
				assertAst(
					'simple line comment',
					shell,
					'# Hello World',
					exprList({
						type:     RType.Comment,
						location: rangeFrom(1, 1, 1, 13),
						lexeme:   '# Hello World',
						content:  ' Hello World',
						info:     {}
					})
				)
			})
		})
	})
)
