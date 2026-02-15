import { assert, test } from 'vitest';
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
		.enableDeferredFunctionEval().build()
	);
	const eagerAnalyzer = func(await new FlowrAnalyzerBuilder().build());

	const lazyDf = await lazyAnalyzer.dataflow();
	const eagerDf = await eagerAnalyzer.dataflow();

	console.log(`Lazy Functions in vertices: ${lazyDf.graph.countLazyFunctionDefinitionsByScan()}`);

	const lazyStats = lazyDf.graph.getLazyFunctionStatistics();
	const eagerStats = eagerDf.graph.getLazyFunctionStatistics();

	const graphdiff = diffOfDataflowGraphs(
		{ name: 'Lazy graph', graph: lazyDf.graph },
		{ name: 'Eager graph', graph: eagerDf.graph }
	);

	const comments = graphdiff.comments() || [];
	const isEqual = graphdiff.isEqual();

	console.log(`Lazy Function Stats: ${JSON.stringify(lazyStats, null, 2)}`);
	console.log(`Eager Function Stats: ${JSON.stringify(eagerStats, null, 2)}`);
	console.log(`Graph Equality: ${isEqual}`);
	if(comments.length > 0) {
		console.log(`Differences: ${comments.join(', ')}`);
	}

	assert.isTrue(isEqual, `Dataflow graphs should be equal for testCase ${testCaseName}`);

	return {
		graphsEqual: isEqual,
		comments,
		lazyStats,
		eagerStats
	};
}

// ============================================================================
// Test Cases
// ============================================================================

const SimpleFunction: AnalyzerSetupFunction = (analyzer) => {
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

// ============================================================================
// Tests
// ============================================================================

test('Understand current function definition handling', async() => {
	const result = await compareWithLazyStats('SimpleFunction', SimpleFunction);
	assert.isTrue(result.graphsEqual);
});

test('Single unused function is not analyzed in lazy mode', async() => {
	const result = await compareWithLazyStats('UnusedFunction', UnusedFunction);
	assert.isTrue(result.graphsEqual);

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
	assert.isTrue(result.graphsEqual);

	const stats = result.lazyStats;
	const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

	// Should have remaining lazy functions (the unused ones)
	console.log(`Functions remaining lazy: ${lazyFunctionsRemaining}`);
	assert.isTrue(
		lazyFunctionsRemaining >= 3,
		'Lazy mode should have skipped analysis of unused1, unused2, and unused3'
	);
});

test('Nested unused functions are not analyzed in lazy mode', async() => {
	const result = await compareWithLazyStats('NestedUnusedFunctions', NestedUnusedFunctions);
	assert.isTrue(result.graphsEqual);

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
	assert.isTrue(result.graphsEqual);

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
	assert.isTrue(result.graphsEqual);

	const stats = result.lazyStats;
	const lazyFunctionsRemaining = stats.totalFunctionDefinitions - stats.lazyFunctionsMaterialized;

	// Both func_a and func_b should be analyzed since dataflow doesn't track conditionals
	console.log(`Functions remaining lazy: ${lazyFunctionsRemaining}`);
});

test('Function returned but not called is not analyzed in lazy mode', async() => {
	const result = await compareWithLazyStats('FunctionReturnedButNotCalled', FunctionReturnedButNotCalled);
	assert.isTrue(result.graphsEqual);

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
	assert.isTrue(result.graphsEqual);

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