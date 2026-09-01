import { assert, describe, test } from 'vitest';
import { FlowrNamespaceFile } from '../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import type { NamespaceInfo } from '../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { label } from '../_helper/label';

function parse(content: string): NamespaceInfo {
	return FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', content)).content().current;
}

describe('NAMESPACE files', () => {
	function testDirective(name: string, content: string, expected: Partial<{ exported: string[], s3: [string, string[]][], imported: [string, string[] | 'all'][] }>) {
		test(label(name, ['name-normal'], ['other']), () => {
			const info = parse(content);
			assert.deepStrictEqual(info.exportedSymbols, expected.exported ?? []);
			assert.deepStrictEqual([...info.exportS3Generics], expected.s3 ?? []);
			assert.deepStrictEqual([...info.importedPackages ?? []], expected.imported ?? []);
		});
	}

	testDirective('one export', 'export(a)', { exported: ['a'] });
	testDirective('several in one directive', 'export(a, b)', { exported: ['a', 'b'] });
	testDirective('quoted names', 'export("a", `b`)', { exported: ['a', 'b'] });

	testDirective('one package', 'import(dplyr)', { imported: [['dplyr', 'all']] });
	testDirective('several packages', 'import(dplyr, tidyr)', { imported: [['dplyr', 'all'], ['tidyr', 'all']] });
	testDirective('a package minus some names', 'import(dplyr, except = c(filter, lag))', { imported: [['dplyr', 'all']] });
	testDirective('selected names', 'importFrom(magrittr, "%>%")', { imported: [['magrittr', ['%>%']]] });

	testDirective('a method by class', 'S3method(print, foo)', { s3: [['print', ['foo']]] });
	testDirective('a method naming its function', 'S3method(print, bar, print_bar_impl)', { s3: [['print', ['bar']]] });
});
