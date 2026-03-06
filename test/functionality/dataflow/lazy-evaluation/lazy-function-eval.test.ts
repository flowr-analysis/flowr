import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import { diffOfDataflowGraphs } from '../../../../src/dataflow/graph/diff-dataflow-graph';

export type AnalyzerSetupFunction = (analyzer: FlowrAnalyzer) => FlowrAnalyzer;

/**
 * Compares lazy vs eager evaluation and verifies graphs are equal while tracking stats.
 */
async function compareWithLazyStats(testCaseName: string, func: AnalyzerSetupFunction) {
	console.log(`\n► Running test case: ${testCaseName}`);

	const lazyAnalyzer = func(await new FlowrAnalyzerBuilder()
		.amendConfig((cfg) => {
			cfg.optimizations.deferredFunctionEvaluation.enabled = true;
		}).build());
	const eagerAnalyzer = func(await new FlowrAnalyzerBuilder()
		.amendConfig((cfg) => {
			cfg.optimizations.deferredFunctionEvaluation.enabled = false;
		}).build());

	const lazyDf = await lazyAnalyzer.dataflow();
	const eagerDf = await eagerAnalyzer.dataflow();

	console.log(`Lazy Functions in vertices: ${lazyDf.graph.countLazyFunctionDefinitions()}`);

	const lazyStats = lazyDf.graph.getLazyFunctionStatistics();
	const eagerStats = eagerDf.graph.getLazyFunctionStatistics();

	//lazyDf.graph.materializeAll(); // Force materialization of all lazy functions for accurate comparison

    /**
     * Compare lazy graph as subgraph of eager graph
     */

	const graphdiff = diffOfDataflowGraphs(
		{ name: 'Lazy graph', graph: lazyDf.graph },
		{ name: 'Eager graph', graph: eagerDf.graph },
		{ leftIsSubgraph: true }
	);

	let comments = graphdiff.comments() || [];
	let isEqual = graphdiff.isEqual();

	console.log(`Sub-Graph Equality: ${isEqual}`);
	if(comments.length > 0) {
		console.log(`Differences: ${comments.join(', ')}`);
		console.log(graphdiff.problematic());
	}
	assert.isTrue(isEqual, `Dataflow graphs should be equal for testCase ${testCaseName}`);

    /**
     * Compare full materialized graph to eager graph
     */

    // materialize complete graph
    lazyDf.graph.materializeAll();

	const graphdiffFull = diffOfDataflowGraphs(
		{ name: 'Lazy graph', graph: lazyDf.graph },
		{ name: 'Eager graph', graph: eagerDf.graph }
    );

	comments = graphdiffFull.comments() || [];
	isEqual = graphdiffFull.isEqual();

	console.log(`Full Graph Equality: ${isEqual}`);
	if(comments.length > 0) {
		console.log(`Differences: ${comments.join(', ')}`);
		console.log(graphdiffFull.problematic());
	}
	assert.isTrue(isEqual, `Dataflow graphs should be equal for testCase ${testCaseName}`);

	return {
		lazyStats,
		eagerStats
	};
}

// ============================================================================
// Test Cases
// ============================================================================

const _SimpleFunction: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
f <- function(a, b) {
  a + b
}

result <- f(1, 2)
`
	});
	return analyzer;
};

const UnusedFunction: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
f <- function(a, b) {
  result <- a + b
  result
}

g <- function(x, y) {
  data <- x * y
  data
}

final_result <- f(1, 2)
`
	});
	return analyzer;
};

const MultipleUnusedFunctions: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
# These functions are defined but never called
unused1 <- function(a) {
  a * 2
}

unused2 <- function(b) {
  b + 10
}

unused3 <- function(x, y, z) {
  x + y + z
}

# This function is called
compute <- function(n) {
  n ^ 2
}

result <- compute(5)
`
	});
	return analyzer;
};

const NestedUnusedFunctions: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
outer <- function(p) {
  # Unused inner function
  inner_unused <- function(q) {
    q + 1
  }

  # Used inner function
  inner_used <- function(q) {
    q * 2
  }

  data <- inner_used(p)
  data
}

value <- outer(10)
`
	});
	return analyzer;
};

const DeepCallChain: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
f1 <- function(a) {
  a + 1
}

f2 <- function(b) {
  result <- f1(b)
  result * 2
}

f3 <- function(c) {
  final <- f2(c)
  final - 1
}

# Only the deepest call is executed
output <- f3(5)
`
	});
	return analyzer;
};

const ConditionalFunctionCall: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
# Functions that may or may not be called
func_a <- function(x) {
  x + 10
}

func_b <- function(y) {
  y * 5
}

# Conditional call (dataflow doesn't follow conditions, should analyze both)
if (TRUE) {
  result <- func_a(3)
} else {
  result <- func_b(3)
}
`
	});
	return analyzer;
};

const FunctionReturnedButNotCalled: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
# Function that creates another function
make_multiplier <- function(factor) {
  multiplier <- function(x) {
    x * factor
  }
  multiplier
}

# We create a function but never call it
my_func <- make_multiplier(3)

