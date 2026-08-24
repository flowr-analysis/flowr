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

	/* `setClass` writes the string-keyed class registry, which is what `new` reads to build an instance */
	assertDataflow(label('S4 new reads its class registration', ['function-calls', 'oop-s4']), ts,
		`
setClass("P", representation(s = "numeric"))
o <- new("P", s = 1)
`, emptyGraph()
			.reads('3@new', '2@setClass')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);

	/* a method answers a generic that has to exist, so it reads whatever created it */
	assertDataflow(label('S4 setMethod reads the generic it answers', ['function-calls', 'oop-s4']), ts,
		`
setGeneric("sz", function(x) standardGeneric("sz"))
setMethod("sz", "numeric", function(x) x * 3)
`, emptyGraph()
			.reads('3@setMethod', '2@setGeneric')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);

	/* `contains =` names a class that has to be registered first */
	assertDataflow(label('S4 setClass reads the class it extends', ['function-calls', 'oop-s4']), ts,
		`
setClass("A", representation(x = "numeric"))
setClass("B", contains = "A")
`, emptyGraph()
			.reads('3@setClass', '2@setClass')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
}));