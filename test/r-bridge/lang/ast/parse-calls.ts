import { assertAst, withShell } from '../../../helper/shell'
import * as Lang from '../../../../src/r-bridge/lang:4.x/ast/model'
import { exprList, numVal } from '../../../helper/ast-builder'
import {
  RArithmeticBinaryOpPool,
  RArithmeticUnaryOpPool,
  RLogicalBinaryOpPool,
  RLogicalUnaryOpPool, RUnaryOpPool
} from '../../../helper/provider'
import { type RShell } from '../../../../src/r-bridge/shell'
import { rangeFrom } from '../../../../src/util/range'

describe('5. Parse function calls', withShell(shell => {
  describe('5.1 functions without arguments', () => {
    assertAst('f()', shell, 'f()', exprList({
      type:         Lang.Type.FunctionCall,
      location:     rangeFrom(1, 1, 1, 1),
      lexeme:       'f', // TODO: make this more sensible?
      functionName: {
        type:      Lang.Type.Symbol,
        location:  rangeFrom(1, 1, 1, 1),
        lexeme:    'f',
        content:   'f',
        namespace: undefined,
      },
      parameters: []
    }))
  })
  describe('5.2 functions with arguments', () => {

  })
  describe('5.3 functions with named arguments', () => {

  })
  describe('5.4 functions with explicit namespacing', () => {
    assertAst('x::f()', shell, 'x::f()', exprList({
      type:         Lang.Type.FunctionCall,
      location:     rangeFrom(1, 1, 1, 4),
      lexeme:       'x::f', // TODO: make this more sensible?
      functionName: {
        type:      Lang.Type.Symbol,
        location:  rangeFrom(1, 4, 1, 4),
        lexeme:    'f',
        content:   'f',
        namespace: 'x',
      },
      parameters: []
    }))
  })
  // TODO: identify the correct namespace otherwise (statically this is surely limited :c )
}))
