import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { LintingRuleExamples } from '../../../src/documentation/wiki-linter';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { fileProtocol, requestFromInput } from '../../../src/r-bridge/retriever';
import { LintingResults } from '../../../src/linter/linter-format';
import { type LintingRuleNames, LintingRules } from '../../../src/linter/linter-rules';
import { LintingRuleTag } from '../../../src/linter/linter-tags';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { defaultSigDbPath, defaultSigDbPaths } from '../../../src/project/sigdb/manifest';
import fs from 'fs';

/* the wiki is generated with the bundled signature database, which the tests otherwise leave out; a checkout without
   the generated database (`npm run sigdb:sync`) cannot show what some examples need, so these tests wait for it */
const manifest = defaultSigDbPath();
const hasSigDb = manifest !== undefined && fs.existsSync(manifest) && defaultSigDbPaths().length > 0;
describe('the wiki example of every linting rule, with a quick fix exactly when the rule is tagged for one', withTreeSitter(parser => {
	for(const [name, { example, config }] of Object.entries(LintingRuleExamples)) {
		test.runIf(hasSigDb)(name, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
				.unregisterPlugins(SigDbPluginName).registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(...defaultSigDbPaths())).build();
			if(typeof example === 'string') {
				analyzer.addRequest(example);
			} else {
				for(const [file, content] of [['R/code.R', example.code], ...Object.entries(example.files)]) {
					analyzer.addFile(new FlowrInlineTextFile(`/pkg/${file}`, content));
				}
				analyzer.addRequest(requestFromInput(`${fileProtocol}/pkg/R/code.R`));
			}
			const result = (await analyzer.query([{ type: 'linter', rules: [{ name: name as LintingRuleNames, config: (config ?? {}) as never }] }])).linter.results[name as LintingRuleNames];
			assert.isDefined(result, `${name} was not run`);
			assert.isFalse(LintingResults.isError(result), `${name} failed: ${JSON.stringify(result)}`);
			const findings = LintingResults.unpackSuccess(result).results;
			assert.isNotEmpty(findings, `${name} shows no finding`);
			const tagged = (LintingRules[name as LintingRuleNames].info.tags as readonly LintingRuleTag[]).includes(LintingRuleTag.QuickFix);
			assert.strictEqual((findings as readonly { quickFix?: readonly unknown[] }[]).some(f => (f.quickFix?.length ?? 0) > 0), tagged, `${name} ${tagged ? 'is tagged quickfix but its example shows no fix' : 'offers a fix without the quickfix tag'}`);
		});
	}
}));
