import { assert } from 'vitest';
import type { AbsintVisitorConfiguration, AbstractInterpretationVisitor } from '../../../src/abstract-interpretation/absint-visitor';
import type { AnyAbstractDomain } from '../../../src/abstract-interpretation/domains/abstract-domain';
import type { AnyStateDomain } from '../../../src/abstract-interpretation/domains/state-domain-like';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { CfgKind } from '../../../src/project/cfg-kind';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { RSymbol } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RShell } from '../../../src/r-bridge/shell';
import type { SlicingCriteria } from '../../../src/slicing/criterion/parse';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { SourceRange } from '../../../src/util/range';
import { Record } from '../../../src/util/record';
import { guard, isNotUndefined } from '../../../src/util/assert';

/** A test case for value inference, mapping identifiers as slicing criteria to their expected abstract values. */
export type TestCase<ExpectedValue> = Record<SlicingCriterion, ExpectedValue | undefined>;

/**
 * A test entry for validating inferred values, containing the location (as slicing criterion), the corresponding AST symbol node, the line number of the node in the source code, and the inferred value.
 */
interface TestEntry<Domain extends AnyAbstractDomain> {
	criterion: SlicingCriterion,
	node:      RSymbol<ParentInformation>,
	line:      number
	inferred:  Domain | undefined,
}

/**
 * Runs the inference on the given code using the provided inference function, which creates an abstract interpretation visitor based on the given configuration.
 * @param code - The code to perform the inference on.
 * @param inference - A function that takes a config and returns an abstract interpretation visitor to perform the inference.
 * @returns The abstract interpretation visitor after performing the inference, which contains the inferred values.
 */
async function runInfererence<Domain extends AnyAbstractDomain>(
	code: string,
	inference: (config: AbsintVisitorConfiguration) => AbstractInterpretationVisitor<AnyStateDomain<Domain>>
): Promise<AbstractInterpretationVisitor<AnyStateDomain<Domain>, AbsintVisitorConfiguration>> {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	analyzer.addRequest(code);

	const ast = await analyzer.normalize();
	const dfg = (await analyzer.dataflow()).graph;
	const cfg = await analyzer.controlflow(undefined, CfgKind.NoFunctionDefs);
	const ctx = analyzer.inspectContext();

	const visitor = inference({ controlFlow: cfg, dfg: dfg, normalizedAst: ast, ctx: ctx });
	visitor.start();

	return visitor;
}

/**
 * Retrieves the inferred abstract value for a given slicing criterion from the results of the inference.
 * @param inference - The abstract interpretation visitor after performing the inference, which contains the inferred values.
 * @param criterion - The slicing criterion for which to retrieve the inferred value.
 * @returns The inferred abstract value for the given slicing criterion, or `undefined` if no value was inferred for it.
 */
function getAbstractValue<Domain extends AnyAbstractDomain>(
	inference: AbstractInterpretationVisitor<AnyStateDomain<Domain>>,
	criterion: SlicingCriterion
): Domain | undefined {
	const idMap = inference.config.normalizedAst.idMap;
	const nodeId = SlicingCriterion.parse(criterion, idMap);
	const node = idMap.get(nodeId);
	guard(isNotUndefined(node), `Slicing criterion ${criterion} does not refer to an AST node`);

	return inference.getAbstractValue(node);
}

/**
 * Asserts that the inferred values when performing the inference on the code match expected values.
 * @param code - The code to perform the inference on.
 * @param expected - A record mapping locations (as slicing criteria) to their expected values.
 * @param inference - A function that takes a config and returns an abstract interpretation visitor to perform the inference.
 * @param overapproximation - Whether to allow over-approximations (i.e., the inferred value can be "coarser" than the expected value).
 */
export async function assertInferredValues<Domain extends AnyAbstractDomain>(
	code: string,
	expected: TestCase<Domain>,
	inference: (config: AbsintVisitorConfiguration) => AbstractInterpretationVisitor<AnyStateDomain<Domain>>,
	overapproximation: boolean = false
): Promise<void> {
	const result = await runInfererence(code, inference);

	for(const [criterion, expectedValue] of Record.entries(expected)) {
		const inferredValue = getAbstractValue(result, criterion);
		assertInferredValue(criterion, inferredValue, expectedValue, overapproximation);
	}
}

