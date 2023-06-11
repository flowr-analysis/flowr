import { Environment, GlobalScope, initializeCleanEnvironments } from '../../../src/dataflow'
import { expect } from 'chai'

describe('Initialization', () => {
  it('Clean creation should have no info', () => {
    const clean = initializeCleanEnvironments()
    expect(clean.current,'there should be a current environment').to.be.not.undefined
    expect(clean.current.memory, 'the current environment should be empty').to.have.length(0)
    expect(clean.current.name, 'the current environment must have the correct scope name').to.be.equal(GlobalScope)
    expect(clean.level, 'the level of the clean environment is predefined as 0').to.be.equal(0)
  })
  it('Clean creation should create independent new environments', () => {
    const clean = initializeCleanEnvironments()
    clean.current.parent = new Environment('test')

    const second = initializeCleanEnvironments()
    expect(second.current.parent, 'the new one should not have a parent ').to.be.undefined
    expect(clean.current.parent, 'the old one should still have the parent').to.be.not.undefined
  })
})
