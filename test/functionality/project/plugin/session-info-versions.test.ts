import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrConfig } from '../../../../src/config';
import {
	FlowrAnalyzerPackageVersionsSessionInfoPlugin
} from '../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-session-info-plugin';

/** a `sessionInfo()` output block as it typically ends up pasted into a comment */
const sessionInfoComment = `# R version 4.3.1 (2023-06-16)
# Platform: x86_64-pc-linux-gnu (64-bit)
# Running under: Ubuntu 22.04.2 LTS
#
# other attached packages:
# [1] dplyr_1.1.2     ggplot2_3.4.2   lubridate_1.9.2
#
# loaded via a namespace (and not attached):
# [1] rlang_1.1.1     vctrs_0.6.3

x <- 1
`;

function ctxWith(name: string, content: string): FlowrAnalyzerContext {
	const ctx = new FlowrAnalyzerContext(
		FlowrConfig.default(),
		arraysGroupBy([
			new FlowrAnalyzerPackageVersionsSessionInfoPlugin()
		], p => p.type)
	);
	ctx.addFile(new FlowrInlineTextFile(name, content));
	return ctx;
}

describe('sessionInfo() versions', () => {
	test('registers R and every listed package as exact pins', () => {
		const ctx = ctxWith('script.R', sessionInfoComment);
		const got = ctx.deps.getDependencies().map(d => [d.name, d.versionConstraints[0]?.raw]);
		assert.sameDeepMembers(got, [
			['R', '4.3.1'],
			['dplyr', '1.1.2'],
			['ggplot2', '3.4.2'],
			['lubridate', '1.9.2'],
			['rlang', '1.1.1'],
			['vctrs', '0.6.3']
		]);
	});

	test('a plain script without sessionInfo() output registers nothing', () => {
		const ctx = ctxWith('script.R', 'x <- 1\ny <- 2\n');
		assert.deepStrictEqual(ctx.deps.getDependencies(), []);
	});

	test('the R version line alone, without any package listing, registers nothing (too ambiguous)', () => {
		const ctx = ctxWith('script.R', '# R version 4.4.0 (2024-04-24)\nx <- 1\n');
		assert.deepStrictEqual(ctx.deps.getDependencies(), []);
	});

	test('the R version line together with a package listing pins both', () => {
		const ctx = ctxWith('script.R', '# R version 4.4.0 (2024-04-24)\n# other attached packages:\n# [1] dplyr_1.1.2\nx <- 1\n');
		const got = ctx.deps.getDependencies().map(d => [d.name, d.versionConstraints[0]?.raw]);
		assert.sameDeepMembers(got, [['R', '4.4.0'], ['dplyr', '1.1.2']]);
	});

	test('a package-like header without any pkg_version token registers nothing', () => {
		const ctx = ctxWith('script.R', '# other attached packages:\n# none\nx <- 1\n');
		assert.deepStrictEqual(ctx.deps.getDependencies(), []);
	});
});
