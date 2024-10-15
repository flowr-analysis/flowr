import { withShell } from '../../_helper/shell';
import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type {
	DependenciesQueryResult, DependencyInfo
} from '../../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import type { AstIdMap } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';


const emptyDependencies: Omit<DependenciesQueryResult, '.meta'> = { libraries: [], sourcedFiles: [], readData: [], writtenData: [] };

function decodeIds(res: Partial<DependenciesQueryResult>, idMap: AstIdMap): Partial<DependenciesQueryResult> {
	const out: Partial<DependenciesQueryResult> = {
		...res
	};
	for(const [key, value] of Object.entries(res) as [keyof DependenciesQueryResult, DependencyInfo[]][]) {
		if(key === '.meta') {
			continue;
		}
		// @ts-expect-error -- we do not need key-dependent typing due to the spread
		out[key] = value.map(({ nodeId, ...rest }) => ({ nodeId: typeof nodeId === 'number' ? nodeId : slicingCriterionToId(String(nodeId) as SingleSlicingCriterion, idMap), ...rest }));
	}
	return out;
}

describe('Dependencies Query', withShell(shell => {
	/** handles slicing criteria for the node ids */
	function testQuery(
		name: string,
		code: string,
		expected: Partial<DependenciesQueryResult>
	): void {
		assertQuery(label(name), shell, code, [{ type: 'dependencies' }], ({ normalize }) => ({
			dependencies: {
				...emptyDependencies,
				...decodeIds(expected, normalize.idMap)
			}
		}));
	}

	describe('Simple', () => {
		testQuery('No dependencies', 'x + 1', {});
	});

	describe('Libraries', () => {
		testQuery('Single library (symbol)', 'library(testLibrary)', { libraries: [{ nodeId: 3, functionName: 'library', libraryName: 'testLibrary' }] });
		testQuery('Single library (string)', 'library("testLibrary")', { libraries: [{ nodeId: 3, functionName: 'library', libraryName: 'testLibrary' }] });
		testQuery('Single require (string)', 'require("testLibrary")', { libraries: [{ nodeId: 3, functionName: 'require', libraryName: 'testLibrary' }] });
	});

	describe('Sourced files', () => {
		testQuery('Single source', 'source("test/file.R")', { sourcedFiles: [{ nodeId: 3, functionName: 'source', file: 'test/file.R' }] });
	});

	describe('Read Files', () => {
		testQuery('read.table', "read.table('test.csv')", { readData: [{ nodeId: 3, functionName: 'read.table', source: 'test.csv' }] });
		testQuery('gzfile', 'gzfile("this is my gzip file :)", "test.gz")', { readData: [{ nodeId: 5, functionName: 'gzfile', source: 'test.gz' }] });
	});

	describe('Write Files', () => {
		testQuery('dump', 'dump("My text", "MyTextFile.txt")', { writtenData: [{ nodeId: 5, functionName: 'dump', destination: 'MyTextFile.txt' }] });
		testQuery('cat', 'cat("Hello!")', { writtenData: [{ nodeId: 3, functionName: 'cat', destination: 'stdout' }] });
	});
}));
