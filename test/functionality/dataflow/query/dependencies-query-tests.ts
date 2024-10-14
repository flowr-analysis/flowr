import { withShell } from '../../_helper/shell';
import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type { DependenciesQueryResult } from '../../../../src/queries/catalog/dependencies-query/dependencies-query-format';

describe('Dependencies Query', withShell(shell => {
	function testQuery(name: string, code: string, expected: Partial<DependenciesQueryResult>): void {
		assertQuery(label(name), shell, code, [{ type: 'dependencies' }], {
			dependencies: {
				libraries:    expected.libraries ?? [],
				sourcedFiles: expected.sourcedFiles ?? [],
				readData:     expected.readData ?? [],
				writtenData:  expected.writtenData ?? []
			}
		});
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
