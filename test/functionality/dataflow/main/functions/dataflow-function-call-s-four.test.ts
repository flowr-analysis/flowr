import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';

describe('S4 Function Calls', withTreeSitter(ts => {
	assertDataflow(label('S4 setMethod', ['function-calls', 'oop-s4']), ts,
		`
setMethod("age", "Person", function(x) x)
setMethod("age<-", "Person", function(x, value) x)

age(j) <- 50
print(age(j))
`, emptyGraph()
			.calls('5@age', '3@function')
			.calls('6@age', '2@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
}));