/**
 * Validates the inferred values when performing the inference against the actual values when running the code.
 * @param shell - The R shell to run the instrumented code in.
 * @param code - The code to perform the inference on.
 * @param locations - The symbol locations (as slicing criteria) to validate the inferred values against the actual values for.
 * @param inference - A function that takes a config and returns an abstract interpretation visitor to perform the inference.
 * @param createOutputCode - A function that takes a marker and a symbol and returns the code to output the properties of the symbol required for validation.
 * @param deserializeOutput - A function that takes the output of the instrumented code and deserializes it into a value of the abstract domain.
 */
export async function validateInferredValues<Domain extends AnyAbstractDomain>(
	shell: RShell,
	code: string,
	locations: SlicingCriteria,
	inference: (config: AbsintVisitorConfiguration) => AbstractInterpretationVisitor<AnyStateDomain<Domain>>,
	createOutputCode: (marker: string, symbol: string) => string,
	deserializeOutput: (output: string) => Domain
): Promise<void> {
	const createMarker = (criterion: SlicingCriterion) => `INFERENCE ${criterion}`;
	const result = await runInfererence(code, inference);
	const testEntries: TestEntry<Domain>[] = [];

	for(const criterion of locations) {
		const idMap = result.config.normalizedAst.idMap;
		const nodeId = SlicingCriterion.parse(criterion, idMap);
		const node = idMap.get(nodeId);
		guard(RSymbol.is(node), `Slicing criterion ${criterion} does not refer to an R symbol`);

		const range = SourceRange.fromNode(node);
		const line = range ? SourceRange.getEndLine(range) : undefined;
		guard(isNotUndefined(line), `Cannot resolve source code line of criterion ${criterion}`);

		const inferred = getAbstractValue(result, criterion);
		testEntries.push({ criterion, node, line, inferred });
	}
	testEntries.sort((a, b) => b.line - a.line);
	const lines = code.split('\n');

	for(const { criterion, node, line } of testEntries) {
		const marker = createMarker(criterion);
		const instrumentation = createOutputCode(marker, Identifier.toString(node.content));
		lines.splice(line, 0, instrumentation);
	}
	shell.clearEnvironment();
	const instrumentedCode = lines.join('\n');
	const output = await shell.sendCommandWithOutput(instrumentedCode);

	for(const { criterion, inferred } of testEntries) {
		const marker = createMarker(criterion);
		const line = output.find(line => line.includes(marker));
		guard(isNotUndefined(line), `Cannot parse output of instrumented code for ${criterion}`);

		const expected = deserializeOutput(line);
		assertInferredValue(criterion, inferred, expected, true);
	}
}

/**
 * Asserts that the inferred value for a given criterion matches the expected value or is an over-approximation of it.
 * @param criterion - The slicing criterion for which the value was inferred.
 * @param inferred - The inferred abstract value for the criterion.
 * @param expected - The expected abstract value for the criterion.
 * @param overapproximation - Whether to allow over-approximations (i.e., the inferred value can be "coarser" than the expected value).
 */
export function assertInferredValue<Domain extends AnyAbstractDomain>(criterion: string, inferred: Domain | undefined, expected: Domain | undefined, overapproximation?: boolean) {
	if(inferred === undefined || expected === undefined) {
		if(overapproximation) {
			assert.ok(inferred === undefined, `Expected inferred value for criterion "${criterion}" to be undefined, but got ${inferred?.toString()}`);
		} else {
			assert.ok(inferred === undefined && expected === undefined, `Expected inferred value for criterion "${criterion}" to be ${expected === undefined ? 'undefined' : 'defined'}, but got ${inferred?.toString()}`);
		}
	} else {
		if(overapproximation) {
			assert.ok(expected.leq(inferred), `Expected inferred value for criterion "${criterion}" to be an over-approximation of ${expected.toString()}, but got ${inferred.toString()}`);
		} else {
			assert.ok(inferred.equals(expected), `Expected inferred value for criterion "${criterion}" to be ${expected.toString()}, but got ${inferred.toString()}`);
		}
	}
}
