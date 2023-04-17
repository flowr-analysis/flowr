import { assertAst, describeSession } from '../../helper/shell'
import * as Lang from '../../../../src/r-bridge/lang:4.x/ast/model'
import { exprList, numVal } from '../../helper/ast-builder'

describe('1. Parse simple constructs', () => {
  describeSession('1.1 if-then (spacing and line variants)', shell => {
    for (const variant of [{
      str: 'if(TRUE)1',
      locationTrue: Lang.rangeFrom(1, 4, 1, 7),
      locationNum: Lang.rangeFrom(1, 9, 1, 9),
      num: 1
    },
    {
      str: 'if(TRUE) 1',
      locationTrue: Lang.rangeFrom(1, 4, 1, 7),
      locationNum: Lang.rangeFrom(1, 10, 1, 10),
      num: 1
    },
    {
      str: 'if (TRUE) 1',
      locationTrue: Lang.rangeFrom(1, 5, 1, 8),
      locationNum: Lang.rangeFrom(1, 11, 1, 11),
      num: 1
    },
    {
      str: 'if     (TRUE)  42',
      locationTrue: Lang.rangeFrom(1, 9, 1, 12),
      locationNum: Lang.rangeFrom(1, 16, 1, 17),
      num: 42
    },
    {
      str: 'if\n(TRUE)1',
      locationTrue: Lang.rangeFrom(2, 2, 2, 5),
      locationNum: Lang.rangeFrom(2, 7, 2, 7),
      num: 1
    },
    {
      str: 'if(TRUE)\n1',
      locationTrue: Lang.rangeFrom(1, 4, 1, 7),
      locationNum: Lang.rangeFrom(2, 1, 2, 1),
      num: 1
    },
    {
      str: 'if\n(\nTRUE\n)\n1',
      locationTrue: Lang.rangeFrom(3, 1, 3, 4),
      locationNum: Lang.rangeFrom(5, 1, 5, 1),
      num: 1
    }]) {
      const strNum = `${variant.num}`
      assertAst(JSON.stringify(variant.str), shell, variant.str, exprList({
        type: Lang.Type.If,
        // TODO: maybe merge in future?
        location: Lang.rangeFrom(1, 1, 1, 2),
        lexeme: 'if',
        condition: {
          type: Lang.Type.Boolean,
          location: variant.locationTrue,
          lexeme: 'TRUE',
          content: true
        },
        then: {
          type: Lang.Type.Number,
          location: variant.locationNum,
          lexeme: strNum,
          content: numVal(variant.num)
        }
      }))
    }
  })
})
