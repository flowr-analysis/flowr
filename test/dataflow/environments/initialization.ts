import { GlobalScope, initializeCleanEnvironments, LocalScope } from '../../../src/dataflow'
import { expect } from 'chai'

describe('Initialization', () => {
  it('Clean creation should have no info', () => {
    const clean = initializeCleanEnvironments()
    expect(clean.global, 'there should be a new global environment').to.be.not.undefined
    expect(clean.global.map, 'the global environment should be empty').to.have.length(0)
    expect(clean.global.name, 'the global environment must have the correct name').to.be.equal(GlobalScope)
    expect(clean.local, 'there should be on e local environment').to.have.length(1)
    expect(clean.local[0].map, 'the default local environment should be empty').to.have.length(0)
    expect(clean.local[0].name, 'the default local environment must have the correct name').to.be.equal(LocalScope)
    expect(clean.named, 'there should be no named environments').to.be.empty
  })
  it('Clean creation should create independent new environments', () => {
    const clean = initializeCleanEnvironments()
    clean.local.push({ name: 'test', map: new Map() })
    const second = initializeCleanEnvironments()
    expect(second.local, 'the new one should be independent').to.have.length(1)
    expect(clean.local, 'the old one should still have the additions').to.have.length(2)
  })
})
