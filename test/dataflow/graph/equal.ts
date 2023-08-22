import { DataflowGraph, diffGraphsToMermaidUrl } from '../../../src/dataflow'
import { assert } from 'chai'

describe('Graph Equality', () => {
	const assertsEquals = (name: string, a: DataflowGraph, b: DataflowGraph) => {
		return it(name, () => {
			// only calculate the dataflow graphs if not
			try {
				assert.isTrue(a.equals(b))
			} catch (e) {
				const diff = diffGraphsToMermaidUrl({ label: 'left', graph: a }, { label: 'right', graph: b }, undefined, '')
				console.error('diff:\n', diff)
				throw e
			}
		})
	}

	assertsEquals('Empty graphs', new DataflowGraph(), new DataflowGraph())
})
