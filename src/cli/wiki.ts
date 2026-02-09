import { wikiCli } from '../documentation/wiki-mk/make-wiki';
import { flowrVersion } from '../util/version';
import { WikiFaq } from '../documentation/wiki-faq';
import {
	DocCapabilities,
	WikiCore, WikiDataflowGraph,
	WikiEngine,
	WikiInterface, WikiLintingAndTesting,
	WikiNormalizedAst,
	WikiQuery,
	WikiSearch
} from '../documentation';
import { WikiCfg } from '../documentation/wiki-cfg';
import { WikiOnboarding } from '../documentation/wiki-onboarding';
import { WikiAnalyzer } from '../documentation/wiki-analyzer';
import { IssueLintingRule } from '../documentation/issue-linting-rule';
import { DocReadme } from '../documentation/doc-readme';
import { WikiLinter } from '../documentation/wiki-linter';
import { WikiSetup } from '../documentation/wiki-setup';
import { WikiOverview } from '../documentation/wiki-overview';
import { WikiAbsint } from '../documentation/wiki-absint';
import type { DocMakerLike } from '../documentation/wiki-mk/doc-maker';
import { FlowrRefs } from '../documentation/doc-util/doc-files';

export const AllWikiDocuments = [
	new WikiFaq(),
	new WikiSearch(),
	new WikiCfg(),
	new WikiQuery(),
	new WikiOnboarding(),
	new WikiAnalyzer(),
	new WikiEngine(),
	new WikiNormalizedAst(),
	new WikiCore(),
	new WikiSetup(),
	new WikiOverview(),
	new WikiInterface(),
	new WikiDataflowGraph(),
	new WikiLintingAndTesting(),
	new WikiLinter(),
	new WikiAbsint(),
	new IssueLintingRule(),
	new DocReadme(),
	new DocCapabilities()
] as const satisfies DocMakerLike[];

export type AllWikiDocuments = typeof AllWikiDocuments;

if(require.main === module) {
	wikiCli({
		docs:    AllWikiDocuments,
		refs:    FlowrRefs,
		header:  `flowR (version ${flowrVersion().toString()})`,
		content: 'Documentation (wiki, issue, ...) generator for flowR'
	});
}
