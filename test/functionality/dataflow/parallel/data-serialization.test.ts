import { assert, describe, test } from 'vitest';
import { toSerializedREnvironmentInformation, fromSerializedREnvironmentInformation, diffEnvironments } from '../../../../src/dataflow/environments/environment';
import { diffOfDataflowGraphs } from '../../../../src/dataflow/graph/diff-dataflow-graph';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import { VertexType } from '../../../../src/dataflow/graph/vertex';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { AnalyzerSetupCluster, AnalyzerSetupFunction } from './analyzer-test-data';
import { complexDataflowTests, simpleDataflowTests, sourceBasedDataflowTests } from './analyzer-test-data';

type EnvironmentLike = {
	builtInEnv?: true;
	parent?:     EnvironmentLike;
	memory:      Map<string, unknown[]>;
};

function compareNodeId(a: NodeId, b: NodeId): number {
	return String(a).localeCompare(String(b));
}

function sortedNodeIds(ids: readonly NodeId[]): NodeId[] {
	return [...ids].sort(compareNodeId);
}

function assertTypeIndexConsistency(graph: DataflowGraph, messagePrefix: string): void {
	const json = graph.toJSON();
	for(const tag of Object.values(VertexType)) {
		const expectedIds = sortedNodeIds(
			json.vertexInformation
				.filter(([, vertex]) => vertex.tag === tag)
				.map(([id]) => id)
		);
		const actualIds = sortedNodeIds(graph.vertexIdsOfType(tag));
		assert.deepStrictEqual(
			actualIds,
			expectedIds,
			`${messagePrefix}: internal type index mismatch for tag "${tag}"`
		);
	}
}

function assertStrictGraphSerializationEquality(original: DataflowGraph, parsed: DataflowGraph, testCaseName: string): void {
	const graphdiff = diffOfDataflowGraphs(
		{ name: 'Original graph', graph: original },
		{ name: 'Parsed graph', graph: parsed }
	);

	assert.isTrue(graphdiff.isEqual(), `Dataflow graph content differs after roundtrip for ${testCaseName}`);

	assertTypeIndexConsistency(original, `${testCaseName} (original)`);
	assertTypeIndexConsistency(parsed, `${testCaseName} (parsed)`);
	for(const tag of Object.values(VertexType)) {
		assert.deepStrictEqual(
			sortedNodeIds(parsed.vertexIdsOfType(tag)),
			sortedNodeIds(original.vertexIdsOfType(tag)),
			`Internal type index differs after roundtrip for ${testCaseName} in tag "${tag}"`
		);
	}

	assert.deepStrictEqual(
		parsed.idMap?.toSerializable(),
		original.idMap?.toSerializable(),
		`AST idMap differs after roundtrip for ${testCaseName}`
	);
}

async function checkDataflowGraphSerializationStrict(testCaseName: string, setup: AnalyzerSetupFunction): Promise<void> {
	console.log(`\n► Running serialization test case: ${testCaseName}`);

	const analyzer = setup(await new FlowrAnalyzerBuilder().build());
	try {
		const df = await analyzer.dataflow();
		const byteData = df.graph.toSerializable();
		const parsedGraph = DataflowGraph.fromSerializable(byteData, analyzer.context());

		assertStrictGraphSerializationEquality(df.graph, parsedGraph, testCaseName);
	} finally {
		await analyzer.close(true);
	}
}

async function checkEnvironmentSerializationStrict(testCaseName: string, setup: AnalyzerSetupFunction): Promise<void> {
	console.log(`\n► Running environment serialization test case: ${testCaseName}`);

	const analyzer = setup(await new FlowrAnalyzerBuilder().build());
	try {
		const df = await analyzer.dataflow();
		const serializedOriginal = toSerializedREnvironmentInformation(df.environment);
		const parsedEnvironment = fromSerializedREnvironmentInformation(serializedOriginal, analyzer.context());
		const diff = diffEnvironments(df.environment.current, parsedEnvironment.current);

		assert.isTrue(diff.isEqual, `Environment differs after roundtrip for ${testCaseName}`);
		assert.strictEqual(parsedEnvironment.level, df.environment.level, `Environment level differs after roundtrip for ${testCaseName}`);
		assertEnvironmentLevelwiseEquality(df.environment.current as EnvironmentLike, parsedEnvironment.current as EnvironmentLike, testCaseName);
	} finally {
		await analyzer.close(true);
	}
}

function environmentLevels(env: EnvironmentLike): EnvironmentLike[] {
	const levels: EnvironmentLike[] = [];
	let current: EnvironmentLike | undefined = env;
	while(current) {
		levels.push(current);
		if(current.builtInEnv) {
			break;
		}
		current = current.parent;
	}
	return levels;
}

function assertEnvironmentLevelwiseEquality(original: EnvironmentLike, parsed: EnvironmentLike, testCaseName: string): void {
	const originalLevels = environmentLevels(original);
	const parsedLevels = environmentLevels(parsed);

	assert.strictEqual(
		parsedLevels.length,
		originalLevels.length,
		`Environment chain length differs after roundtrip for ${testCaseName}`
	);

	for(let i = 0; i < originalLevels.length; i++) {
		const expectedLevel = originalLevels[i];
		const actualLevel = parsedLevels[i];

		assert.strictEqual(
			Boolean(actualLevel.builtInEnv),
			Boolean(expectedLevel.builtInEnv),
			`Built-in marker differs at environment level ${i} for ${testCaseName}`
		);

		const expectedKeys = [...expectedLevel.memory.keys()].sort();
		const actualKeys = [...actualLevel.memory.keys()].sort();
		assert.deepStrictEqual(
			actualKeys,
			expectedKeys,
			`Environment memory keys differ at level ${i} for ${testCaseName}`
		);

		for(const key of expectedKeys) {
			assert.deepStrictEqual(
				actualLevel.memory.get(key),
				expectedLevel.memory.get(key),
				`Environment memory entry differs for key "${key}" at level ${i} for ${testCaseName}`
			);
		}
	}
}

function registerGraphClusterTests(clusterName: string, testCluster: AnalyzerSetupCluster): void {
	for(const testCase of testCluster) {
		test(`${clusterName} :: ${testCase.name}`, async() => {
			await checkDataflowGraphSerializationStrict(testCase.name, testCase.setup);
		});
	}
}

function registerEnvironmentClusterTests(clusterName: string, testCluster: AnalyzerSetupCluster): void {
	for(const testCase of testCluster) {
		test(`${clusterName} :: ${testCase.name}`, async() => {
			await checkEnvironmentSerializationStrict(testCase.name, testCase.setup);
		});
	}
}

describe.sequential('Serialization tests', () => {
	describe('Dataflow Graph Serialization', () => {
		registerGraphClusterTests('Simple File Analysis', simpleDataflowTests);
		registerGraphClusterTests('Complex File Analysis', complexDataflowTests);
		registerGraphClusterTests('Source Based File Analysis', sourceBasedDataflowTests);
	});

	describe('Environment Serialization', () => {
		registerEnvironmentClusterTests('Simple File Analysis', simpleDataflowTests);
		registerEnvironmentClusterTests('Complex File Analysis', complexDataflowTests);
		registerEnvironmentClusterTests('Source Based File Analysis', sourceBasedDataflowTests);
	});
});