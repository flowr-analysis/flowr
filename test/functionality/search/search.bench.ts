import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { benchmarkSearch } from '../_helper/search';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { FlowrFilter } from '../../../src/search/flowr-search-filters';
import { type CfgInformationArguments, Enrichment } from '../../../src/search/search-executor/search-enrichers';
import { DefaultCfgSimplificationOrder } from '../../../src/control-flow/cfg-simplification';

describe('flowR search', withTreeSitter(parser => {
	describe('MatchesEnrichment', () => {
		benchmarkSearch('none', parser, "cat('hello')\nprint('world')",
			Q.all().filter({ name: FlowrFilter.MatchesEnrichment, args: {
				enrichment: Enrichment.CallTargets,
				test:       {
					targets: /library/
				}
			} })
		);
		benchmarkSearch('other', parser, "cat('hello')\nprint('world')",
			Q.all().with(Enrichment.CallTargets).filter({ name: FlowrFilter.MatchesEnrichment, args: {
				enrichment: Enrichment.CallTargets,
				test:       {
					targets: /library/
				}
			} })
		);
		benchmarkSearch('match', parser, "cat('hello')\nprint('world')",
			Q.all().with(Enrichment.CallTargets).filter({ name: FlowrFilter.MatchesEnrichment, args: {
				enrichment: Enrichment.CallTargets,
				test:       {
					targets: /print/
				}
			} })
		);
		const cfgArgs: CfgInformationArguments = {
			checkReachable:       true,
			simplificationPasses: [...DefaultCfgSimplificationOrder, 'analyze-dead-code'],
		};
		benchmarkSearch('reachable always', parser, 'if(TRUE) 1 else 2', Q.all().with(Enrichment.CfgInformation, cfgArgs).filter({
			name: FlowrFilter.MatchesEnrichment, args: {
				enrichment: Enrichment.CfgInformation,
				test:       {
					isReachable: true
				}
			}
		}));
		benchmarkSearch('reachable never', parser, 'if(FALSE) 1 else 2', Q.all().with(Enrichment.CfgInformation, cfgArgs).filter({
			name: FlowrFilter.MatchesEnrichment, args: {
				enrichment: Enrichment.CfgInformation,
				test:       {
					isReachable: /true/
				}
			}
		}));
		benchmarkSearch('reachable no dead code', parser, 'if(FALSE) 1 else 2', Q.all().with(Enrichment.CfgInformation).filter({
			name: FlowrFilter.MatchesEnrichment, args: {
				enrichment: Enrichment.CfgInformation,
				test:       {
					isReachable: false
				}
			}
		}));
		benchmarkSearch('reachable no reachable', parser, 'if(FALSE) 1 else 2', Q.all().with(Enrichment.CfgInformation).filter({
			name: FlowrFilter.MatchesEnrichment, args: {
				enrichment: Enrichment.CfgInformation,
				test:       {
					isReachable: /false/
				}
			}
		}));
	});
}));
