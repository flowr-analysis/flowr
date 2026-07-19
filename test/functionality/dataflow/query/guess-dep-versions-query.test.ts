import { afterAll, describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { cleanupSigTmpDirs } from '../../_helper/sigdb';
import { boundsFrom, buildGuessAnalyzer, guessDep, guessed, runGuess, type GuessScenario } from '../../_helper/guess-dep-versions';
import { FlowrConfig } from '../../../../src/config';
import { executeQueries } from '../../../../src/queries/query';
import { explodeDependencyVersions } from '../../../../src/project/dependency-version-space';
import { asciiSummaryOfQueryResult } from '../../../../src/queries/query-print';
import { ansiFormatter } from '../../../../src/util/text/ansi';

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

	test('an untracked base primitive does not zero out a base package', async() => {
		// `c` is a base primitive absent from the db; it must not reject every version (which reported 0 candidates)
		const dep = await guessDep(ts, {
			code:     'paste(c(1, 2))',
			config:   assumedR('4.4.0'),
			packages: {
				base: { base: true, latest: '4.4.0', versions: {
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
				base: { base: true, latest: '2.0.0', versions: {
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
				'1.0.0': { date: '2020-01-01', fns: {} },           // no f
				'2.0.0': { date: '2021-01-01', fns: { f: ['p'] } }, // f gains parameter p
				'3.0.0': { date: '2022-01-01', fns: { f: [] } }     // p dropped
			} } }
		});
		const q = [{ type: 'guess-dep-versions' as const }];
		const res = await executeQueries({ analyzer }, q);
		const ascii = await asciiSummaryOfQueryResult(ansiFormatter, 0, res, analyzer, q);
		expect(ascii).toContain('pkg::f');
		expect(ascii).toContain('>=2.0.0');
		expect(ascii).toContain('<=2.0.0');
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
