import { assertDataflow, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';


describe.sequential('Context Assignments', withShell(shell => {
	describe('Table Assignment', () => {
		assertDataflow(label('Assign single bracket', ['name-normal', 'function-calls', 'functions-with-global-side-effects', 'implicit-return', 'strings', 'unnamed-arguments', ...OperatorDatabase['<-'].capabilities, 'newlines']),
			shell, `
iris[,foo:=sample(bar),]
print(iris)
			`,  emptyGraph()
				.defineVariable('2@iris', undefined, { controlDependencies: [] }) // a classic maybe definition :)
				.use('3@iris')
				.reads('3@iris', '2@iris')
				.definedBy('2@iris', '2:10')
			,
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true
			});
	});
}));
