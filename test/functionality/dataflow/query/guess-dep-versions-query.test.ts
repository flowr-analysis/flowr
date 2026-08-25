import { describe, expect, test } from 'vitest';
import { assumeLoadedPackages, withTreeSitter } from '../../_helper/shell';
import { boundsFrom, buildGuessAnalyzer, guessDep, guessed, runGuess, type GuessScenario } from '../../_helper/guess-dep-versions';
import { FlowrConfig } from '../../../../src/config';
import { executeQueries, SupportedQueries } from '../../../../src/queries/query';
import { discardingReplOutput } from '../../_helper/repl';
import { explodeDependencyVersions } from '../../../../src/project/dependency-version-space';
import { asciiSummaryOfQueryResult } from '../../../../src/queries/query-print';
import { ansiFormatter } from '../../../../src/util/text/ansi';
import { Package } from '../../../../src/project/plugins/package-version-plugins/package';
import { FlowrNamespaceFile } from '../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import type { GuessDepVersionsQueryResult } from '../../../../src/queries/catalog/guess-dep-versions-query/guess-dep-versions-query-format';

assumeLoadedPackages('S7', 'cohortBuilder', 'ggplot2');

/** a config pinning the assumed R version, so base-R bounding is deterministic */
function assumedR(version: string): FlowrConfig {
	return FlowrConfig.amend(FlowrConfig.default(), c => {
		c.solver.sigdb.assumedRVersion = version;
	});
}

/** a config that turns the signature database off entirely */
function noSigDb(): FlowrConfig {
	return FlowrConfig.amend(FlowrConfig.default(), c => {
		c.solver.sigdb.enabled = false;
	});
}

