import { assertAst, withShell } from '../../../_helper/shell'
import {
	RNumberPool,
	RStringPool,
	RSymbolPool,
} from '../../../_helper/provider'
import { exprList } from '../../../_helper/ast-builder'
import { rangeFrom } from '../../../../../src/util/range'
import { retrieveXmlFromRCode, RType } from '../../../../../src/r-bridge'
import chai, { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { MIN_VERSION_RAW_STABLE } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions'
import { DESUGAR_NORMALIZE, NORMALIZE } from '../../../../../src/core/steps/all/core/10-normalize'
chai.use(chaiAsPromised)


describe('Constant Parsing',
	withShell(shell => {
		describe('parse empty', () => {
			assertAst(
				'nothing',
				shell,
				'',
				[{
					step:   NORMALIZE,
					wanted: exprList()
				}, {
					step:   DESUGAR_NORMALIZE,
					wanted: exprList()
				}]
			)
		})
		describe('parse single', () => {
			it('parse illegal', () =>
				assert.isRejected(retrieveXmlFromRCode({
					request:                'text',
					content:                '{',
					ensurePackageInstalled: true
				}, shell))
			)
			describe('numbers', () => {
				for(const number of RNumberPool) {
					const range = rangeFrom(1, 1, 1, number.str.length)
					assertAst(
						number.str,
						shell,
						number.str,
						[{
							step:   NORMALIZE,
							wanted: exprList({
								type:     RType.Number,
								location: range,
								lexeme:   number.str,
								content:  number.val,
								info:     {}
							})
						}, {
							step:   DESUGAR_NORMALIZE,
							wanted: exprList({
								type:     RType.Number,
								location: range,
								lexeme:   number.str,
								content:  number.val,
								info:     {}
							})
						}]
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
						[{
							step:   NORMALIZE,
							wanted: exprList({
								type:     RType.String,
								location: range,
								lexeme:   string.str,
								content:  string.val,
								info:     {}
							})
						}, {
							step:   DESUGAR_NORMALIZE,
							wanted: exprList({
								type:     RType.String,
								location: range,
								lexeme:   string.str,
								content:  string.val,
								info:     {}
							})
						}],
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
						[{
							step:   NORMALIZE,
							wanted: exprList({
								type:      RType.Symbol,
								namespace: symbol.namespace,
								location:  range,
								lexeme:    symbol.val,
								content:   symbol.val,
								info:      {}
							})
						}, {
							step:   DESUGAR_NORMALIZE,
							wanted: exprList({
								type:      RType.Symbol,
								namespace: symbol.namespace,
								location:  range,
								lexeme:    symbol.val,
								content:   symbol.val,
								info:      {}
							})
						}]
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
