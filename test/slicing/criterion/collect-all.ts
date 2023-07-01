import {
  collectAllSlicingCriteria,
  DefaultAllVariablesFilter,
  SlicingCriteriaFilter,
  convertAllSlicingCriteriaToIds,
  SlicingCriteria
} from '../../../src/slicing'
import { decorateAst, RShell } from '../../../src/r-bridge'
import { retrieveAst, withShell } from '../../helper/shell'
import { assert } from 'chai'

function assertRetrievedIdsWith(shell: RShell, name: string, input: string, filter: SlicingCriteriaFilter, ...expected: SlicingCriteria[]) {
  return it(name, async() => {
    const ast = await retrieveAst(shell, input)
    const decorated = decorateAst(ast)
    const got = [...collectAllSlicingCriteria(decorated.decoratedAst, filter)]
      .flatMap(criteria => convertAllSlicingCriteriaToIds(criteria, decorated))
      .map(m => m.id)
    const expectedMapped = expected
      .flatMap(criteria => convertAllSlicingCriteriaToIds(criteria, decorated))

    assert.deepStrictEqual(got, expectedMapped.map(m => m.id), `mapped: ${JSON.stringify(expectedMapped)}`)
  })
}

describe('Retrieve all slicing locations', withShell(shell => {
  describe('Test the default all variables filter', () => {
    function test(input: string, ...expected: SlicingCriteria[]) {
      assertRetrievedIdsWith(shell, `Retrieve all variables in ${JSON.stringify(input)}`, input, DefaultAllVariablesFilter, ...expected)
    }
    test('x <- 1', [ '1@x' ])
    test('x <- 1\ny <- 2', [ '1@x' ], [ '2@y' ])
    test('library(foo)', [ ]) // here, foo is not a variable but used as the library name - TODO: we do not deal with character.only at the moment
    test(`a <- 52
foo(a=3,b<-2,c=4)
if(TRUE) {
  while(a > 3) {
    a = a - 1
  }
  foo <<- function(x) {
    x + 1
  }
  a - 1 -> a
}
foo(5)`, [ '1@a' ], [ '2@b' ], [ '4@a' ], [ '5:5' ], [ '5:9' ], [ '7@foo' ], [ '8@x' ], [ '10:3' ], [ '10:12' ])
  })
}))
