import { afterAll, describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { cleanupSigTmpDirs } from '../../_helper/sigdb';
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

afterAll(cleanupSigTmpDirs);

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
		const analyzer = await buildGuessAnalyzer(ts, {
			code:     'index(x)',
			packages: { zoo: { versions: { '1.0': { date: '2020-01-01', fns: { index: [] } } } } }
		});
		analyzer.context().deps.addDependency(new Package({
			name:          'current',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'importFrom(zoo, index)')).content().current
		}));
		const res = await executeQueries({ analyzer }, [{ type: 'guess-dep-versions' as const }]);
		expect(guessed(res['guess-dep-versions'], 'zoo')?.used).toBe(true);
	});

	test('an S3 method registered for a class the sigdb marks as owned marks that package as used (no direct call)', async() => {
		// mirrors tseries's `S3method("as.irts","zoo")`: the analyzed project never calls zoo directly, but its own
		// NAMESPACE registers a method for class `zoo`, which the sigdb says the `zoo` package OWNS (it exports a
		// same-named constructor `zoo` and registers an S3 method for it)
		const analyzer = await buildGuessAnalyzer(ts, {
			code:     'x <- 1', // no call to zoo at all
			packages: { zoo: { versions: { '1.0': { date: '2020-01-01', fns: { zoo: [], 'print.zoo': [] }, s3Classes: ['zoo'] } } } }
		});
		analyzer.context().deps.addDependency(new Package({
			name:          'current',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'S3method(as.irts,zoo)')).content().current
		}));
		const res = await executeQueries({ analyzer }, [{ type: 'guess-dep-versions' as const }]);
		expect(guessed(res['guess-dep-versions'], 'zoo')?.used).toBe(true);
	});

	test('an S3 method registered for a class NOT owned by any package does not mark anything used', async() => {
		const analyzer = await buildGuessAnalyzer(ts, {
			code:     'x <- 1',
			// zoo does not export a same-named constructor -> does not own class `zoo` -> not an owner
			packages: { zoo: { versions: { '1.0': { date: '2020-01-01', fns: { 'print.zoo': [] } } } } }
		});
		analyzer.context().deps.addDependency(new Package({
			name:          'current',
			namespaceInfo: FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'S3method(as.irts,zoo)')).content().current
		}));
		// force `zoo` into the guessed set (it is neither called nor a declared dependency) so `used` is reported at all
		const res = await executeQueries({ analyzer }, [{ type: 'guess-dep-versions' as const, packages: ['zoo'] }]);
		expect(guessed(res['guess-dep-versions'], 'zoo')?.used).toBe(false);
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

	test('without a signature database the query explains why it cannot guess', async() => {
		const res = await runGuess(ts, {
			code:     'library(dplyr)',
			config:   noSigDb(),
			packages: { dplyr: { versions: { '1.0.0': { fns: { filter: ['.data'] } } } } }
		});
		expect(res.dependencies).toHaveLength(0);
		expect(res.message).toMatch(/signature database/);
	});
}));
