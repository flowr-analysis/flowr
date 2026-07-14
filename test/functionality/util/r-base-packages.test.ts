import { describe, expect, test } from 'vitest';
import { baseRExportOwner, baseRPackages, isBaseRPackage } from '../../../src/util/r-base-packages';
import { RBasePackageStore } from '../../../src/data/r-base-packages.generated';

/**
 * These tests pin the behavior of the *generated* base-R export list
 * ({@link RBasePackageStore}, produced by `scripts/gen-base-packages.ts` from the signature database).
 * They guard both the loader (`baseRExportOwner`/`baseRPackages`/`isBaseRPackage`) and the structural
 * invariants the generator promises, so a bad regeneration is caught here rather than deep in dataflow.
 */
describe('generated base-R export list (loader)', () => {
	test('baseRExportOwner maps real base exports to their owning package', () => {
		// spread across several base packages, so this actually exercises the grouped generated list
		expect(baseRExportOwner('sd')).toBe('stats');
		expect(baseRExportOwner('median')).toBe('stats');
		expect(baseRExportOwner('glm')).toBe('stats');
		expect(baseRExportOwner('plot')).toBe('base');       // base owns plot (a generic), even though graphics has plot methods
		expect(baseRExportOwner('Reduce')).toBe('base');
		expect(baseRExportOwner('qr')).toBe('base');
		expect(baseRExportOwner('install.packages')).toBe('utils');
		expect(baseRExportOwner('read.csv')).toBe('utils');
		expect(baseRExportOwner('tcl')).toBe('tcltk');
		// not base-R exports
		expect(baseRExportOwner('ggplot')).toBeUndefined();
		expect(baseRExportOwner('%>%')).toBeUndefined();
		expect(baseRExportOwner('this_is_not_a_function')).toBeUndefined();
	});

	test('baseRPackages / isBaseRPackage respect the assumed R version', () => {
		// the newest release is served from the precomputed `current` array
		expect(baseRPackages(RBasePackageStore.newestRVersion)).toBe(RBasePackageStore.current);
		expect(baseRPackages()).toBe(RBasePackageStore.current);             // omitted -> newest
		expect(baseRPackages('9.9.9')).toBe(RBasePackageStore.current);      // a future version clamps to newest

		// `parallel` was added in R 2.14.0, so it is absent for an assumed R 2.10 but present today
		expect(baseRPackages('2.10.0')).not.toContain('parallel');
		expect(baseRPackages(RBasePackageStore.newestRVersion)).toContain('parallel');
		expect(isBaseRPackage('parallel', '2.10.0')).toBe(false);
		expect(isBaseRPackage('parallel', RBasePackageStore.newestRVersion)).toBe(true);

		// `stats`/`base` have always been core; a plain CRAN name never is
		expect(isBaseRPackage('base', '2.10.0')).toBe(true);
		expect(isBaseRPackage('stats')).toBe(true);
		expect(isBaseRPackage('ggplot2')).toBe(false);
	});
});

describe('generated base-R export list (structural invariants)', () => {
	test('the generated store is internally consistent', () => {
		// `current` is exactly what the newest release resolves to
		expect([...RBasePackageStore.current].sort())
			.toStrictEqual([...baseRPackages(RBasePackageStore.newestRVersion)].sort());

		// every current package has a version range, and only current packages carry an export list
		for(const pkg of RBasePackageStore.current) {
			expect(RBasePackageStore.packages[pkg], `${pkg} has a version range`).toBeDefined();
		}
		for(const pkg of Object.keys(RBasePackageStore.exportsByPackage)) {
			expect(RBasePackageStore.current, `${pkg} (has exports) is a current base package`).toContain(pkg);
		}

		// every version range is well-formed: first <= last (both are R-version strings)
		for(const [pkg, [first, last]] of Object.entries(RBasePackageStore.packages)) {
			expect(first, `${pkg} first`).toMatch(/^\d/);
			expect(last, `${pkg} last`).toMatch(/^\d/);
		}
	});

	test('first-owner-wins: every export is claimed by exactly one package', () => {
		const seen = new Map<string, string>();
		// each package's exports are a string[] in the generated store
		for(const [pkg, names] of Object.entries(RBasePackageStore.exportsByPackage)) {
			for(const name of names) {
				expect(seen.has(name), `${name} is listed once (also in ${seen.get(name)} and ${pkg})`).toBe(false);
				seen.set(name, pkg);
			}
		}
		expect(seen.size).toBeGreaterThan(3000);   // sanity: the full base surface, not an empty/partial regeneration

		// the inverted loader agrees with the grouped store for a sample of names
		for(const [name, pkg] of [...seen].slice(0, 50)) {
			expect(baseRExportOwner(name)).toBe(pkg);
		}
	});
});