describe('Guess dependency versions query', withTreeSitter(ts => {
	/** builds the scenario's analyzer, attaches `namespace` as the analyzed project's own NAMESPACE content, then runs the query */
	async function guessWithNamespace(scenario: GuessScenario, namespace: string): Promise<GuessDepVersionsQueryResult> {
		const analyzer = await buildGuessAnalyzer(ts, scenario);
		analyzer.context().deps.addDependency(new Package({
			name:          'current',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', namespace)).content().current
		}));
		const res = await executeQueries({ analyzer }, [{ type: 'guess-dep-versions', ...scenario.query }]);
		return res['guess-dep-versions'];
	}

	test('a named argument only added in a later version raises the lower bound', async() => {
		const dep = await guessDep(ts, {
			code:     'library(dplyr)\nfilter(x, .by = grp)',
			packages: {
				dplyr: { versions: {
					'1.0.0': { date: '2020-01-01', fns: { filter: ['.data'] } },
					'1.1.0': { date: '2021-01-01', fns: { filter: ['.data', '.by'] } }
				} }
			}
		}, 'dplyr');
		expect(dep?.minVersion).toBe('1.1.0');
		expect(dep?.candidates).toEqual(['1.1.0']);
		expect(boundsFrom(dep, 'signature')).toContain('>=1.1.0');
		expect(dep?.evidence.some(e => e.source === 'signature' && e.parameter === '.by')).toBe(true);
	});

	test('a package the database has no record of is flagged as unknown, not as unconstrained', async() => {
		const scenario = {
			code:     'library(dplyr)\nlibrary(qpgraph)\nfilter(x)\nqpAnyGraph(y)',
			packages: { dplyr: { versions: { '1.0.0': { date: '2020-01-01', fns: { filter: ['.data'] } } } } },
			query:    { packages: ['dplyr', 'qpgraph'] }
		};
		expect((await guessDep(ts, scenario, 'qpgraph'))?.known).toBe(false);
		expect((await guessDep(ts, scenario, 'dplyr'))?.known).toBeUndefined();
	});

	test('a partially-spelled argument (R pmatch) is matched against the signature', async() => {
		// `.d` uniquely abbreviates `.data`, so only a version whose `foo` has `.data` accepts the call
		const dep = await guessDep(ts, {
			code:     'library(pmpkg)\nfoo(.d = x)',
			packages: {
				pmpkg: { versions: {
					'1.0.0': { date: '2020-01-01', fns: { foo: ['other'] } },
					'1.1.0': { date: '2021-01-01', fns: { foo: ['.data'] } }
				} }
			}
		}, 'pmpkg');
		expect(dep?.minVersion).toBe('1.1.0');
		expect(dep?.candidateCount).toBe(1);
	});

	test('a bare call to a function imported via NAMESPACE importFrom marks its source package as used', async() => {
		const res = await guessWithNamespace({
			code:     'index(x)',
			packages: { zoo: { versions: { '1.0': { date: '2020-01-01', fns: { index: [] } } } } }
		}, 'importFrom(zoo, index)');
		expect(guessed(res, 'zoo')?.used).toBe(true);
	});

	test('an S3 method registered for a class the sigdb marks as owned marks that package as used (no direct call)', async() => {
		// mirrors tseries's `S3method("as.irts","zoo")`: the analyzed project never calls zoo directly, but its own
		// NAMESPACE registers a method for class `zoo`, which the sigdb says the `zoo` package OWNS (it exports a
		// same-named constructor `zoo` and registers an S3 method for it)
		const res = await guessWithNamespace({
			code:     'x <- 1', // no call to zoo at all
			packages: { zoo: { versions: { '1.0': { date: '2020-01-01', fns: { zoo: [], 'print.zoo': [] }, s3Classes: ['zoo'] } } } }
		}, 'S3method(as.irts,zoo)');
		expect(guessed(res, 'zoo')?.used).toBe(true);
	});

	test('a class owned by a declared but never called dependency is resolved without scanning the database', async() => {
		// `dbpkg` also owns the class, and comes first in the database; the declared `zoo` is the answer that is in play
		const res = await guessWithNamespace({
			code:     'x <- 1',
			declared: { zoo: '*' },
			packages: {
				dbpkg: { versions: { '1.0': { date: '2019-01-01', fns: { zoo: [] }, s3Classes: ['zoo'] } } },
				zoo:   { versions: { '1.0': { date: '2020-01-01', fns: { zoo: [], 'print.zoo': [] }, s3Classes: ['zoo'] } } }
			}
		}, 'S3method(as.irts,zoo)');
		expect(guessed(res, 'zoo')?.used).toBe(true);
		expect(guessed(res, 'dbpkg')).toBeUndefined();
	});

	test('an S3 method registered for a class NOT owned by any package does not mark anything used', async() => {
		// force `zoo` into the guessed set (it is neither called nor a declared dependency) so `used` is reported at all
		const res = await guessWithNamespace({
			code:     'x <- 1',
			// zoo does not export a same-named constructor -> does not own class `zoo` -> not an owner
			packages: { zoo: { versions: { '1.0': { date: '2020-01-01', fns: { 'print.zoo': [] } } } } },
			query:    { packages: ['zoo'] }
		}, 'S3method(as.irts,zoo)');
		expect(guessed(res, 'zoo')?.used).toBe(false);
	});

	test('a bare class-name string in code does NOT introduce an unrelated package (weak evidence)', async() => {
		const analyzer = await buildGuessAnalyzer(ts, {
			code:     'inherits(x, "zoo")',
			packages: { zoo: { versions: { '1.0': { date: '2020-01-01', fns: { zoo: [] }, s3Classes: ['zoo'] } } } }
		});
		const res = await executeQueries({ analyzer }, [{ type: 'guess-dep-versions' as const }]);
		expect(guessed(res['guess-dep-versions'], 'zoo')).toBeUndefined();
	});

	test('a class used in code narrows an already-known dependency by the constructor that first carries it', async() => {
		const dep = await guessDep(ts, {
			code:     'library(zoo)\ninherits(x, "yearmon")',
			packages: { zoo: { versions: {
				'1.0': { date: '2019-01-01', fns: { zoo: [] }, s3Classes: ['zoo'] },
				'2.0': { date: '2020-01-01', fns: { zoo: [], yearmon: [] }, s3Classes: ['zoo', 'yearmon'] }
			} } }
		}, 'zoo');
		expect(dep?.used).toBe(true);
		expect(dep?.minVersion).toBe('2.0');
		expect(dep?.candidates).not.toContain('1.0');
	});

	test('an S4 class instantiated in code narrows its owning (loaded) dependency by the class-introducing version', async() => {
		const dep = await guessDep(ts, {
			code:     'library(sp)\nnew("SpatialPoints")',
			packages: { sp: { versions: {
				'1.0': { date: '2019-01-01', fns: { bbox: [] } },
				'2.0': { date: '2020-01-01', fns: { bbox: [] }, s4Classes: ['SpatialPoints'] }
			} } }
		}, 'sp');
		expect(dep?.used).toBe(true);
		expect(dep?.minVersion).toBe('2.0');
		expect(dep?.candidates).not.toContain('1.0');
	});

	test('arc consistency drops a version whose requirement no surviving partner version can meet, and marks the count an upper bound', async() => {
		const res = await runGuess(ts, {
			code:     'library(A)\nlibrary(B)',
			packages: {
				A: { versions: {
					'1.0': { date: '2019-01-01', fns: { af: [] }, deps: { B: '>= 1.0' } },
					'2.0': { date: '2020-01-01', fns: { af: [] }, deps: { B: '>= 2.0' } }
				} },
				B: { versions: { '1.0': { date: '2019-01-01', fns: { bf: [] } } } }
			}
		});
		const a = guessed(res, 'A');
		expect(a?.candidates).not.toContain('2.0');
		expect(a?.maxVersion).toBe('1.0');
		// only A is a counted factor (one surviving version of two); B keeps all its versions so is not counted
		expect(res.runnableCombinations).toBe(1);
		expect(res.possibleCombinations).toBe(2);
	});

	test('a variadic (...) absorbs a named argument, so it raises no version bound', async() => {
		// `custom` matches no explicit parameter, but `...` accepts it in every version, so it neither bounds nor rejects
		const dep = await guessDep(ts, {
			code:     'library(vpkg)\nf(custom = 1)',
			packages: { vpkg: { versions: {
				'1.0.0': { date: '2019-01-01', fns: { f: ['a', '...'] } },
				'2.0.0': { date: '2020-01-01', fns: { f: ['a', '...'] } }
			} } }
		}, 'vpkg');
		expect(dep?.evidence.some(e => e.source === 'signature' && e.parameter === 'custom')).toBe(false);
		expect(dep?.candidateCount).toBe(2);
	});

	test('a function only introduced later raises the lower bound', async() => {
		const dep = await guessDep(ts, {
			code:     'library(stringr)\nstr_like("a", "b")',
			packages: {
				stringr: { versions: {
					'1.0.0': { date: '2019-01-01', fns: { str_detect: ['string', 'pattern'] } },
					'1.4.0': { date: '2021-01-01', fns: { str_detect: ['string', 'pattern'], str_like: ['string', 'pattern'] } }
				} }
			}
		}, 'stringr');
		expect(dep?.minVersion).toBe('1.4.0');
		expect(boundsFrom(dep, 'signature')).toContain('>=1.4.0');
		expect(dep?.evidence.some(e => e.source === 'signature' && /exists only from/.test(e.detail))).toBe(true);
	});

	test('a date cutoff caps the guess to releases available at that day', async() => {
		const res = await runGuess(ts, {
			code:     'library(multi)\nmfn()',
			query:    { date: '2021.06.01' },
			packages: {
				multi: { versions: {
					'1.0.0': { date: '2020-01-01', fns: { mfn: [] } },
					'1.5.0': { date: '2021-01-01', fns: { mfn: [] } },
					'2.0.0': { date: '2022-01-01', fns: { mfn: [] } }
				} }
			}
		});
		expect(res.dateCutoff).toBe('2021-06-01');
		const dep = guessed(res, 'multi');
		expect(dep?.maxVersion).toBe('1.5.0');
		expect(dep?.candidates).toEqual(['1.0.0', '1.5.0']);
		expect(boundsFrom(dep, 'date')).toContain('<=2021-06-01');
	});

	test('a declared constraint bounds the range and is recorded as provenance', async() => {
		const dep = await guessDep(ts, {
			code:     'library(pkg4)\nf()',
			declared: { pkg4: '>= 1.5.0' },
			packages: {
				pkg4: { versions: {
					'1.0.0': { date: '2019-01-01', fns: { f: [] } },
					'1.5.0': { date: '2020-01-01', fns: { f: [] } },
					'2.0.0': { date: '2021-01-01', fns: { f: [] } }
				} }
			}
		}, 'pkg4');
		expect(dep?.minVersion).toBe('1.5.0');
		expect(dep?.candidates).toEqual(['1.5.0', '2.0.0']);
		expect(dep?.evidence.some(e => e.source === 'declared')).toBe(true);
	});

	test('a transitive constraint from another dependency is gathered with its origin', async() => {
		const dep = await guessDep(ts, {
			code:     'library(parentpkg)\npf()',
			declared: { parentpkg: '*' },
			query:    { packages: ['childpkg'] },
			packages: {
				parentpkg: { latest:   '2.0.0', versions: {
					'2.0.0': { date: '2021-01-01', fns: { pf: [] }, deps: { childpkg: '>= 1.0.0' } }
				} },
				childpkg: { versions: {
					'0.9.0': { date: '2019-01-01', fns: { cf: [] } },
					'1.0.0': { date: '2020-01-01', fns: { cf: [] } },
					'1.2.0': { date: '2021-01-01', fns: { cf: [] } }
				} }
			}
		}, 'childpkg');
		expect(dep?.minVersion).toBe('1.0.0');
		expect(dep?.candidates).toEqual(['1.0.0', '1.2.0']);
		const transitive = dep?.evidence.find(e => e.source === 'transitive');
		expect(transitive?.bound).toBe('>= 1.0.0');
		expect(transitive?.origin).toContain('parentpkg');
	});

	test('a base-R package is bounded by the assumed R version', async() => {
		const res = await runGuess(ts, {
			code:     'paste("a")',
			config:   assumedR('4.3.0'),
			packages: {
				base: { base:     true, latest:   '4.4.0', versions: {
					'4.2.0': { fns: { paste: ['...'] } },
					'4.3.0': { fns: { paste: ['...'] } },
					'4.4.0': { fns: { paste: ['...'] } }
				} }
			}
		});
		expect(res.rVersion).toBe('4.3.0');
		const dep = guessed(res, 'base');
		expect(dep?.base).toBe(true);
		expect(dep?.maxVersion).toBe('4.3.0');
		expect(boundsFrom(dep, 'base-r')).toContain('<=4.3.0');
	});

	test('a base package is not bounded by R when the version is only the fallback default (auto mode)', async() => {
		// no `assumedRVersion` pin, no metadata, no detected R: the guess must not impose flowR's fallback as a base-R ceiling
		const res = await runGuess(ts, {
			code:     'paste("a")',
			packages: {
				base: { base:     true, latest:   '4.4.0', versions: {
					'4.2.0': { fns: { paste: ['...'] } },
					'4.3.0': { fns: { paste: ['...'] } },
					'4.4.0': { fns: { paste: ['...'] } }
				} }
			}
		});
		const dep = guessed(res, 'base');
		expect(boundsFrom(dep, 'base-r')).toEqual([]); // no R ceiling imposed
		expect(res.rVersion).toBeUndefined();
	});

	test('an untracked base primitive does not zero out a base package', async() => {
		// `c` is a base primitive absent from the db; it must not reject every version (which reported 0 candidates)
		const dep = await guessDep(ts, {
			code:     'paste(c(1, 2))',
			config:   assumedR('4.4.0'),
			packages: {
				base: { base:     true, latest:   '4.4.0', versions: {
					'4.2.0': { fns: { paste: ['...'] } },
					'4.3.0': { fns: { paste: ['...'] } },
					'4.4.0': { fns: { paste: ['...'] } }
				} }
			}
		}, 'base');
		expect(dep?.candidateCount).toBeGreaterThan(0);
	});

	test('a base primitive captured only in early releases does not cap or zero the base package', async() => {
		// `c` (a real base primitive) is recorded at 1.0.0 but not 2.0.0 -- a data gap, not a removal
		const dep = await guessDep(ts, {
			code:     'c(1)\nmyfun()',
			config:   assumedR('2.0.0'),
			packages: {
				base: { base:     true, latest:   '2.0.0', versions: {
					'1.0.0': { fns: { c: [], myfun: [] } },
					'2.0.0': { fns: { myfun: [] } }
				} }
			}
		}, 'base');
		expect(dep?.candidateCount).toBeGreaterThan(0);
		expect((dep?.evidence ?? []).some(e => e.function === 'base::c')).toBe(false); // primitive raises no bound
	});

	test('the summary renders a function with both a lower and an upper bound without crashing', async() => {
		const analyzer = await buildGuessAnalyzer(ts, {
			code:     'library(pkg)\nf(p = 1)',
			packages: { pkg: { versions: {
				'1.0.0': { date: '2020-01-01', fns: {} },              // no f
				'2.0.0': { date: '2021-01-01', fns: { f: ['p'] } },    // f gains parameter p
				'3.0.0': { date: '2022-01-01', fns: { f: ['q'] } }     // p genuinely dropped (a different, non-empty signature)
			} } }
		});
		const q = [{ type: 'guess-dep-versions' as const }];
		const res = await executeQueries({ analyzer }, q);
		const ascii = await asciiSummaryOfQueryResult(ansiFormatter, 0, res, analyzer, q);
		expect(ascii).toContain('pkg');            // the package heads its block
		expect(ascii).toContain('f (');            // the bare function name (package is already in the header)
		expect(ascii).toContain('>=2.0.0');
		expect(ascii).toContain('<=2.0.0');
	});

	test('a parameter absorbed by a generic (empty later capture) raises no false upper bound', async() => {
		// mirrors real `base::seq`: captured as `[x, ...]` early, then `[]` once it became a generic; `length.out`
		// still binds through dispatch, so a call using it must not report the parameter as removed
		const dep = await guessDep(ts, {
			code:     'library(pkg)\nf(length.out = 1)',
			packages: { pkg: { versions: {
				'1.0.0': { date: '2020-01-01', fns: { f: ['x', '...'] } },
				'2.0.0': { date: '2021-01-01', fns: { f: [] } },
				'3.0.0': { date: '2022-01-01', fns: { f: [] } }
			} } }
		}, 'pkg');
		// no signature evidence bounds the version from above (`<=...`): the empty capture cannot disprove the call
		expect((dep?.evidence ?? []).some(e => e.source === 'signature' && e.bound?.startsWith('<='))).toBe(false);
		expect(dep?.candidateCount).toBe(3);
	});

	test('configured linked package groups resolve to one shared version', async() => {
		// pkgA and pkgB are declared a linked group, so a release is only usable when both have it; pkgA loses 1.0.0 (pkgB lacks it)
		const linked = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.solver.versionManagement = { linkedVersionGroups: [['pkgA', 'pkgB']] };
		});
		const res = await runGuess(ts, {
			code:     'library(pkgA)\nlibrary(pkgB)\naf()\nbf()',
			config:   linked,
			packages: {
				pkgA: { versions: {
					'1.0.0': { date: '2019-01-01', fns: { af: [] } },
					'2.0.0': { date: '2020-01-01', fns: { af: [] } }
				} },
				pkgB: { versions: { '2.0.0': { date: '2020-01-01', fns: { bf: [] } } } }
			}
		});
		expect(guessed(res, 'pkgA')?.candidates).toEqual(['2.0.0']);
		expect(res.linkedGroups).toContainEqual(['pkgA', 'pkgB']);
		/* each package also names its partners, so the link is visible per dependency */
		expect(guessed(res, 'pkgA')?.linkedWith).toEqual(['pkgB']);
		expect(guessed(res, 'pkgB')?.linkedWith).toEqual(['pkgA']);
	});

	test('a transitive requirement is re-derived from the depending package guessed version (mutual constraints)', async() => {
		// A is unconstrained, so its guessed lower bound is 1.0.0, whose requirement is B >= 1.0.0; the resolved-latest
		// A 2.0.0 would instead force B >= 2.0.0, so B 1.0.0 only survives because the second pass reads A at its guess
		const res = await runGuess(ts, {
			code:     'library(A)\nlibrary(B)\naf()\nbf()',
			declared: { A: '*' },
			packages: {
				A: { latest:   '2.0.0', versions: {
					'1.0.0': { date: '2019-01-01', fns: { af: [] }, deps: { B: '>= 1.0.0' } },
					'2.0.0': { date: '2021-01-01', fns: { af: [] }, deps: { B: '>= 2.0.0' } }
				} },
				B: { versions: {
					'1.0.0': { date: '2019-01-01', fns: { bf: [] } },
					'2.0.0': { date: '2021-01-01', fns: { bf: [] } }
				} }
			}
		});
		expect(guessed(res, 'B')?.candidates).toContain('1.0.0');
	});

	test('a transitive requirement only some versions of the depending package declare does not filter', async() => {
		const res = await runGuess(ts, {
			code:     'library(A)\nlibrary(B)\naf()\nbf()',
			declared: { A: '*' },
			packages: {
				A: { latest:   '2.0.0', versions: {
					'1.0.0': { date: '2019-01-01', fns: { af: [] } },
					'2.0.0': { date: '2021-01-01', fns: { af: [] }, deps: { B: '>= 1.0.0' } }
				} },
				B: { versions: {
					'0.9.0': { date: '2018-01-01', fns: { bf: [] } },
					'1.0.0': { date: '2019-01-01', fns: { bf: [] } }
				} }
			}
		});
		expect(guessed(res, 'B')?.candidates).toEqual(['0.9.0', '1.0.0']);
		const transitive = guessed(res, 'B')?.evidence.find(e => e.source === 'transitive');
		expect(transitive?.partial).toBe(true);
		expect(transitive?.bound).toBe('>= 1.0.0');
	});

	test('a transitive requirement every version declares filters with the weakest of them', async() => {
		const res = await runGuess(ts, {
			code:     'library(A)\nlibrary(B)\naf()\nbf()',
			declared: { A: '*' },
			packages: {
				A: { latest:   '2.0.0', versions: {
					'1.0.0': { date: '2019-01-01', fns: { af: [] }, deps: { B: '>= 1.0.0' } },
					'2.0.0': { date: '2021-01-01', fns: { af: [] }, deps: { B: '>= 2.0.0' } }
				} },
				B: { versions: {
					'0.9.0': { date: '2018-01-01', fns: { bf: [] } },
					'1.0.0': { date: '2019-01-01', fns: { bf: [] } },
					'2.0.0': { date: '2021-01-01', fns: { bf: [] } }
				} }
			}
		});
		expect(guessed(res, 'B')?.candidates).toEqual(['1.0.0', '2.0.0']);
		const transitive = guessed(res, 'B')?.evidence.find(e => e.source === 'transitive');
		expect(transitive?.partial).toBeUndefined();
		expect(transitive?.bound).toBe('>= 1.0.0');
	});

	test('two packages whose versions pin each other are counted as coupled, not as independent factors', async() => {
		// each version of A admits exactly one version of B, so only 2 of the 2x2 tuples actually run
		const res = await runGuess(ts, {
			code:     'library(A)\nlibrary(B)\naf()\nbf()',
			declared: { A: '*' },
			packages: {
				A: { latest:   '2.0.0', versions: {
					'1.0.0': { date: '2019-01-01', fns: { af: [] }, deps: { B: '<= 1.0.0' } },
					'2.0.0': { date: '2021-01-01', fns: { af: [] }, deps: { B: '>= 2.0.0' } }
				} },
				B: { versions: {
					'1.0.0': { date: '2019-01-01', fns: { bf: [] } },
					'2.0.0': { date: '2021-01-01', fns: { bf: [] } }
				} }
			}
		});
		expect(guessed(res, 'B')?.candidates).toEqual(['1.0.0', '2.0.0']);
		expect(res.possibleCombinations).toBe(4);
		expect(res.runnableCombinations).toBe(2);
		expect(guessed(res, 'A')?.coupledWith).toEqual(['B']);
		expect(guessed(res, 'B')?.coupledWith).toEqual(['A']);
	});

	test('a coupling only some versions impose is reported as partial', async() => {
		const res = await runGuess(ts, {
			code:     'library(A)\nlibrary(B)\naf()\nbf()',
			declared: { A: '*' },
			packages: {
				A: { latest:   '2.0.0', versions: {
					'1.0.0': { date: '2019-01-01', fns: { af: [] } },
					'2.0.0': { date: '2021-01-01', fns: { af: [] }, deps: { B: '>= 2.0.0' } }
				} },
				B: { versions: {
					'1.0.0': { date: '2019-01-01', fns: { bf: [] } },
					'2.0.0': { date: '2021-01-01', fns: { bf: [] } }
				} }
			}
		});
		expect(guessed(res, 'A')?.coupledWith).toEqual(['B (partial)']);
		// A 1.0.0 runs with either B, A 2.0.0 only with B 2.0.0
		expect(res.runnableCombinations).toBe(3);
	});

	test('the declared constraints give the baseline the runnable count is also reported against', async() => {
		const scenario: GuessScenario = {
			code:     'library(pkg)\nf(x, extra = 1)',
			declared: { pkg: '>= 2.0.0' },
			packages: { pkg: { versions: {
				'1.0.0': { date: '2019-01-01', fns: { f: ['x'] } },
				'2.0.0': { date: '2020-01-01', fns: { f: ['x'] } },
				'3.0.0': { date: '2021-01-01', fns: { f: ['x', 'extra'] } },
				'4.0.0': { date: '2022-01-01', fns: { f: ['x', 'extra'] } }
			} } }
		};
		const res = await runGuess(ts, scenario);
		expect(res.possibleCombinations).toBe(4);    // every release in the database
		expect(res.declaredCombinations).toBe(3);    // what `>= 2.0.0` alone leaves
		expect(res.runnableCombinations).toBe(2);    // plus the `extra` argument, so 3.0.0 and 4.0.0
		const q = [{ type: 'guess-dep-versions' as const }];
		const analyzer = await buildGuessAnalyzer(ts, scenario);
		const ascii = await asciiSummaryOfQueryResult(ansiFormatter, 0, await executeQueries({ analyzer }, q), analyzer, q);
		expect(ascii).toContain('67% of declared');
	});

	test('nothing declared reports no declared baseline', async() => {
		const res = await runGuess(ts, {
			code:     'library(pkg)\nf(x)',
			packages: { pkg: { versions: {
				'1.0.0': { date: '2019-01-01', fns: { f: ['x'] } },
				'2.0.0': { date: '2020-01-01', fns: { f: ['x'] } }
			} } }
		});
		expect(res.declaredCombinations).toBeUndefined();
	});

	test('the `fun` argument flowR synthesizes for an S7 constructor is not held against a version', async() => {
		// `new_class` has no `fun` parameter in any release; counting the synthetic one would reject every version
		const dep = await guessDep(ts, {
			code:     'cls <- S7::new_class("gg", abstract = TRUE)',
			packages: { S7: { versions: {
				'0.1.0': { date: '2023-01-01', fns: { new_class: ['name', 'parent', 'package', 'properties', 'abstract', 'constructor', 'validator'] } },
				'0.2.0': { date: '2024-01-01', fns: { new_class: ['name', 'parent', 'package', 'properties', 'abstract', 'constructor', 'validator'] } }
			} } }
		}, 'S7');
		expect(dep?.candidates).toEqual(['0.1.0', '0.2.0']);
	});

	test('the data-coverage envelope is reported as explicit `available` evidence', async() => {
		// the guess can never fall outside the versions the database has data for; that outer bound is stated, not silently applied
		const dep = await guessDep(ts, {
			code:     'library(pkg)\nf()',
			packages: { pkg: { versions: {
				'1.0.0': { date: '2019-01-01', fns: { f: [] } },
				'2.0.0': { date: '2020-01-01', fns: { f: [] } },
				'3.0.0': { date: '2021-01-01', fns: { f: [] } }
			} } }
		}, 'pkg');
		expect(boundsFrom(dep, 'available')).toEqual(['>=1.0.0', '<=3.0.0']);
	});

	test('the R version is guessed from the base package timeline it shares', async() => {
		// `R` has no signature source of its own; its releases are the base package's, so it reuses that history
		const dep = await guessDep(ts, {
			code:     'paste("a")',
			declared: { R: '>= 3.5.0' },
			config:   assumedR('4.0.0'),
			packages: {
				base: { base:     true, latest:   '4.0.0', versions: {
					'3.4.0': { fns: { paste: ['...'] } },
					'3.5.0': { fns: { paste: ['...'] } },
					'4.0.0': { fns: { paste: ['...'] } }
				} }
			}
		}, 'R');
		expect(dep?.candidates).toEqual(['3.5.0', '4.0.0']); // declared R >= 3.5.0, bounded above by assumed R 4.0.0
		expect(dep?.evidence.some(e => e.source === 'declared')).toBe(true);
	});

	test('clean mode ignores the project declared constraints', async() => {
		const scenario = {
			code:     'library(pkg)',
			declared: { pkg: '<= 1.0.0' },
			packages: { pkg: { versions: {
				'1.0.0': { date: '2020-01-01', fns: { f: [] } },
				'2.0.0': { date: '2021-01-01', fns: { f: [] } }
			} } }
		} as const;
		const declared = await guessDep(ts, scenario, 'pkg');
		const cleaned = await guessDep(ts, { ...scenario, query: { clean: true } }, 'pkg');
		expect(declared?.candidateCount).toBe(1);                                            // declared `<= 1.0.0` restricts
		expect(cleaned?.candidateCount).toBe(2);                                             // clean ignores it
		expect((cleaned?.evidence ?? []).some(e => e.source === 'declared')).toBe(false);
	});

	test('disabled excludes individual evidence sources independently, unlike clean which bundles declared+transitive', async() => {
		const scenario = {
			code:     'library(dplyr)\nfilter(x, .by = grp)',
			declared: { dplyr: '<= 1.0.5' },
			packages: { dplyr: { versions: {
				'1.0.0': { date: '2020-01-01', fns: { filter: ['.data'] } },
				'1.1.0': { date: '2021-01-01', fns: { filter: ['.data', '.by'] } }
			} } }
		} as const;
		const both = await guessDep(ts, scenario, 'dplyr');
		expect(both?.candidateCount).toBe(0);                                                // declared <=1.0.5 excludes the version the signature requires

		const noDeclared = await guessDep(ts, { ...scenario, query: { disabled: ['declared'] } }, 'dplyr');
		expect(noDeclared?.minVersion).toBe('1.1.0');
		expect((noDeclared?.evidence ?? []).some(e => e.source === 'declared')).toBe(false);
		expect((noDeclared?.evidence ?? []).some(e => e.source === 'signature')).toBe(true);

		const noSignature = await guessDep(ts, { ...scenario, query: { disabled: ['signature'] } }, 'dplyr');
		expect(noSignature?.minVersion).toBe('1.0.0');
		expect((noSignature?.evidence ?? []).some(e => e.source === 'signature')).toBe(false);
		expect((noSignature?.evidence ?? []).some(e => e.source === 'declared')).toBe(true);

		const disableBoth = await guessDep(ts, { ...scenario, query: { disabled: ['declared', 'signature'] } }, 'dplyr');
		expect(disableBoth?.candidateCount).toBe(2);
		expect((disableBoth?.evidence ?? []).some(e => e.source === 'declared' || e.source === 'signature')).toBe(false);
	});

	test('--disabled decodes evidence letters to a disabled list', () => {
		const parser = SupportedQueries['guess-dep-versions'].fromLine;
		const parsed = parser(discardingReplOutput, ['--disabled', 'ds', 'library(x)'], FlowrConfig.default());
		const query = Array.isArray(parsed.query) ? parsed.query[0] : parsed.query;
		expect([...(query?.disabled ?? [])].sort()).toEqual(['declared', 'signature']);
	});

	test('contradictory declared constraints are reported as unsatisfiable', async() => {
		const dep = await guessDep(ts, {
			code:     'library(conflict)',
			declared: { conflict: ['>= 2.0.0', '<= 1.0.0'] },
			packages: {
				conflict: { versions: {
					'1.0.0': { date: '2019-01-01', fns: { f: [] } },
					'2.0.0': { date: '2021-01-01', fns: { f: [] } }
				} }
			}
		}, 'conflict');
		expect(dep?.unsatisfiable).toBe(true);
	});

	test('the same constraint discovered twice is recorded only once', async() => {
		const dep = await guessDep(ts, {
			code:     'library(dplyr)\nfilter(x, .by = g)\nfilter(y, .by = h)',
			packages: {
				dplyr: { versions: {
					'1.0.0': { date: '2020-01-01', fns: { filter: ['.data'] } },
					'1.1.0': { date: '2021-01-01', fns: { filter: ['.data', '.by'] } }
				} }
			}
		}, 'dplyr');
		const signature = dep?.evidence.filter(e => e.source === 'signature' && e.parameter === '.by') ?? [];
		expect(signature).toHaveLength(1);
	});

	test('an empty candidate set from usage is not reported as unsatisfiable when the declared range is fine', async() => {
		const dep = await guessDep(ts, {
			code:     'library(dplyr)\nfilter(x, .nonexistent = 1)',
			declared: { dplyr: '>= 1.0.0' },
			packages: {
				dplyr: { versions: {
					'1.0.0': { date: '2020-01-01', fns: { filter: ['.data'] } },
					'1.1.0': { date: '2021-01-01', fns: { filter: ['.data', '.by'] } }
				} }
			}
		}, 'dplyr');
		expect(dep?.candidateCount).toBe(0);
		expect(dep?.unsatisfiable).toBeUndefined();
	});

	test('a date cutoff excludes an undated CRAN release rather than leaking it', async() => {
		const dep = await guessDep(ts, {
			code:     'library(undatedpkg)\nf()',
			query:    { date: '2020.01.01' },
			packages: {
				undatedpkg: { versions: {
					'1.0.0': { date: '2019-01-01', fns: { f: [] } },
					'2.0.0': { fns: { f: [] } }
				} }
			}
		}, 'undatedpkg');
		expect(dep?.maxVersion).toBe('1.0.0');
		expect(dep?.candidates).toEqual(['1.0.0']);
	});

	test('a version rejected between the surviving min and max is shown explicitly, not as a contiguous range', async() => {
		const dep = await guessDep(ts, {
			code:     'library(gappkg)\nfoo(a, opt = 1)',
			packages: {
				gappkg: { versions: {
					'1.0.0': { date: '2019-01-01', fns: { foo: ['x', 'opt'] } },
					'1.1.0': { date: '2020-01-01', fns: { foo: ['x'] } },
					'1.2.0': { date: '2021-01-01', fns: { foo: ['x', 'opt'] } }
				} }
			}
		}, 'gappkg');
		expect(dep?.candidates).toEqual(['1.0.0', '1.2.0']);
		expect(dep?.range).toBe('1.0.0, 1.2.0');
	});

	const explodeScenario: GuessScenario = {
		code:     'library(pkgA)\nfa()\nlibrary(pkgB)\nfb()',
		query:    { packages: ['pkgA', 'pkgB'] },
		packages: {
			pkgA: { versions: {
				'1.0.0': { date: '2020-01-01', fns: { fa: [] } },
				'2.0.0': { date: '2021-01-01', fns: { fa: [] } }
			} },
			pkgB: { versions: {
				'1.0.0': { date: '2020-01-01', fns: { fb: [] } },
				'1.1.0': { date: '2021-01-01', fns: { fb: [] } }
			} }
		}
	};

	test('explode yields the full assignment space, newest-first by default', async() => {
		const res = await runGuess(ts, { ...explodeScenario, query: { ...explodeScenario.query, explode: {} } });
		expect(res.assignments).toHaveLength(4);
		expect(res.assignments?.[0].versions).toEqual({ pkgA: '2.0.0', pkgB: '1.1.0' });
		expect(res.assignments?.at(-1)?.versions).toEqual({ pkgA: '1.0.0', pkgB: '1.0.0' });
	});

	test('explode with order oldest starts from the oldest versions', async() => {
		const res = await runGuess(ts, { ...explodeScenario, query: { ...explodeScenario.query, explode: { order: 'oldest' } } });
		expect(res.assignments?.[0].versions).toEqual({ pkgA: '1.0.0', pkgB: '1.0.0' });
	});

	test('maxIterations bounds the fixpoint loops without changing a converged result', async() => {
		const res = await runGuess(ts, { ...explodeScenario, query: { ...explodeScenario.query, maxIterations: 1 } });
		expect(guessed(res, 'pkgA')?.range).toBe(guessed(await runGuess(ts, explodeScenario), 'pkgA')?.range);
	});

	test('explode honors a preferred version and a limit', async() => {
		const res = await runGuess(ts, { ...explodeScenario, query: { ...explodeScenario.query, explode: { prefer: { pkgA: '1.0.0' }, limit: 2 } } });
		expect(res.assignments).toHaveLength(2);
		expect(res.assignments?.[0].versions.pkgA).toBe('1.0.0');
	});

	test('explode survives merging of several guess-dep-versions queries', async() => {
		const analyzer = await buildGuessAnalyzer(ts, explodeScenario);
		const results = await executeQueries({ analyzer }, [
			{ type: 'guess-dep-versions', packages: ['pkgA', 'pkgB'] },
			{ type: 'guess-dep-versions', explode: {} }
		]);
		expect(results['guess-dep-versions'].assignments).toHaveLength(4);
	});

	test('the explodeDependencyVersions iterator lazily yields the most-preferred assignment first', async() => {
		const analyzer = await buildGuessAnalyzer(ts, explodeScenario);
		let first: Record<string, string> | undefined;
		for await (const a of explodeDependencyVersions(analyzer, { packages: ['pkgA', 'pkgB'] })) {
			first = Object.fromEntries(a.versions);
			break;
		}
		expect(first).toEqual({ pkgA: '2.0.0', pkgB: '1.1.0' });
	});

	test('a combination whose versions cannot be loaded together is not proposed', async() => {
		// pkgA 2.0.0 needs pkgB >= 2.0.0, pkgA 1.0.0 only >= 1.0.0; merged over both, pkgB 1.0.0 stays a candidate,
		// so the raw product still pairs it with pkgA 2.0.0 -- the pairing `library()` rejects
		const scenario: GuessScenario = {
			code:     'library(pkgA)\nlibrary(pkgB)\nfa(x)\nfb(y)',
			packages: {
				pkgA: { versions: {
					'1.0.0': { date: '2020-01-01', fns: { fa: ['x'] }, deps: { pkgB: '>= 1.0.0' } },
					'2.0.0': { date: '2021-01-01', fns: { fa: ['x'] }, deps: { pkgB: '>= 2.0.0' } }
				} },
				pkgB: { versions: {
					'1.0.0': { date: '2020-01-01', fns: { fb: ['y'] } },
					'2.0.0': { date: '2021-01-01', fns: { fb: ['y'] } }
				} }
			},
			query: { packages: ['pkgA', 'pkgB'], explode: {} }
		};
		const assignments = (await runGuess(ts, scenario)).assignments;
		expect(assignments).toBeDefined();
		expect(assignments).not.toContainEqual({ versions: { pkgA: '2.0.0', pkgB: '1.0.0' } });
		for(const { versions } of assignments ?? []) {
			expect(versions.pkgA === '2.0.0' ? versions.pkgB : '2.0.0').toBe('2.0.0');
		}
	});

	test('the assumed R version says where it comes from', async() => {
		const scenario: GuessScenario = {
			code:     'library(pkgA)\nfa(x)',
			packages: { pkgA: { versions: { '1.0.0': { date: '2020-01-01', fns: { fa: ['x'] } } } } },
			query:    { packages: ['pkgA'] }
		};
		const detected = await runGuess(ts, scenario);
		// nothing states an R version, so none is assumed and none is reported
		expect(detected.rVersion).toBeUndefined();
		expect(detected.rVersionOrigin).toBeUndefined();
		const pinned = await runGuess(ts, { ...scenario, config: assumedR('4.0.5') });
		expect(pinned.rVersion).toBe('4.0.5');
		expect(pinned.rVersionOrigin).toBe('config');
	});

	test('a requirement on a package outside the assignment is reported instead of silently passing', async() => {
		// pkgA needs helper, which is neither declared nor used, so nothing here can settle that requirement
		const scenario: GuessScenario = {
			code:     'library(pkgA)\nfa(x)',
			packages: {
				pkgA:   { versions: { '1.0.0': { date: '2020-01-01', fns: { fa: ['x'] }, deps: { helper: '>= 2.0.0' } } } },
				helper: { versions: { '1.0.0': { date: '2020-01-01', fns: { fh: [] } } } }
			},
			query: { packages: ['pkgA'], explode: {} }
		};
		const assignments = (await runGuess(ts, scenario)).assignments;
		expect(assignments?.[0].versions).toEqual({ pkgA: '1.0.0' });
		expect(assignments?.[0].unverified).toEqual(['pkgA 1.0.0 requires helper >= 2.0.0']);
	});

	test('a suggested package neither rejects an assignment nor counts as unverified', async() => {
		const scenario: GuessScenario = {
			code:     'library(pkgA)\nlibrary(pkgB)\nfa(x)\nfb(y)',
			packages: {
				pkgA: { versions: { '1.0.0': { date: '2020-01-01', fns: { fa: ['x'] }, suggests: { pkgB: '>= 2.0.0' } } } },
				pkgB: { versions: { '1.0.0': { date: '2020-01-01', fns: { fb: ['y'] } } } }
			},
			query: { packages: ['pkgA', 'pkgB'], explode: {} }
		};
		const assignments = (await runGuess(ts, scenario)).assignments;
		expect(assignments).toEqual([{ versions: { pkgA: '1.0.0', pkgB: '1.0.0' } }]);
	});

	test('a package nothing narrows says so, so its range is not read as a constraint', async() => {
		const scenario: GuessScenario = {
			code:     'library(pkgA)\nfa(x)',
			packages: { pkgA: { versions: {
				'1.0.0': { date: '2020-01-01', fns: { fa: ['x'] } },
				'2.0.0': { date: '2021-01-01', fns: { fa: ['x'] } }
			} } },
			query: { packages: ['pkgA'] }
		};
		expect((await guessDep(ts, scenario, 'pkgA'))?.constrained).toBe(false);
		// the parameter `x` only exists from 2.0.0, so naming it narrows the guess
		const narrowed: GuessScenario = { ...scenario, code:     'library(pkgA)\nfa(x = 1)', packages: { pkgA: { versions: {
			'1.0.0': { date: '2020-01-01', fns: { fa: ['other'] } },
			'2.0.0': { date: '2021-01-01', fns: { fa: ['x'] } }
		} } } };
		const dep = await guessDep(ts, narrowed, 'pkgA');
		expect(dep?.constrained).toBeUndefined();
		expect(dep?.range).toBe('2.0.0');
	});

	test('without a signature database the query explains why it cannot guess', async() => {
		const res = await runGuess(ts, {
			code:     'library(dplyr)',
			config:   noSigDb(),
			packages: { dplyr: { versions: { '1.0.0': { fns: { filter: ['.data'] } } } } }
		});
		expect(res.dependencies).toHaveLength(0);
		expect(res.message).toMatch(/signature database/);
	});

	describe('orphan calls', () => {
		test('a bare call infers the single package that exports it, bounds its version, and flags it for attachment', async() => {
			// `ggplot2` is neither declared nor loaded; the bare `ggplot(data = ...)` would be undefined without it.
			// The `data` parameter only exists from 3.0.0, so the orphan usage narrows the version just like a qualified call.
			const dep = await guessDep(ts, {
				code:     'ggplot(data = df)',
				packages: { ggplot2: { versions: {
					'2.0.0': { date: '2015-01-01', fns: { ggplot: ['mapping'] } },
					'3.0.0': { date: '2018-01-01', fns: { ggplot: ['data', 'mapping'] } }
				} } }
			}, 'ggplot2');
			expect(dep).toBeDefined();
			expect(dep?.orphan).toBe(true);
			expect(dep?.orphanFunctions).toEqual(['ggplot']);
			// why it counts as an orphan: where the undefined call is and why ggplot2 got it
			expect(dep?.orphanEvidence).toEqual([{ function: 'ggplot', location: '1:1', reason: 'builtin', exporters: 1 }]);
			expect(dep?.used).toBe(true);
			expect(dep?.minVersion).toBe('3.0.0');
			expect(boundsFrom(dep, 'signature')).toContain('>=3.0.0');
			// why that bound: the call supplying `data` in line 1
			expect(dep?.evidence.find(e => e.source === 'signature' && e.parameter === 'data')?.location).toBe('1:1');
		});

		test('the ascii summary tells the reader to attach the inferred library', async() => {
			const analyzer = await buildGuessAnalyzer(ts, {
				code:     'ggplot()',
				packages: { ggplot2: { versions: { '3.0.0': { date: '2018-01-01', fns: { ggplot: [] } } } } }
			});
			const q = [{ type: 'guess-dep-versions' as const }];
			const ascii = await asciiSummaryOfQueryResult(ansiFormatter, 0, await executeQueries({ analyzer }, q), analyzer, q);
			expect(ascii).toContain('orphan');
			expect(ascii).toContain('library(ggplot2)');
			expect(ascii).toContain('ggplot() at 1:1 resolves to no definition');
		});

		test('the curated map disambiguates a name several packages export (ggplot -> ggplot2)', async() => {
			// `ggplot` is exported by ggplot2 and by extensions/re-exporters (here ggtern); the curated builtin map
			// picks ggplot2 authoritatively rather than giving up as ambiguous
			const res = await runGuess(ts, {
				code:     'ggplot()',
				packages: {
					ggplot2: { versions: { '3.0.0': { date: '2018-01-01', fns: { ggplot: [] } } } },
					ggtern:  { versions: { '3.0.0': { date: '2018-01-01', fns: { ggplot: [] } } } }
				}
			});
			expect(guessed(res, 'ggplot2')?.orphan).toBe(true);
			expect(guessed(res, 'ggtern')).toBeUndefined();
		});

		test('the most downloaded of a few exporters gets the orphan, the rest are reported as alternatives', async() => {
			const res = await runGuess(ts, {
				code:     'draw(x)',
				packages: {
					pkgA: { downloads: 10, versions: { '1.0.0': { date: '2020-01-01', fns: { draw: [] } }, '2.0.0': { date: '2021-01-01', fns: { draw: [] } } } },
					pkgB: { downloads: 9000, versions: { '1.0.0': { date: '2020-01-01', fns: { draw: [] } } } }
				}
			});
			expect(guessed(res, 'pkgB')?.orphan).toBe(true);
			expect(guessed(res, 'pkgA')).toBeUndefined();
			// the loser is not a dependency, but the guess still says which versions of it would have fitted
			expect(guessed(res, 'pkgB')?.orphanAlternatives).toEqual([
				{ package: 'pkgA', range: '>=1.0.0 <=2.0.0', minVersion: '1.0.0', maxVersion: '2.0.0', candidateCount: 2, totalVersions: 2 }
			]);
		});

		test('a loaded exporter explains the call, so no library is proposed for the other one', async() => {
			// dplyr re-exports tidyselect's `everything`, so a script that loads dplyr needs no library(tidyselect)
			const res = await runGuess(ts, {
				code:     'library(pkgA)\ndraw(x)',
				packages: {
					pkgA: { downloads: 10, versions: { '1.0.0': { date: '2020-01-01', fns: { draw: [] } } } },
					pkgB: { downloads: 9000, versions: { '1.0.0': { date: '2020-01-01', fns: { draw: [] } } } }
				}
			});
			expect(guessed(res, 'pkgA')?.orphan).toBeUndefined();
			expect(guessed(res, 'pkgB')).toBeUndefined();
		});

		test('running the query twice on one analyzer gives the same answer', async() => {
			const analyzer = await buildGuessAnalyzer(ts, {
				code:     'draw(x)',
				packages: {
					pkgA: { downloads: 10, versions: { '1.0.0': { date: '2020-01-01', fns: { draw: [] } } } },
					pkgB: { downloads: 9000, versions: { '1.0.0': { date: '2020-01-01', fns: { draw: [] } } } }
				}
			});
			const run = async() => (await executeQueries({ analyzer }, [{ type: 'guess-dep-versions' }]))['guess-dep-versions'];
			const first = await run();
			const second = await run();
			expect(second.dependencies).toEqual(first.dependencies);
			expect(guessed(second, 'pkgB')?.orphan).toBe(true);
			expect(guessed(second, 'pkgA')).toBeUndefined();
		});

		test('a name too many packages export is left ambiguous (not attributed to any)', async() => {
			const many = Object.fromEntries(['pkgA', 'pkgB', 'pkgC', 'pkgD', 'pkgE', 'pkgF'].map((n, i) =>
				[n, { downloads: i, versions: { '1.0.0': { date: '2020-01-01', fns: { draw: [] } } } }]));
			const res = await runGuess(ts, { code: 'draw(x)', packages: many });
			for(const pkg of Object.keys(many)) {
				expect(guessed(res, pkg), pkg).toBeUndefined();
			}
		});

		test('a loaded package used by a bare call is not treated as an orphan', async() => {
			const dep = await guessDep(ts, {
				code:     'library(ggplot2)\nggplot()',
				packages: { ggplot2: { versions: { '3.0.0': { date: '2018-01-01', fns: { ggplot: [] } } } } }
			}, 'ggplot2');
			expect(dep?.used).toBe(true);
			expect(dep?.orphan).toBeUndefined();
		});

		test('a locally defined function is not inferred as an orphan even when a package exports the name', async() => {
			const res = await runGuess(ts, {
				code:     'ggplot <- function() 1\nggplot()',
				packages: { ggplot2: { versions: { '3.0.0': { date: '2018-01-01', fns: { ggplot: [] } } } } }
			});
			expect(guessed(res, 'ggplot2')).toBeUndefined();
		});
	});
}));
