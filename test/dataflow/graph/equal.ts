import { DataflowGraph, diffGraphsToMermaidUrl } from '../../../src/dataflow'
import { assert } from 'chai'

function test(cmp: (x: boolean) => void, a: DataflowGraph, b: DataflowGraph, text: string) {
	try {
		cmp(a.equals(b))
	} catch (e) {
		// only calculate the dataflow graphs if it fials
		const diff = diffGraphsToMermaidUrl({ label: 'left', graph: a }, { label: 'right', graph: b }, undefined, '')
		console.error(text + '; diff:\n', diff)
		throw e
	}
}

describe('Graph Equality', () => {
	const raw = (name: string, a: DataflowGraph, b: DataflowGraph, text: string, cmp: (x: boolean) => void) => {
		return it(name, () => {
			// as the comparison is relatively quick, we allow explicit checks for commutativity
			test(cmp, a, b, 'a;b' + text)
			test(cmp, b, a, 'b;a' + text)
		})
	}

	describe('positive', () => {
		const eq = (name: string, a: DataflowGraph, b: DataflowGraph) => {
			raw(name, a, b, 'should be equal', x => assert.isTrue(x))
		}

		eq('Empty graphs', new DataflowGraph(), new DataflowGraph())
		eq('Same vertex', new DataflowGraph().addVertex({ id: '0', name: 'x', tag: 'use' }), new DataflowGraph().addVertex({ id: '0', name: 'x', tag: 'use' }))
	})
	describe('negative', () => {
		const neq = (name: string, a: DataflowGraph, b: DataflowGraph) => {
			raw(name, a, b, 'should differ', x => assert.isFalse(x))
		}
		neq('Additional root vertex', new DataflowGraph(), new DataflowGraph().addVertex({ id: '0', name: 'x', tag: 'use' }))
		neq('Additional non-root vertex', new DataflowGraph(), new DataflowGraph().addVertex({ id: '0', name: 'x', tag: 'use' }, false))
	})
})
