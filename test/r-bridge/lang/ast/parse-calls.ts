import { assertAst, withShell } from '../../../helper/shell'
import * as Lang from '../../../../src/r-bridge/lang:4.x/ast/model'
import { exprList, numVal } from '../../../helper/ast-builder'
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
    assertAst('f(1, 2)', shell, 'f(1, 2)', exprList({
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
      parameters: [
        {
          type:     Lang.Type.Number,
          location: rangeFrom(1, 3, 1, 3),
          lexeme:   '1',
          content:  numVal(1)
        },
        {
          type:     Lang.Type.Number,
          location: rangeFrom(1, 6, 1, 6),
          lexeme:   '2',
          content:  numVal(2)
        }
      ]
    }))
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
