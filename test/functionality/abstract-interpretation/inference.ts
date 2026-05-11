import { assert, test } from 'vitest';
import type { AbsintVisitorConfiguration, AbstractInterpretationVisitor } from '../../../src/abstract-interpretation/absint-visitor';
import type { AnyAbstractDomain } from '../../../src/abstract-interpretation/domains/abstract-domain';
import type { AnyStateDomain } from '../../../src/abstract-interpretation/domains/state-domain-like';
import { FlowrConfig } from '../../../src/config';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { CfgKind } from '../../../src/project/cfg-kind';
import type { FlowrFileProvider } from '../../../src/project/context/flowr-file';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { RSymbol } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../../src/r-bridge/lang-4.x/ast/model/processing/role';
import type { RShell } from '../../../src/r-bridge/shell';
import { type SlicingCriteria, SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { assertUnreachable, guard, isNotUndefined } from '../../../src/util/assert';
import { SourceRange } from '../../../src/util/range';
import { Record } from '../../../src/util/record';
import { decorateLabelContext, type TestLabel } from '../_helper/label';
import { skipTestBecauseConfigNotMet, type TestConfiguration } from '../_helper/shell';

/**
 * Whether an inferred value should equal the expected value, or should be an over-approximation of the expected value.
 */
export enum DomainMatchingType {
	Equal = 'equal',
	Overapproximation = 'overapproximation'
}

/**
 * A test case for value inference, mapping identifiers specified as slicing criteria to their expected values.
 */
export type TestCase<ExpectedValue> = Record<SlicingCriterion, ExpectedValue | undefined>;

/**
 * Options for inference tests, including the flowR config to use, additional files to add to the flowR project context, and the domain matching type to use when comparing inferred values with expected values.
 */
export interface InferenceTestOptions {
	/** The flowR config to use for the test (defaults to {@link FlowrConfig.default}) */
	readonly config?:       FlowrConfig;
	/** Additional files to add to the flowR project context for the test */
	readonly files?:        FlowrFileProvider[];
	/**The domain matching type to use to compare the inferred values with the expected values (defaults to {@link DomainMatchingType.Exact} for assertion tests and {@link DomainMatchingType.Overapproximation} for validation tests) */
	readonly matchingType?: DomainMatchingType;
	/** Whether the validation test with the execution of the R code should be skipped (defaults to `false`) */
	readonly skipRun?:      boolean | (() => boolean);
}

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
 * @param options - The inference test options, including the flowR config to use and additional files to add to the flowR project context.
 * @returns The abstract interpretation visitor after performing the inference, which contains the inferred values.
 */
export async function runInference<Inference extends AbstractInterpretationVisitor<AnyStateDomain>>(
	code: string,
	inference: (config: AbsintVisitorConfiguration) => Inference,
	options?: InferenceTestOptions
): Promise<Inference> {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.setConfig(options?.config ?? FlowrConfig.default())
		.build();

	analyzer.addRequest(code);
	analyzer.addFile(...(options?.files ?? []));

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
export function getInferredValueForCriterion<Domain extends AnyAbstractDomain>(
	inference: AbstractInterpretationVisitor<AnyStateDomain<Domain>>,
	criterion: SlicingCriterion
): Domain | undefined {
	const idMap = inference.config.normalizedAst.idMap;
	let nodeId = SlicingCriterion.parse(criterion, idMap);
	const node = idMap.get(nodeId);

	if(node?.info.role === RoleInParent.FunctionCallName) {
		nodeId = node.info.parent ?? nodeId;
	}
	guard(isNotUndefined(nodeId), `Slicing criterion ${criterion} does not refer to an AST node`);

	return inference.getAbstractValue(nodeId);
}

/**
 * Combined test to assert that the inferred values match expected values for given slicing criteria and
 * validate the inferred values against the actual values at these locations when running the code.
 * When only providing a list of locations (slicing criteria), only the validation test is performed.
 * The `skipRun` option of the test options can be used to skip the validation test (skip running the code) and only perform the assertion test.
 * Only slicing criteria for symbols are allowed (e.g., no slicing criteria for function calls or operators).
 *
 * Note that this functions inserts print statements for the actual values in the code in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 * @param name - The label of the test.
 * @param shell - The R shell to use to run the code.
 * @param code - The R code to infer the data frame shape for and to run for validation.
 * @param expected - The expected values for each slicing criterion to test or a list of slicing criteria to validate the inferred value for.
 * @param inference - A function that takes a config and returns an abstract interpretation visitor to perform the inference.
 * @param createOutputCode - A function that takes a marker and a symbol and returns a code line to output the analyzed properties for the symbol.
 * @param parseOutput - A function that takes the output of the instrumented code and parses it into a value of the abstract domain.
 * @param options - The inference test options, including the flowR config to use, additional files to add to the flowR project context, and the domain matching type to use when comparing inferred values with expected values.
 */
export function testInferredValues<Domain extends AnyAbstractDomain>(
	name: string | TestLabel,
	shell: RShell,
	code: string,
	expected: TestCase<Domain> | SlicingCriteria,
	inference: (config: AbsintVisitorConfiguration) => AbstractInterpretationVisitor<AnyStateDomain<Domain>>,
	createOutputCode: (marker: string, symbol: string) => string,
	parseOutput: (output: string) => Domain | undefined,
	options?: InferenceTestOptions & Partial<TestConfiguration>
) {
	if(!Array.isArray(expected)) {
		test(decorateLabelContext(name, ['absint']), async() => {
			await assertInferredValues(code.trim(), expected, inference, options);
		});
	}
	if(options?.skipRun !== true) {
		test.skipIf(skipTestBecauseConfigNotMet(options))(decorateLabelContext(name, ['absint']), async({ skip }) => {
			if(typeof options?.skipRun === 'function' ? options.skipRun() : options?.skipRun) {
				skip();
			}
			const locations = Array.isArray(expected) ? expected : Record.keys(expected);
			await validateInferredValues(shell, code.trim(), locations, inference, createOutputCode, parseOutput, options);
		});
	}
}

/**
 * Asserts that the inferred values at given locations (as slicing criteria) match expected values.
 * @param code - The code to perform the inference on.
 * @param expected - A record mapping locations (as slicing criteria) to their expected values.
 * @param inference - A function that takes a config and returns an abstract interpretation visitor to perform the inference.
 * @param options - The inference test options, including the flowR config to use, additional files to add to the flowR project context, and the domain matching type to use when comparing inferred values with expected values.
 */
export async function assertInferredValues<Domain extends AnyAbstractDomain>(
	code: string,
	expected: TestCase<Domain>,
	inference: (config: AbsintVisitorConfiguration) => AbstractInterpretationVisitor<AnyStateDomain<Domain>>,
	options?: InferenceTestOptions
): Promise<void> {
	const result = await runInference(code, inference, options);

	for(const [criterion, expectedValue] of Record.entries(expected)) {
		const inferredValue = getInferredValueForCriterion(result, criterion);
		assertInferredValue(criterion, inferredValue, expectedValue, options?.matchingType ?? DomainMatchingType.Equal);
	}
}

/**
 * Validates the inferred values at given locations (as slicing criteria) against the actual values when running the code.
 * Only slicing criteria for symbols are allowed (e.g., no slicing criteria for function calls or operators).
 *
 * Note that this functions inserts print statements for the actual values in the code in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 * @param shell - The R shell to run the instrumented code.
 * @param code - The code to perform the inference on and to run for validation.
 * @param locations - The symbol locations (as slicing criteria) to validate the inferred values against the actual values for.
 * @param inference - A function that takes a config and returns an abstract interpretation visitor to perform the inference.
 * @param createOutputCode - A function that takes a marker and a symbol and returns a code line to output the analyzed properties for the symbol.
 * @param parseOutput - A function that takes the output of the instrumented code and parses it into a value of the abstract domain.
 * @param options - The inference test options, including the flowR config to use, additional files to add to the flowR project context, and the domain matching type to use when comparing inferred values with expected values.
 */
export async function validateInferredValues<Domain extends AnyAbstractDomain>(
	shell: RShell,
	code: string,
	locations: SlicingCriteria,
	inference: (config: AbsintVisitorConfiguration) => AbstractInterpretationVisitor<AnyStateDomain<Domain>>,
	createOutputCode: (marker: string, symbol: string) => string,
	parseOutput: (output: string) => Domain | undefined,
	options?: InferenceTestOptions
): Promise<void> {
	const createMarker = (criterion: SlicingCriterion) => `INFERENCE ${criterion}`;
	const result = await runInference(code, inference, options);
	const testEntries: TestEntry<Domain>[] = [];

	for(const criterion of locations) {
		const idMap = result.config.normalizedAst.idMap;
		const nodeId = SlicingCriterion.parse(criterion, idMap);
		const node = idMap.get(nodeId);
		guard(RSymbol.is(node), `Slicing criterion ${criterion} does not refer to an R symbol`);

		const range = SourceRange.fromNode(node);
		const line = range ? SourceRange.getEndLine(range) : undefined;
		guard(isNotUndefined(line), `Cannot resolve source code line of criterion ${criterion}`);

		const inferred = getInferredValueForCriterion(result, criterion);
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

		const expected = parseOutput(line);
		assertInferredValue(criterion, inferred, expected, options?.matchingType ?? DomainMatchingType.Overapproximation);
	}
}

/**
 * Asserts that the inferred value for a given criterion matches the expected value or is an over-approximation of it.
 * @param criterion - The slicing criterion for which the value was inferred.
 * @param inferred - The inferred abstract value for the criterion.
 * @param expected - The expected abstract value for the criterion.
 * @param matchingType - Whether the inferred value should equal the expected value or be an over-approximation of it (defaults to equal).
 */
export function assertInferredValue<Domain extends AnyAbstractDomain>(criterion: string, inferred: Domain | undefined, expected: Domain | undefined, matchingType = DomainMatchingType.Equal) {
	if(inferred === undefined || expected === undefined) {
		switch(matchingType) {
			case DomainMatchingType.Equal:
				return assert.ok(inferred === undefined && expected === undefined, `Expected inferred value for criterion "${criterion}" to be ${expected === undefined ? 'undefined' : 'defined'}, but got ${inferred?.toString()}`);
			case DomainMatchingType.Overapproximation:
				return assert.ok(inferred === undefined, `Expected inferred value for criterion "${criterion}" to be undefined, but got ${inferred?.toString()}`);
			default:
				assertUnreachable(matchingType);
		}
	}
	switch(matchingType) {
		case DomainMatchingType.Equal:
			return assert.ok(inferred.equals(expected), `Expected inferred value for criterion "${criterion}" to be ${expected.toString()}, but got ${inferred.toString()}`);
		case DomainMatchingType.Overapproximation:
			return assert.ok(expected.leq(inferred), `Expected inferred value for criterion "${criterion}" to be an over-approximation of ${expected.toString()}, but got ${inferred.toString()}`);
		default:
			assertUnreachable(matchingType);
	}
}
