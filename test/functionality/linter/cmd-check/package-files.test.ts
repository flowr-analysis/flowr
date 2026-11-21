import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { packageFiles } from '../../../../src/linter/rules/cmd-check/package-files';

describe('package files as R CMD check sees them', () => {
	test('in memory, the known files below the root', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().build();
		analyzer.addFile(new FlowrInlineTextFile('/pkg/DESCRIPTION', 'Package: pkg\nVersion: 1.0\n'), new FlowrInlineTextFile('/pkg/R/a.R', 'x <- 1'), new FlowrInlineTextFile('/pkg/.Rbuildignore', '^R/ignored\\.R$\n'), new FlowrInlineTextFile('/pkg/R/ignored.R', 'y <- 2'), new FlowrInlineTextFile('/other/b.R', ''));
		analyzer.addRequest('x <- 1');
		const files = packageFiles(analyzer.inspectContext(), 'pkg');
		assert.isDefined(files);
		assert.isFalse(files?.onDisk);
		assert.deepStrictEqual(files?.entries.map(e => e.relative), ['DESCRIPTION', 'R', 'R/a.R']);
		assert.strictEqual(files?.read('DESCRIPTION'), 'Package: pkg\nVersion: 1.0\n');
	});
	test('on disk, the whole folder minus what R CMD build drops', async() => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-pkg-'));
		try {
			for(const [f, c] of Object.entries({ 'DESCRIPTION': 'Package: pkg\nVersion: 1.0\n', 'R/a.R': 'x <- 1', '.git/config': '', '.Rbuildignore': '^notes$\n', 'notes': 'x', '.hidden': '', 'pkg_1.0.tar.gz': '', 'R/a.R~': '' })) {
				fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
				fs.writeFileSync(path.join(root, f), c);
			}
			const analyzer = await new FlowrAnalyzerBuilder().build();
			analyzer.addRequest(`file://${root}`);
			await analyzer.dataflow();
			const files = packageFiles(analyzer.inspectContext(), 'pkg');
			assert.isTrue(files?.onDisk);
			assert.deepStrictEqual(files?.entries.map(e => e.relative), ['.hidden', 'DESCRIPTION', 'R', 'R/a.R']);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
