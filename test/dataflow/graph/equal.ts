import { DataflowGraph, diffGraphsToMermaidUrl } from '../../../src/dataflow'
import { assert } from 'chai'

describe('Graph Equality', () => {
	const raw = (name: string, a: DataflowGraph, b: DataflowGraph, text: string, cmp: (x: boolean) => void) => {
		return it(name, () => {
			// only calculate the dataflow graphs if not
			try {
				cmp(a.equals(b))
			} catch (e) {
				const diff = diffGraphsToMermaidUrl({ label: 'left', graph: a }, { label: 'right', graph: b }, undefined, '')
				console.error(text + '; diff:\n', diff)
				throw e
			}
		})
	}

	describe('positive', () => {
	// as the comparison is really quick, we allow explicit checks for commutativity
		const eq = (name: string, a: DataflowGraph, b: DataflowGraph) => {
			describe(name, () => {
				raw('a==b', a, b, 'should be equal', x => assert.isTrue(x))
				raw('b==a', b, a, 'should be equal', x => assert.isTrue(x))
			})
		}

		eq('Empty graphs', new DataflowGraph(), new DataflowGraph())
	})
	describe('negative', () => {
		const neq = (name: string, a: DataflowGraph, b: DataflowGraph) => {
			describe(name, () => {
				raw('a!=b', a, b, 'should differ', x => assert.isFalse(x))
				raw('b!=a', b, a, 'should differ', x => assert.isFalse(x))
			})
		}
		neq('Additional root vertex', new DataflowGraph(), new DataflowGraph().addVertex({ id: '0', name: 'x', tag: 'use' }))
		neq('Additional non-root vertex', new DataflowGraph(), new DataflowGraph().addVertex({ id: '0', name: 'x', tag: 'use' }, false))
	})
})