# Direct computation
value <- 5 * 2
`
	});
	return analyzer;
};

const MutuallyRecursiveFunctions: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
# Mutually recursive functions
is_even <- function(n) {
  if(n == 0) {
    TRUE
  } else {
    is_odd(n - 1)
  }
}

is_odd <- function(n) {
  if(n == 0) {
    FALSE
  } else {
    is_even(n - 1)
  }
}

result <- is_even(4)
`
	});
	return analyzer;
};

const MutuallyRecursiveFunctionsUnknownData: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
# Mutually recursive functions
is_even <- function(n) {
  if(n == 0) {
    TRUE
  } else {
    is_odd(n - 1)
  }
}

is_odd <- function(n) {
  if(n == 0) {
    FALSE
  } else {
    is_even(n - 1)
  }
}
x <- readline()
result <- is_even(x)
`
	});
	return analyzer;
};

// ============================================================================
// Tests
// ============================================================================

describe('Basic lazy evaluation tests', () => {
	test('Single unused function is not analyzed in lazy mode', async() => {
		const result = await compareWithLazyStats('UnusedFunction', UnusedFunction);

		const stats = result.lazyStats;
		const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

		// In lazy mode, at least one function should remain lazy (the unused one)
		console.log(`Unused functions remaining lazy: ${lazyFunctionsRemaining}`);
		assert.isTrue(
			lazyFunctionsRemaining > 0,
			'Lazy mode should have skipped analysis of unused function g'
		);
	});

	test('Multiple unused functions are not analyzed in lazy mode', async() => {
		const result = await compareWithLazyStats('MultipleUnusedFunctions', MultipleUnusedFunctions);

		const stats = result.lazyStats;
		const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

		// Should have remaining lazy functions (the unused ones)
		console.log(`Functions remaining lazy: ${lazyFunctionsRemaining}`);
		assert.isTrue(
			lazyFunctionsRemaining >= 3,
			'Lazy mode should have skipped analysis of unused1, unused2, and unused3'
		);
	});
});

describe('Advanced lazy evaluation tests', () => {

	test('Nested unused functions are not analyzed in lazy mode', async() => {
		const result = await compareWithLazyStats('NestedUnusedFunctions', NestedUnusedFunctions);

		const stats = result.lazyStats;
		const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

		// The inner_unused function should remain lazy
		console.log(`Functions remaining lazy: ${lazyFunctionsRemaining}`);
		assert.isTrue(
			lazyFunctionsRemaining > 0,
			'Lazy mode should have skipped analysis of nested inner_unused function'
		);
	});
	test('Deep call chains analyze all functions in call path', async() => {
		const result = await compareWithLazyStats('DeepCallChain', DeepCallChain);

		const stats = result.lazyStats;
		const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

		// All three functions should be analyzed since they're in the call chain
		console.log(`Functions remaining lazy: ${lazyFunctionsRemaining}`);
		assert.equal(
			lazyFunctionsRemaining,
			0,
			'All functions in deep call chain should have been materialized'
		);
	});

	test('Conditional function calls analyze both branches (dataflow limitation)', async() => {
		const result = await compareWithLazyStats('ConditionalFunctionCall', ConditionalFunctionCall);

		const stats = result.lazyStats;
		const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

		// Both func_a and func_b should be analyzed since dataflow doesn't track conditionals
		console.log(`Functions remaining lazy: ${lazyFunctionsRemaining}`);
	});

});

describe('Complex Usage for lazy evaluation tests', () => {
	test('Function returned but not called is not analyzed in lazy mode', async() => {
		const result = await compareWithLazyStats('FunctionReturnedButNotCalled', FunctionReturnedButNotCalled);

		const stats = result.lazyStats;
		const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

		// The multiplier function returned but not called should remain lazy
		console.log(`Functions remaining lazy: ${lazyFunctionsRemaining}`);
		assert.isTrue(
			lazyFunctionsRemaining > 0,
			'Lazy mode should have skipped analysis of returned but non-called multiplier function'
		);
	});

	test('Mutually recursive functions are analyzed when called', async() => {
		const result = await compareWithLazyStats('MutuallyRecursiveFunctions', MutuallyRecursiveFunctions);

		const stats = result.lazyStats;
		const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

		// Both mutually recursive functions should be analyzed since is_even is called
		console.log(`Functions remaining lazy: ${lazyFunctionsRemaining}`);
		assert.equal(
			lazyFunctionsRemaining,
			0,
			'Mutually recursive functions should have been materialized when one is called'
		);
	});

	test('Mutually recursive functions wit hunkown data are analyzed when called', async() => {
		const result = await compareWithLazyStats('MutuallyRecursiveFunctionsUnknownData', MutuallyRecursiveFunctionsUnknownData);

		const stats = result.lazyStats;
		const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

		// Both mutually recursive functions should be analyzed since is_even is called
		console.log(`Functions remaining lazy: ${lazyFunctionsRemaining}`);
		assert.equal(
			lazyFunctionsRemaining,
			0,
			'Mutually recursive functions should have been materialized when one is called'
		);
	});
});

