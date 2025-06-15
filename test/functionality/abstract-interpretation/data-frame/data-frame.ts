import { assert, beforeAll, test } from 'vitest';
import { performDataFrameAbsint, resolveIdToAbstractValue } from '../../../../src/abstract-interpretation/data-frame/absint-visitor';
import type { DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { DataFrameTop, equalColNames, equalInterval, leqColNames, leqInterval } from '../../../../src/abstract-interpretation/data-frame/domain';
import { extractCfg } from '../../../../src/control-flow/extract-cfg';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import type { TREE_SITTER_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { createDataflowPipeline, DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import type { RSymbol } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import type { KnownParser } from '../../../../src/r-bridge/parser';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { type RShell } from '../../../../src/r-bridge/shell';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { assertUnreachable, guard, isNotUndefined } from '../../../../src/util/assert';
import { getRangeEnd } from '../../../../src/util/range';
import { decorateLabelContext, type TestLabel } from '../../_helper/label';

export enum DomainMatchingType {
    Exact = 'exact',
    Overapproximation = 'overapproximation'
}

export type DataFrameTestOptions = Record<keyof DataFrameDomain, DomainMatchingType>;

export const DataFrameTestExact = {
	colnames: DomainMatchingType.Exact,
	cols:     DomainMatchingType.Exact,
	rows:     DomainMatchingType.Exact
};

export const DataFrameTestOverapproximation = {
	colnames: DomainMatchingType.Overapproximation,
	cols:     DomainMatchingType.Overapproximation,
	rows:     DomainMatchingType.Overapproximation
};

type DomainPredicateMapping = {
	[K in keyof DataFrameDomain]: (X1: DataFrameDomain[K], X2: DataFrameDomain[K]) => boolean
}

const EqualFunctions: DomainPredicateMapping = {
	colnames: equalColNames,
	cols:     equalInterval,
	rows:     equalInterval
};

const LeqFunctions: DomainPredicateMapping = {
	colnames: leqColNames,
	cols:     leqInterval,
	rows:     leqInterval
};

/** Stores the inferred data frame constraints and AST node for a tested slicing criterion */
interface CriterionTestEntry {
	criterion:  SingleSlicingCriterion,
	value:      DataFrameDomain,
	node:       RSymbol<ParentInformation>,
	lineNumber: number,
	options:    DataFrameTestOptions
}

export function assertDataFrameDomain(
	parser: KnownParser,
	code: string,
	expected: [SingleSlicingCriterion, DataFrameDomain][],
	name: string | TestLabel = code
) {
	let result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;

	beforeAll(async() => {
		result = await createDataflowPipeline(parser, { request: requestFromInput(code) }).allRemainingSteps();
	});

	test.each(expected)(decorateLabelContext(name, ['absint']), (criterion, expect) => {
		guard(isNotUndefined(result), 'Result cannot be undefined');
		const [value] = getInferredDomainForCriterion(result, criterion);

		assertDomainMatching('colnames', value.colnames, expect.colnames, DomainMatchingType.Exact);
		assertDomainMatching('cols', value.cols, expect.cols, DomainMatchingType.Exact);
		assertDomainMatching('rows', value.rows, expect.rows, DomainMatchingType.Exact);
	});
}

export function testDataFrameDomainAgainstReal(
	shell: RShell,
	code: string,
	/** The options describe whether the inferred properties should match exacly the actual properties or can be an over-approximation (defaults to exact for all properties) */
	criteria: (SingleSlicingCriterion | [SingleSlicingCriterion, Partial<DataFrameTestOptions>])[],
	name: string | TestLabel = code
): void {
	test(decorateLabelContext(name, ['absint']), async()=> {
		const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			parser:  shell,
			request: requestFromInput(code)
		}).allRemainingSteps();

		const testEntries: CriterionTestEntry[] = [];

		for(const entry of criteria) {
			const criterion = Array.isArray(entry) ? entry[0] : entry;
			const options = { ...DataFrameTestExact, ...(Array.isArray(entry) ? entry[1] : {}) };
			const [value, node] = getInferredDomainForCriterion(result, criterion);
			const lineNumber = getRangeEnd(node.info.fullRange ?? node.location)?.[0];

			if(lineNumber === undefined) {
				throw new Error(`cannot resolve line of criterion ${criterion}`);
			}
			testEntries.push({ criterion, value, node, lineNumber, options });
		}
		testEntries.sort((a, b) => b.lineNumber - a.lineNumber);
		const lines = code.split('\n');

		for(const { criterion, node, lineNumber } of testEntries) {
			const outputCode = [
				createCodeForOutput('colnames', criterion, node.content),
				createCodeForOutput('cols', criterion, node.content),
				createCodeForOutput('rows', criterion, node.content)
			];
			lines.splice(lineNumber, 0, ...outputCode);
		}
		const instrumentedCode = lines.join('\n');

		shell.clearEnvironment();
		const output = await shell.sendCommandWithOutput(instrumentedCode);

		for(const { criterion, value, options } of testEntries) {
			const colnames = getRealDomainFromOutput('colnames', criterion, output);
			const cols = getRealDomainFromOutput('cols', criterion, output);
			const rows = getRealDomainFromOutput('rows', criterion, output);

			assertDomainMatching('colnames', value.colnames, colnames, options.colnames);
			assertDomainMatching('cols', value.cols, cols, options.cols);
			assertDomainMatching('rows', value.rows, rows, options.rows);
		}
	});
}

function assertDomainMatching<K extends keyof DataFrameDomain, T extends DataFrameDomain[K]>(
	type: K,
	actual: T,
	expected: T,
	matchingType: DomainMatchingType
): void {
	const equalFunction = EqualFunctions[type];
	const leqFunction = LeqFunctions[type];

	switch(matchingType) {
		case DomainMatchingType.Exact:
			return assert.ok(equalFunction(actual, expected), `${type} differs: expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
		case DomainMatchingType.Overapproximation:
			return assert.ok(leqFunction(expected, actual), `${type} is no over-approximation: expected ${JSON.stringify(actual)} to be an over-approximation of ${JSON.stringify(expected)}`);
		default:
			assertUnreachable(matchingType);
	}
}

function createCodeForOutput(
	type: keyof DataFrameDomain,
	criterion: SingleSlicingCriterion,
	symbol: string
): string {
	switch(type) {
		case 'colnames':
			return `cat("${getMarker(type, criterion)}", colnames(${symbol}), "\\n")`;
		case 'cols':
			return `cat("${getMarker(type, criterion)}", ncol(${symbol}), "\\n")`;
		case 'rows':
			return `cat("${getMarker(type, criterion)}", nrow(${symbol}), "\\n")`;
		default:
			assertUnreachable(type);
	}
}

function getInferredDomainForCriterion(
	result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>,
	criterion: SingleSlicingCriterion
): [DataFrameDomain, RSymbol<ParentInformation>] {
	const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
	const nodeId = slicingCriterionToId(criterion, idMap);
	const node = idMap.get(nodeId);

	if(node === undefined || node.type !== RType.Symbol) {
		throw new Error(`slicing criterion ${criterion} does not refer to a R symbol`);
	}
	const cfg = extractCfg(result.normalize, result.dataflow.graph);
	performDataFrameAbsint(cfg, result.dataflow.graph, result.normalize);
	const value = resolveIdToAbstractValue(node, result.dataflow.graph) ?? DataFrameTop;

	return [value, node];
}

function getRealDomainFromOutput<K extends keyof DataFrameDomain>(
	type: K,
	criterion: SingleSlicingCriterion,
	output: string[]
): DataFrameDomain[K] {
	const marker = getMarker(type, criterion);
	const line = output.find(line => line.startsWith(marker))?.replace(marker, '').trim();

	if(line === undefined) {
		throw new Error(`cannot parse ${type} output of instrumented code for ${criterion}`);
	}
	switch(type) {
		case 'colnames': {
			const value = line.length > 0 ? line.split(' ') : [];
			return value as DataFrameDomain[K];
		}
		case 'cols':
		case 'rows': {
			const value = Number.parseInt(line);
			return [value, value] as DataFrameDomain[K];
		}
		default:
			assertUnreachable(type);
	}
}

function getMarker(type: keyof DataFrameDomain, criterion: SingleSlicingCriterion): string {
	return `${type.toUpperCase()} ${criterion}`;
}
