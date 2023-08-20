import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, EdgeType, initializeCleanEnvironments } from '../../../../src/dataflow'
import { appendEnvironments, define, LocalScope } from '../../../../src/dataflow/environments'

describe('for', withShell(shell => {
	assertDataflow(`Single-vector for Loop`,
		shell,
		`for(i in 0) i `,
		new DataflowGraph()
			.addVertex( { tag: 'variable-definition', id: "0", name: "i", scope: LocalScope })
			.addVertex( { tag: 'use', id: "2", name: "i", when: 'maybe', environment: define({ nodeId: "0", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "4", used: 'always' }, LocalScope, initializeCleanEnvironments()) })
			.addEdge("2", "0", EdgeType.Reads, "maybe")
	)

	describe('Potential redefinition with break', () => {
		const withXDefined = define({ nodeId: "0", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "2", used: 'always' }, LocalScope, initializeCleanEnvironments())
		const otherXDefined = define({ nodeId: "7", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "9", used: 'maybe' }, LocalScope, initializeCleanEnvironments())
		assertDataflow(`Potential redefinition inside the same loop`,
			shell,
			`repeat {
  x <- 2
  if(z) break
  x <- 3
}
x`,
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
				.addVertex( { tag: 'variable-definition', id: "7", name: "x", scope: LocalScope, environment: withXDefined })
				.addVertex( { tag: 'use', id: "3", name: "z", scope: LocalScope, environment: withXDefined })
				.addVertex( { tag: 'use', id: "12", name: "x", when: 'always', environment: appendEnvironments(withXDefined, otherXDefined) })
				.addEdge("12", "0", EdgeType.Reads, "always")
				.addEdge("12", "7", EdgeType.Reads, "maybe")
				.addEdge("0", "7", EdgeType.SameDefDef, "maybe")
		)
	})

	const envWithX = () => define({ nodeId: "0", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "2", used: 'always' }, LocalScope, initializeCleanEnvironments())
	assertDataflow(`Read in for Loop`,
		shell,
		`x <- 12\nfor(i in 1:10) x `,
		new DataflowGraph()
			.addVertex( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
			.addVertex( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope, environment: envWithX() })
			.addVertex( { tag: 'use', id: "7", name: "x", when: 'maybe', environment: define({ nodeId: "3", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "9", used: 'always' }, LocalScope, envWithX()) })
			.addEdge("7", "0", EdgeType.Reads, "maybe")
	)
	const envWithI = () => define({ nodeId: "0", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "8", used: 'always' }, LocalScope, initializeCleanEnvironments())
	assertDataflow(`Read after for loop`,
		shell,
		`for(i in 1:10) { x <- 12 }\n x`,
		new DataflowGraph()
			.addVertex( { tag: 'variable-definition', id: "0", name: "i", scope: LocalScope })
			.addVertex( { tag: 'variable-definition', id: "4", name: "x", scope: LocalScope, when: 'maybe', environment: envWithI() })
			.addVertex( { tag: 'use', id: "9", name: "x", environment: define({ nodeId: "4", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "6", used: 'maybe' }, LocalScope, envWithI()) })
			.addEdge("9", "4", EdgeType.Reads, "maybe")
	)


	const envWithFirstX = () => define({ nodeId: "0", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "2", used: 'always' }, LocalScope, initializeCleanEnvironments())
	const envInFor = () => define({ nodeId: "3", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "11", used: 'always' }, LocalScope,
		envWithFirstX()
	)

	const envOutFor = () => define({ nodeId: "3", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "11", used: 'always' }, LocalScope,
		define({ nodeId: "0", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "2", used: 'always' }, LocalScope, initializeCleanEnvironments())
	)

	const envWithSecondX = () => define({ nodeId: "7", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "9", used: 'maybe' }, LocalScope,
		initializeCleanEnvironments()
	)

	assertDataflow(`Read after for loop with outer def`,
		shell,
		`x <- 9\nfor(i in 1:10) { x <- 12 }\n x`,
		new DataflowGraph()
			.addVertex( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
			.addVertex( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope, environment: envWithFirstX() })
			.addVertex( { tag: 'variable-definition', id: "7", name: "x", when: 'maybe', scope: LocalScope, environment: envInFor() })
			.addVertex( { tag: 'use', id: "12", name: "x", environment: appendEnvironments(envOutFor(), envWithSecondX()) })
			.addEdge("12", "0", EdgeType.Reads, "always")
			.addEdge("12", "7", EdgeType.Reads, "maybe")
			.addEdge("0", "7", EdgeType.SameDefDef, "maybe")
	)
	assertDataflow(`Redefinition within loop`,
		shell,
		`x <- 9\nfor(i in 1:10) { x <- x }\n x`,
		new DataflowGraph()
			.addVertex( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
			.addVertex( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope, environment: envWithFirstX()})
			.addVertex( { tag: 'variable-definition', id: "7", name: "x", scope: LocalScope, when: 'maybe', environment: envInFor() })
			.addVertex( { tag: 'use', id: "8", name: "x", when: 'maybe', environment: envInFor() })
			.addVertex( { tag: 'use', id: "12", name: "x", environment: appendEnvironments(envOutFor(), envWithSecondX()) })
			.addEdge("12", "0", EdgeType.Reads, "always")
			.addEdge("12", "7", EdgeType.Reads, "maybe")
			.addEdge("8", "0", EdgeType.Reads, "maybe")
			.addEdge("8", "7", EdgeType.Reads, "maybe")
			.addEdge("7", "8", EdgeType.DefinedBy, "always")
			.addEdge("0", "7", EdgeType.SameDefDef, "maybe")
	)

	const envInLargeFor = () => define({ nodeId: "3", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "14", used: 'always' }, LocalScope,
		envWithFirstX()
	)

	const envInLargeFor2 = () => define({ nodeId: "7", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "9", used: 'always' }, LocalScope,
		envInLargeFor()
	)

	const envOutLargeFor = () => define({ nodeId: "10", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "12", used: 'maybe' }, LocalScope,
		envInLargeFor()
	)

	assertDataflow(`Redefinition within loop`,
		shell,
		`x <- 9\nfor(i in 1:10) { x <- x; x <- x }\n x`,
		new DataflowGraph()
			.addVertex( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
			.addVertex( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope, environment: envWithFirstX() })
			.addVertex( { tag: 'variable-definition', id: "7", name: "x", when: 'maybe', scope: LocalScope, environment: envInLargeFor() })
			.addVertex( { tag: 'use', id: "8", name: "x", when: 'maybe', environment: envInLargeFor() })
			.addVertex( { tag: 'variable-definition', id: "10", name: "x", when: 'maybe', scope: LocalScope, environment: envInLargeFor2() })
			.addVertex( { tag: 'use', id: "11", name: "x", when: 'always' /* TODO: this is wrong, but uncertainty is not fully supported in the impl atm.*/, environment: envInLargeFor2() })
			.addVertex( { tag: 'use', id: "15", name: "x", environment: appendEnvironments(envWithFirstX(), envOutLargeFor()) })
			.addEdge("11", "7", EdgeType.Reads, "always")// second x <- *x* always reads first *x* <- x
			.addEdge("8", "0", EdgeType.Reads, "maybe")
			.addEdge("8", "10", EdgeType.Reads, "maybe")
			.addEdge("15", "0", EdgeType.Reads, "always")
			.addEdge("15", "10", EdgeType.Reads, "maybe")
			.addEdge("7", "8", EdgeType.DefinedBy, "always")
			.addEdge("10", "11", EdgeType.DefinedBy, "always")
			.addEdge("0", "7", EdgeType.SameDefDef, "maybe")
			.addEdge("0", "10", EdgeType.SameDefDef, "maybe")
			.addEdge("7", "10", EdgeType.SameDefDef, "always") // both in same loop execution
	)

	const forLoopWithI = () => define({ nodeId: "0", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "9", used: 'always' }, LocalScope,
		initializeCleanEnvironments()
	)

	const forLoopWithIAfter = () => define({ nodeId: "0", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "9", used: 'maybe' }, LocalScope,
		initializeCleanEnvironments()
	)
	const forLoopAfterI = () => define({ nodeId: "5", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "7", used: 'maybe' }, LocalScope,
		initializeCleanEnvironments()
	)
	assertDataflow(`Redefinition within loop`,
		shell,
		`for(i in 1:10) { i; i <- 12 }\n i`,
		new DataflowGraph()
			.addVertex( { tag: 'variable-definition', id: "0", name: "i", scope: LocalScope })
			.addVertex( { tag: 'variable-definition', id: "5", name: "i", scope: LocalScope, when: 'maybe', environment: forLoopWithI() })
			.addVertex( { tag: 'use', id: "4", name: "i", when: 'maybe', environment: forLoopWithI() })
			.addVertex( { tag: 'use', id: "10", name: "i", environment: appendEnvironments(forLoopWithIAfter(), forLoopAfterI()) })
			.addEdge("4", "0", EdgeType.Reads, "maybe")
			.addEdge("10", "5", EdgeType.Reads, "maybe")
			.addEdge("10", "0", EdgeType.Reads, "maybe")
			.addEdge("5", "0", EdgeType.SameDefDef, "always")
	)
}))
