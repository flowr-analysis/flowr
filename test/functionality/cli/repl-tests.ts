import { assert } from 'chai'
import { replCompleter } from '../../../src/cli/repl'
import { benchmarkOptions } from '../../../src/cli/common/options'

describe('Repl', () => {
	describe('completer', () => {
		describe('basic find', () =>
			assert.deepStrictEqual([[':slicer'], ':slice'], replCompleter(':slice'), 'standard replCompleter not producing expected result')
            
		)
		describe('find all options', () => {
			const optionsList: string[] = []
			for(const [,{name, alias}] of Object.entries(benchmarkOptions)){
				optionsList.push('--' + name)
				if(alias !== undefined){
					optionsList.push('-' + alias)
				}
			}
			optionsList.push(' ')
			const resultCompleter = replCompleter(':benchmark ')
			assert.includeMembers(resultCompleter[0], optionsList, 'Additional options that should not be there')
			assert.includeMembers(optionsList, resultCompleter[0], 'Options missing in the expected Result')
			assert.strictEqual(resultCompleter[1], ':benchmark ')
		})
	})
})