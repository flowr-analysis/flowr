import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { benchmarkSearch } from '../_helper/search';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { FlowrFilter } from '../../../src/search/flowr-search-filters';
import { type CfgInformationArguments, Enrichment } from '../../../src/search/search-executor/search-enrichers';
import { DefaultCfgSimplificationOrder } from '../../../src/control-flow/cfg-simplification';
import { ReadFunctions } from '../../../src/queries/catalog/dependencies-query/function-info/read-functions';
import { WriteFunctions } from '../../../src/queries/catalog/dependencies-query/function-info/write-functions';
import { functionFinderUtil } from '../../../src/linter/rules/function-finder-util';
import { Mapper } from '../../../src/search/search-executor/search-mappers';

describe('flowR search', withTreeSitter(parser => {
	describe('simple', () => {

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
			benchmarkSearch('local multiple', parser, 'f1 <- function() {}\nf2 <- function() {}\n f1(); f2()',
				Q.all().with(Enrichment.CallTargets).filter({ name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CallTargets,
					test:       {
						targets: {
							node: {
								info: {
									id: 4
								}
							}
						}
					}
				} }).map(Mapper.Enrichment, Enrichment.CallTargets)
			);
		});

		describe('complex', () => {
			const code = `
sum <- 0
product <- 1
w <- 7
N <- 10

read.csv("file.csv")

for (i in 1:(N-1)) {
  sum <- sum + i + w
  product <- product * i
}

cat("Sum:", sum, "\n")
cat("Product:", product, "\n")

write.table(data.frame(), file="table.txt")
`.repeat(1000);
			const functions = ReadFunctions.concat(WriteFunctions).map(f => f.name);
			benchmarkSearch('large function finder', parser, code, functionFinderUtil.createSearch(functions));
		});
	});
}));
