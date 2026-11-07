import { assertDataflow, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { describe } from 'vitest';
import { BuiltInOperators } from '../../../../../src/dataflow/environments/default-builtin-config/operators';


describe('Context Assignments', { concurrent: false }, withShell(shell => {
	describe('Table Assignment', () => {
		assertDataflow(label('Assign single bracket', ['name-normal', 'function-calls', 'functions-with-global-side-effects', 'implicit-return', 'strings', 'unnamed-arguments', ...BuiltInOperators.byName['<-'].capabilities, 'newlines']),
			shell, `
iris[,foo:=sample(bar),]
print(iris)
			`,  emptyGraph()
				.defineVariable('2@iris', undefined, { cds: [] }) // a classic maybe definition :)
				.use('3@iris')
				.reads('3@iris', '2@iris')
				.definedBy('2@iris', '2:10'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true
			});
	});
}));
