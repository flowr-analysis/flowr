import { assertAst, withShell } from '../../../_helper/shell'
import { exprList, numVal } from '../../../_helper/ast-builder'
import { rangeFrom } from '../../../../../src/util/range'
import { RType } from '../../../../../src'
import { DESUGAR_NORMALIZE, NORMALIZE } from '../../../../../src/core/steps/all/core/10-normalize'
import {InternalScope} from '../../../../../src/r-bridge/lang-4.x/ast/parser/xml/v2/internal/internal'

describe('Parse value access', withShell(shell => {
	describe('Single bracket', () => {
		assertAst('Empty', shell, 'a[]', [
			{
				step:   NORMALIZE,
				wanted: exprList({
					type:     RType.Access,
					location: rangeFrom(1, 2, 1, 2),
					lexeme:   '[',
					operator: '[',
					info:     {},
					accessed: {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'a',
						content:   'a',
						info:      {}
					},
					access: []
				})
			}, {
				step:   DESUGAR_NORMALIZE,
				wanted: exprList({
					type:         RType.FunctionCall,
					info:         {},
					lexeme:       '[',
					functionName: {
						type:      RType.Symbol,
						lexeme:    '[',
						content:   '[',
						info:      {},
						location:  rangeFrom(1, 2, 1, 2),
						namespace: InternalScope
					},
					location:  rangeFrom(1, 2, 1, 2),
					flavor:    'named',
					arguments: [{
						type:      RType.Symbol,
						lexeme:    'a',
						content:   'a',
						info:      {},
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined
					}]
				})
			}
		])
		assertAst('One value', shell, 'a[1]', [
			{
				step:   NORMALIZE,
				wanted: exprList({
					type:     RType.Access,
					location: rangeFrom(1, 2, 1, 2),
					lexeme:   '[',
					operator: '[',
					info:     {},
					accessed: {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'a',
						content:   'a',
						info:      {}
					},
					access: [{
						type:     RType.Argument,
						location: rangeFrom(1, 3, 1, 3),
						lexeme:   '1',
						name:     undefined,
						info:     {},
						value:    {
							type:     RType.Number,
							location: rangeFrom(1, 3, 1, 3),
							lexeme:   '1',
							content:  numVal(1),
							info:     {}
						}
					}]
				})
			},
			{
				step:   DESUGAR_NORMALIZE,
				wanted: exprList({
					type:         RType.FunctionCall,
					info:         {},
					lexeme:       '[',
					functionName: {
						type:      RType.Symbol,
						lexeme:    '[',
						content:   '[',
						info:      {},
						location:  rangeFrom(1, 2, 1, 2),
						namespace: InternalScope
					},
					location:  rangeFrom(1, 2, 1, 2),
					flavor:    'named',
					arguments: [{
						type:      RType.Symbol,
						lexeme:    'a',
						content:   'a',
						info:      {},
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined
					}, {
						type:     RType.Number,
						location: rangeFrom(1, 3, 1, 3),
						lexeme:   '1',
						content:  numVal(1),
						info:     {}
					}]
				})
			}
		])
		assertAst('One variable', shell, 'a[x]', exprList({
			type:     RType.Access,
			location: rangeFrom(1, 2, 1, 2),
			lexeme:   '[',
			operator: '[',
			info:     {},
			accessed: {
				type:      RType.Symbol,
				location:  rangeFrom(1, 1, 1, 1),
				namespace: undefined,
				lexeme:    'a',
				content:   'a',
				info:      {}
			},
			access: [{
				type:     RType.Argument,
				location: rangeFrom(1, 3, 1, 3),
				lexeme:   'x',
				name:     undefined,
				info:     {},
				value:    {
					type:      RType.Symbol,
					location:  rangeFrom(1, 3, 1, 3),
					namespace: undefined,
					lexeme:    'x',
					content:   'x',
					info:      {}
				}
			}]
		}))
		assertAst('One expression', shell, 'a[x + 3]', exprList({
			type:     RType.Access,
			location: rangeFrom(1, 2, 1, 2),
			lexeme:   '[',
			operator: '[',
			info:     {},
			accessed: {
				type:      RType.Symbol,
				location:  rangeFrom(1, 1, 1, 1),
				namespace: undefined,
				lexeme:    'a',
				content:   'a',
				info:      {}
			},
			access: [{
				type:     RType.Argument,
				location: rangeFrom(1, 3, 1, 7),
				lexeme:   'x + 3',
				name:     undefined,
				info:     {},
				value:    {
					type:     RType.BinaryOp,
					location: rangeFrom(1, 5, 1, 5),
					flavor:   'arithmetic',
					operator: '+',
					lexeme:   '+',
					info:     {},
					lhs:      {
						type:      RType.Symbol,
						location:  rangeFrom(1, 3, 1, 3),
						namespace: undefined,
						lexeme:    'x',
						content:   'x',
						info:      {}
					},
					rhs: {
						type:     RType.Number,
						location: rangeFrom(1, 7, 1, 7),
						lexeme:   '3',
						content:  numVal(3),
						info:     {}
					}
				}
			}]
		}))
		assertAst('Multiple', shell, 'a[3,2]', exprList({
			type:     RType.Access,
			location: rangeFrom(1, 2, 1, 2),
			lexeme:   '[',
			operator: '[',
			info:     {},
			accessed: {
				type:      RType.Symbol,
				location:  rangeFrom(1, 1, 1, 1),
				namespace: undefined,
				lexeme:    'a',
				content:   'a',
				info:      {}
			},
			access: [{
				type:     RType.Argument,
				location: rangeFrom(1, 3, 1, 3),
				lexeme:   '3',
				name:     undefined,
				info:     {},
				value:    {
					type:     RType.Number,
					location: rangeFrom(1, 3, 1, 3),
					lexeme:   '3',
					content:  numVal(3),
					info:     {}
				}
			}, {
				type:     RType.Argument,
				location: rangeFrom(1, 5, 1, 5),
				lexeme:   '2',
				name:     undefined,
				info:     {},
				value:    {
					type:     RType.Number,
					location: rangeFrom(1, 5, 1, 5),
					lexeme:   '2',
					content:  numVal(2),
					info:     {}
				}
			}]
		}))
		assertAst('Multiple with empty', shell, 'a[,2,4]', exprList({
			type:     RType.Access,
			location: rangeFrom(1, 2, 1, 2),
			lexeme:   '[',
			operator: '[',
			info:     {},
			accessed: {
				type:      RType.Symbol,
				location:  rangeFrom(1, 1, 1, 1),
				namespace: undefined,
				lexeme:    'a',
				content:   'a',
				info:      {}
			},
			access: [null, {
				type:     RType.Argument,
				location: rangeFrom(1, 4, 1, 4),
				lexeme:   '2',
				name:     undefined,
				info:     {},
				value:    {
					type:     RType.Number,
					location: rangeFrom(1, 4, 1, 4),
					lexeme:   '2',
					content:  numVal(2),
					info:     {}
				}
			}, {
				type:     RType.Argument,
				location: rangeFrom(1, 6, 1, 6),
				lexeme:   '4',
				name:     undefined,
				info:     {},
				value:    {
					type:     RType.Number,
					location: rangeFrom(1, 6, 1, 6),
					lexeme:   '4',
					content:  numVal(4),
					info:     {}
				}
			}]
		}))
		assertAst('Named argument', shell, 'a[1,super=4]', exprList({
			type:     RType.Access,
			location: rangeFrom(1, 2, 1, 2),
			lexeme:   '[',
			operator: '[',
			info:     {},
			accessed: {
				type:      RType.Symbol,
				location:  rangeFrom(1, 1, 1, 1),
				namespace: undefined,
				lexeme:    'a',
				content:   'a',
				info:      {}
			},
			access: [{
				type:     RType.Argument,
				location: rangeFrom(1, 3, 1, 3),
				lexeme:   '1',
				name:     undefined,
				info:     {},
				value:    {
					type:     RType.Number,
					location: rangeFrom(1, 3, 1, 3),
					lexeme:   '1',
					content:  numVal(1),
					info:     {}
				}
			}, {
				type:     RType.Argument,
				location: rangeFrom(1, 5, 1, 9),
				lexeme:   'super',
				name:     {
					type:      RType.Symbol,
					location:  rangeFrom(1, 5, 1, 9),
					namespace: undefined,
					lexeme:    'super',
					content:   'super',
					info:      {}
				},
				info:  {},
				value: {
					type:     RType.Number,
					location: rangeFrom(1, 11, 1, 11),
					lexeme:   '4',
					content:  numVal(4),
					info:     {}
				}
			}]
		}))
		assertAst('Chained', shell, 'a[1][4]', exprList({
			type:     RType.Access,
			location: rangeFrom(1, 5, 1, 5),
			lexeme:   '[',
			operator: '[',
			info:     {},
			accessed: {
				type:     RType.Access,
				location: rangeFrom(1, 2, 1, 2),
				lexeme:   '[',
				operator: '[',
				info:     {},
				accessed: {
					type:      RType.Symbol,
					location:  rangeFrom(1, 1, 1, 1),
					namespace: undefined,
					lexeme:    'a',
					content:   'a',
					info:      {}
				},
				access: [{
					type:     RType.Argument,
					location: rangeFrom(1, 3, 1, 3),
					lexeme:   '1',
					name:     undefined,
					info:     {},
					value:    {
						type:     RType.Number,
						location: rangeFrom(1, 3, 1, 3),
						lexeme:   '1',
						content:  numVal(1),
						info:     {}
					}
				}]
			},
			access: [{
				type:     RType.Argument,
				location: rangeFrom(1, 6, 1, 6),
				lexeme:   '4',
				name:     undefined,
				info:     {},
				value:    {
					type:     RType.Number,
					location: rangeFrom(1, 6, 1, 6),
					lexeme:   '4',
					content:  numVal(4),
					info:     {}
				}
			}]
		}))
	})
	describe('Double bracket', () => {
		assertAst('Empty', shell, 'b[[]]', [
			{
				step:   NORMALIZE,
				wanted: exprList({
					type:     RType.Access,
					location: rangeFrom(1, 2, 1, 3),
					lexeme:   '[[',
					operator: '[[',
					info:     {},
					accessed: {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'b',
						content:   'b',
						info:      {}
					},
					access: []
				})
			},
			{
				step:   DESUGAR_NORMALIZE,
				wanted: exprList({
					type:         RType.FunctionCall,
					info:         {},
					lexeme:       '[[',
					functionName: {
						type:      RType.Symbol,
						lexeme:    '[[',
						content:   '[[',
						info:      {},
						location:  rangeFrom(1, 2, 1, 3),
						namespace: InternalScope
					},
					location:  rangeFrom(1, 2, 1, 3),
					flavor:    'named',
					arguments: [{
						type:      RType.Symbol,
						lexeme:    'b',
						content:   'b',
						info:      {},
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined
					}]
				})
			}
		])
		assertAst('One element', shell, 'b[[5]]', [
			{
				step:   NORMALIZE,
				wanted: exprList({
					type:     RType.Access,
					location: rangeFrom(1, 2, 1, 3),
					lexeme:   '[[',
					operator: '[[',
					info:     {},
					accessed: {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'b',
						content:   'b',
						info:      {}
					},
					access: [{
						type:     RType.Argument,
						location: rangeFrom(1, 4, 1, 4),
						lexeme:   '5',
						name:     undefined,
						info:     {},
						value:    {
							type:     RType.Number,
							location: rangeFrom(1, 4, 1, 4),
							lexeme:   '5',
							content:  numVal(5),
							info:     {}
						}
					}]
				})
			},
			{
				step:   DESUGAR_NORMALIZE,
				wanted: exprList({
					type:         RType.FunctionCall,
					info:         {},
					location:     rangeFrom(1, 2, 1, 3),
					lexeme:       '[[',
					functionName: {
						type:      RType.Symbol,
						lexeme:    '[[',
						content:   '[[',
						info:      {},
						location:  rangeFrom(1, 2, 1, 3),
						namespace: InternalScope
					},
					flavor:    'named',
					arguments: [{
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'b',
						content:   'b',
						info:      {}
					}, {
						type:     RType.Number,
						location: rangeFrom(1, 4, 1, 4),
						lexeme:   '5',
						content:  numVal(5),
						info:     {}
					}]
				})
			}
		])
		assertAst('Multiple', shell, 'b[[5,3]]', [
			{
				step:   NORMALIZE,
				wanted: exprList({
					type:     RType.Access,
					location: rangeFrom(1, 2, 1, 3),
					lexeme:   '[[',
					operator: '[[',
					info:     {},
					accessed: {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'b',
						content:   'b',
						info:      {}
					},
					access: [{
						type:     RType.Argument,
						location: rangeFrom(1, 4, 1, 4),
						lexeme:   '5',
						name:     undefined,
						info:     {},
						value:    {
							type:     RType.Number,
							location: rangeFrom(1, 4, 1, 4),
							lexeme:   '5',
							content:  numVal(5),
							info:     {}
						}
					}, {
						type:     RType.Argument,
						location: rangeFrom(1, 6, 1, 6),
						lexeme:   '3',
						name:     undefined,
						info:     {},
						value:    {
							type:     RType.Number,
							location: rangeFrom(1, 6, 1, 6),
							lexeme:   '3',
							content:  numVal(3),
							info:     {}
						}
					}]
				})
			},
			{
				step:   DESUGAR_NORMALIZE,
				wanted: exprList({
					type:         RType.FunctionCall,
					location:     rangeFrom(1, 2, 1, 3),
					lexeme:       '[[',
					info:         {},
					functionName: {
						type:      RType.Symbol,
						lexeme:    '[[',
						content:   '[[',
						info:      {},
						location:  rangeFrom(1, 2, 1, 3),
						namespace: InternalScope
					},
					flavor:    'named',
					arguments: [{
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'b',
						content:   'b',
						info:      {}
					}, {
						type:     RType.Number,
						location: rangeFrom(1, 4, 1, 4),
						lexeme:   '5',
						content:  numVal(5),
						info:     {}
					},  {
						type:     RType.Number,
						location: rangeFrom(1, 6, 1, 6),
						lexeme:   '3',
						content:  numVal(3),
						info:     {}
					}]
				})
			}
		])
		assertAst('Multiple with empty', shell, 'b[[5,,]]', [
			{
				step:   NORMALIZE,
				wanted: exprList({
					type:     RType.Access,
					location: rangeFrom(1, 2, 1, 3),
					lexeme:   '[[',
					operator: '[[',
					info:     {},
					accessed: {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'b',
						content:   'b',
						info:      {}
					},
					access: [{

						type:     RType.Argument,
						location: rangeFrom(1, 4, 1, 4),
						lexeme:   '5',
						name:     undefined,
						info:     {},
						value:    {
							type:     RType.Number,
							location: rangeFrom(1, 4, 1, 4),
							lexeme:   '5',
							content:  numVal(5),
							info:     {}
						}
					}, null, null]
				})
			},
			{
				step:   DESUGAR_NORMALIZE,
				wanted: exprList({
					type:         RType.FunctionCall,
					location:     rangeFrom(1, 2, 1, 3),
					lexeme:       '[[',
					info:         {},
					functionName: {
						type:      RType.Symbol,
						lexeme:    '[[',
						content:   '[[',
						info:      {},
						location:  rangeFrom(1, 2, 1, 3),
						namespace: InternalScope
					},
					flavor:    'named',
					arguments: [{
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'b',
						content:   'b',
						info:      {}
					}, {
						type:     RType.Number,
						location: rangeFrom(1, 4, 1, 4),
						lexeme:   '5',
						content:  numVal(5),
						info:     {}
					}, undefined, undefined]
				})
			}
		])
	})
	describe('Dollar and Slot', () => {
		assertAst('Dollar access', shell, 'c$x', [
			{
				step:   NORMALIZE,
				wanted: exprList({
					type:     RType.Access,
					location: rangeFrom(1, 2, 1, 2),
					lexeme:   '$',
					operator: '$',
					info:     {},
					accessed: {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'c',
						content:   'c',
						info:      {}
					},
					access: 'x'
				})
			},
			{
				step:   DESUGAR_NORMALIZE,
				wanted: exprList({
					type:         RType.FunctionCall,
					location:     rangeFrom(1, 2, 1, 2),
					lexeme:       '$',
					info:         {},
					functionName: {
						type:      RType.Symbol,
						lexeme:    '$',
						content:   '$',
						info:      {},
						location:  rangeFrom(1, 2, 1, 2),
						namespace: InternalScope
					},
					flavor:    'named',
					arguments: [{
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'c',
						content:   'c',
						info:      {}
					}, {
						type:      RType.Symbol,
						location:  rangeFrom(1, 3, 1, 3),
						namespace: undefined,
						lexeme:    'x',
						content:   'x',
						info:      {}
					}]
				})
			}
		])
		assertAst('Slot based access', shell, 'd@y', [
			{
				step:   NORMALIZE,
				wanted: exprList({
					type:     RType.Access,
					location: rangeFrom(1, 2, 1, 2),
					lexeme:   '@',
					operator: '@',
					info:     {},
					accessed: {
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'd',
						content:   'd',
						info:      {}
					},
					access: 'y'
				})
			},
			{
				step:   DESUGAR_NORMALIZE,
				wanted: exprList({
					type:         RType.FunctionCall,
					location:     rangeFrom(1, 2, 1, 2),
					lexeme:       '@',
					info:         {},
					functionName: {
						type:      RType.Symbol,
						lexeme:    '@',
						content:   '@',
						info:      {},
						location:  rangeFrom(1, 2, 1, 2),
						namespace: InternalScope
					},
					flavor:    'named',
					arguments: [{
						type:      RType.Symbol,
						location:  rangeFrom(1, 1, 1, 1),
						namespace: undefined,
						lexeme:    'd',
						content:   'd',
						info:      {}
					}, {
						type:      RType.Symbol,
						location:  rangeFrom(1, 3, 1, 3),
						namespace: undefined,
						lexeme:    'y',
						content:   'y',
						info:      {}
					}]
				})
			}
		])
	})
}))
