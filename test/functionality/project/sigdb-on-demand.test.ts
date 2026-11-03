import { assert, beforeAll, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrAnalyzerPackageVersionsOnDemandPlugin, packagesNamedIn } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-on-demand-plugin';
import { readTarEntries, TarError } from '../../../src/project/sigdb/on-demand/tar';
import { recoverPackage, sanitizeRecovered } from '../../../src/project/sigdb/on-demand/package-sources';
import { checkedUrl, isLocalHost, RefusedUrlError } from '../../../src/project/sigdb/on-demand/fetch';
import { FlowrConfig } from '../../../src/config';
import { bioconductorSource, cranSource, GitHubSource, isPackageName, parseGitHubRemote, parsePackagesIndex, type FetchBytes, type OnDemandSource } from '../../../src/project/sigdb/on-demand/remote-sources';
import { OnDemandRecoverer, type OnDemandOptions } from '../../../src/project/sigdb/on-demand/recoverer';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { Dataflow } from '../../../src/dataflow/graph/df-helper';
import { DfgVertex } from '../../../src/dataflow/graph/vertex';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';

const caps = ['project-on-demand-sources'] as const;
const name = (n: string) => label(n, caps, ['other']);

/** a ustar entry: the header, then the content padded to whole blocks */
function tarEntry(file: string, content: string | Buffer, type = '0'): Buffer {
	const data = typeof content === 'string' ? Buffer.from(content) : content;
	const header = Buffer.alloc(512);
	header.write(file.slice(0, 100), 0);
	header.write('0000644\0', 100);
	header.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124);
	header.write(type, 156);
	header.write('ustar\0', 257);
	header.write('00', 263);
	return Buffer.concat([header, data, Buffer.alloc((512 - data.length % 512) % 512)]);
}

function tarOf(entries: readonly Buffer[], gzip = true): Buffer {
	const tar = Buffer.concat([...entries, Buffer.alloc(1024)]);
	return gzip ? zlib.gzipSync(tar) : tar;
}

/** a package source as `R CMD build` packs it, every file below `<root>/` */
function packageTar(files: Record<string, string>, root = 'pkg'): Buffer {
	return tarOf(Object.entries(files).map(([f, c]) => tarEntry(`${root}/${f}`, c)));
}

const GgMirt = {
	DESCRIPTION:        'Package: ggmirt\nTitle: Plots\nVersion: 0.1.0\nImports: mirt, ggplot2\n',
	NAMESPACE:          'export(tracePlot)\nexport(itemInfoPlot)\nexport("%>%")\nimportFrom(magrittr,"%>%")\n',
	'R/tracePlot.r':    'tracePlot <- function(model, items = NULL, theta_range = c(-4,4), title = "Item Characteristics Curves") {\n  p <- 1\n  inner <- function(q) q\n  p\n}\n',
	'R/itemInfoPlot.R': 'itemInfoPlot <- function(model, items = NULL, facet = FALSE, ...) NULL\nhelper <- function(x) x\n',
	'R/utils-pipe.r':   '`%>%` <- magrittr::`%>%`\n',
	'inst/x.R':         'notAFunction <- function() 1\n'
};

describe('On-demand package sources', withTreeSitter(parser => {
	let ts: TreeSitterExecutor;
	let parse: (code: string) => ReturnType<TreeSitterExecutor['parseCode']>;
	beforeAll(() => {
		ts = new TreeSitterExecutor();
		parse = code => ts.parseCode(code);
	});

	describe('reading tar archives', () => {
		test(name('gzip\'ed and plain archives hold the same files, below the top directory'), () => {
			for(const gzip of [true, false]) {
				const files = readTarEntries(tarOf([tarEntry('p/DESCRIPTION', 'Package: p'), tarEntry('p/R/a.R', 'a <- 1')], gzip), () => true);
				assert.deepStrictEqual([...files.keys()], ['DESCRIPTION', 'R/a.R']);
				assert.strictEqual(files.get('R/a.R')?.toString(), 'a <- 1');
			}
		});
		test(name('a long name from a GNU or pax header'), () => {
			const long = `p/R/${'x'.repeat(150)}.R`;
			const body = ` path=${long}\n`;
			let length = body.length;
			while(String(length).length + body.length !== length) {
				length = String(length).length + body.length;
			}
			const pax = `${length}${body}`;
			for(const prefix of [tarEntry('././@LongLink', `${long}\0`, 'L'), tarEntry('p/PaxHeader', pax, 'x')]) {
				assert.deepStrictEqual([...readTarEntries(tarOf([prefix, tarEntry('p/short', 'a <- 1')]), () => true).keys()], [long.slice(2)]);
			}
		});
		test(name('entries leaving the archive, links, and directories are skipped'), () => {
			const files = readTarEntries(tarOf([tarEntry('p/../../etc/passwd', 'x'), tarEntry('/abs/file', 'x'), tarEntry('p/link', '', '2'), tarEntry('p/dir/', '', '5'), tarEntry('top', 'x'), tarEntry('p/ok', 'y')]), () => true);
			assert.deepStrictEqual([...files.keys()], ['ok']);
		});
		test(name('only the files asked for are kept, and too big ones are skipped'), () => {
			const archive = tarOf([tarEntry('p/a', 'x'.repeat(100)), tarEntry('p/b', 'y'), tarEntry('p/c', 'z')]);
			assert.deepStrictEqual([...readTarEntries(archive, f => f !== 'c', { maxArchiveBytes: 1 << 20, maxFileBytes: 10, maxFiles: 10 }).keys()], ['b']);
			assert.throws(() => readTarEntries(archive, () => true, { maxArchiveBytes: 1 << 20, maxFileBytes: 1000, maxFiles: 2 }), TarError);
		});
		test(name('a truncated, corrupt, or oversized archive is an error'), () => {
			const archive = tarOf([tarEntry('p/a', 'x'.repeat(2000))], false);
			assert.throws(() => readTarEntries(archive.subarray(0, 1000), () => true), TarError);
			assert.throws(() => readTarEntries(Buffer.from([0x1f, 0x8b, 1, 2, 3]), () => true), TarError);
			assert.throws(() => readTarEntries(zlib.gzipSync(Buffer.alloc(4096)), () => true, { maxArchiveBytes: 100, maxFileBytes: 100, maxFiles: 1 }), TarError);
			assert.strictEqual(readTarEntries(Buffer.alloc(0), () => true).size, 0);
		});
	});

	describe('recovering a package from its files', () => {
		const recover = (files: Record<string, string>) => recoverPackage(new Map(Object.entries(files)), parse, 'test');
		test(name('exports and formals of ggmirt'), () => {
			const pkg = recover(GgMirt);
			assert.strictEqual(pkg?.name, 'ggmirt');
			assert.strictEqual(pkg?.version, '0.1.0');
			assert.sameMembers([...pkg?.exported ?? []], ['tracePlot', 'itemInfoPlot', '%>%']);
			const trace = pkg?.functions.find(f => f.name === 'tracePlot');
			assert.deepStrictEqual(trace?.signature.map(p => [p.name, p.default]), [['model', undefined], ['items', 'NULL'], ['theta_range', 'c(-4,4)'], ['title', '"Item Char…']]);
			assert.isTrue(trace?.exported);
			assert.strictEqual(trace?.file, 'R/tracePlot.r');
			assert.isFalse(pkg?.functions.find(f => f.name === 'helper')?.exported);
			assert.isUndefined(pkg?.functions.find(f => f.name === 'inner' || f.name === 'notAFunction'));
			assert.deepStrictEqual(pkg?.functions.find(f => f.name === 'itemInfoPlot')?.signature.at(-1), { name: '...', props: 0 });
		});
		test(name('every way to write a definition'), () => {
			const pkg = recover({
				DESCRIPTION: 'Package: forms\nVersion: 1.2-3\n',
				NAMESPACE:   'exportPattern("^[[:alpha:]]+")\nexportClasses(Shape)\n',
				'R/a.R':     'a = function(x) x\n"b" <- function(y) y\n`c d` <- function(z) z\n(function(w) w) -> e\nf <<- \\(v) v\ng <- h <- function(u) u\nif(getRversion() >= "4.0") { i <- function(t) t } else { j <- function(s) s }\nsetGeneric("k", function(object, ...) standardGeneric("k"))\nl <- 3\n.hidden <- function() 1\nx$y <- function() 1\n'
			});
			assert.sameMembers(pkg?.functions.map(f => f.name) ?? [], ['a', 'b', 'c d', 'e', 'f', 'g', 'h', 'i', 'j', 'k', '.hidden']);
			/* as in R, the pattern is not anchored at the end */
			assert.sameMembers([...pkg?.exported ?? []], ['a', 'b', 'c d', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
			assert.deepStrictEqual(pkg?.s4Classes, ['Shape']);
			assert.strictEqual(pkg?.version, '1.2-3');
			assert.deepStrictEqual(pkg?.functions.find(f => f.name === 'k')?.props, ['generic']);
		});
		test(name('a NAMESPACE written by hand, over lines and in branches'), () => {
			const pkg = recover({
				DESCRIPTION: 'Package: hand\nVersion: 2\n',
				NAMESPACE:   '# exports\nexport(\n  a,\n  "b",\n  `c`\n)\nif(.Platform$OS.type == "windows") export(w)\ntoString(x)\nconstructor(y)\nimportFrom(stats, sd)\nS3method(print, hand)\nexportPattern("^z")\n',
				'R/a.R':     'zz <- function(q) q\nother <- function() 1\n'
			});
			assert.sameMembers([...pkg?.exported ?? []], ['a', 'b', 'c', 'w', 'zz']);
		});
		test(name('without a NAMESPACE every name not starting with a dot is exported'), () => {
			const pkg = recover({ DESCRIPTION: 'Package: old\nVersion: 0.1\n', 'R/a.R': 'f <- function() 1\n.g <- function() 2\n' });
			assert.deepStrictEqual(pkg?.exported, ['f']);
		});
		test(name('the collation order decides which definition wins'), () => {
			const files = { DESCRIPTION: 'Package: twice\nVersion: 1\nCollate: \'b.R\' \'a.R\'\n', NAMESPACE: 'export(f)\n', 'R/a.R': 'f <- function(a) a\n', 'R/b.R': 'f <- function(b) b\n' };
			assert.deepStrictEqual(recover(files)?.functions.find(f => f.name === 'f')?.signature.map(p => p.name), ['a']);
			assert.deepStrictEqual(recover({ ...files, DESCRIPTION: 'Package: twice\nVersion: 1\n' })?.functions.find(f => f.name === 'f')?.signature.map(p => p.name), ['b']);
		});
		test(name('a file that does not parse still gives what it can'), () => {
			const pkg = recover({ DESCRIPTION: 'Package: broken\nVersion: 1\n', NAMESPACE: 'export(f, g)\n', 'R/a.R': 'f <- function(x) x\ng <- function(y {\n' });
			assert.include(pkg?.functions.map(f => f.name) ?? [], 'f');
			assert.sameMembers([...pkg?.exported ?? []], ['f', 'g']);
		});
		test(name('no DESCRIPTION, or one not naming a package, is no package'), () => {
			assert.isUndefined(recover({ 'R/a.R': 'f <- function() 1' }));
			assert.isUndefined(recover({ DESCRIPTION: 'Title: nothing\n' }));
			assert.isUndefined(recover({ DESCRIPTION: 'Package: ../evil\n' }));
		});
	});

	describe('where to look', () => {
		test(name('GitHub remotes as remotes and pak write them'), () => {
			assert.deepStrictEqual(parseGitHubRemote('masurp/ggmirt'), { owner: 'masurp', repo: 'ggmirt', subdir: undefined, ref: undefined });
			assert.deepStrictEqual(parseGitHubRemote('github::owner/repo/pkg/sub@v1.2'), { owner: 'owner', repo: 'repo', subdir: 'pkg/sub', ref: 'v1.2' });
			assert.deepStrictEqual(parseGitHubRemote('owner/repo#12')?.ref, 'refs/pull/12/head');
			assert.strictEqual(parseGitHubRemote('owner/repo.git')?.repo, 'repo');
			for(const bad of ['ggmirt', 'a b/c', 'https://evil.org/x', '../x/y', 'o/r;rm -rf', '']) {
				assert.isUndefined(parseGitHubRemote(bad), bad);
			}
		});
		test(name('only package names may go into a URL'), () => {
			for(const ok of ['ggmirt', 'R.utils', 'data.table', 'EnhancedVolcano', 'a1']) {
				assert.isTrue(isPackageName(ok), ok);
			}
			for(const bad of ['', '1abc', 'a/b', '../x', 'a b', 'a.', 'x?y=1', 'a%2Fb']) {
				assert.isFalse(isPackageName(bad), bad);
			}
		});
		const noFetch: FetchBytes = () => Promise.reject(new Error('no network in this test'));
		test(name('the GitHub source needs a repository'), async() => {
			assert.deepStrictEqual(await GitHubSource.archives({ name: 'ggmirt' }, noFetch), []);
			assert.deepStrictEqual(await GitHubSource.archives({ name: 'ggmirt', github: 'masurp/ggmirt@main' }, noFetch),
				[{ url: 'https://codeload.github.com/masurp/ggmirt/tar.gz/main', origin: 'github:masurp/ggmirt', subdir: undefined }]);
		});
		test(name('CRAN: a pinned version from the mirror, the CRAN tarball, and the archive'), async() => {
			const cran = cranSource({ cranMirror: 'https://cran.example/src/contrib' });
			assert.deepStrictEqual((await cran.archives({ name: 'zip', version: '2.3.1' }, noFetch)).map(a => a.url), [
				'https://codeload.github.com/cran/zip/tar.gz/refs/tags/2.3.1',
				'https://cran.example/src/contrib/zip_2.3.1.tar.gz',
				'https://cran.example/src/contrib/Archive/zip/zip_2.3.1.tar.gz'
			]);
			assert.deepStrictEqual((await cran.archives({ name: 'zip' }, noFetch)).map(a => a.url), ['https://codeload.github.com/cran/zip/tar.gz/HEAD']);
			assert.deepStrictEqual(await cranSource({ githubMirrors: false }).archives({ name: 'zip' }, noFetch), []);
			/* a version that is no version stays out of the URL */
			assert.deepStrictEqual((await cran.archives({ name: 'zip', version: '../1' }, noFetch)).length, 1);
		});
		test(name('Bioconductor: the version its index lists, else the mirror'), async() => {
			const index = 'Package: EnhancedVolcano\nVersion: 1.30.0\nDepends: ggplot2\n\nPackage: limma\nVersion: 3.66.0\n';
			assert.deepStrictEqual([...parsePackagesIndex(index)], [['EnhancedVolcano', '1.30.0'], ['limma', '3.66.0']]);
			const asked: string[] = [];
			const fetch: FetchBytes = url => {
				asked.push(url);
				return Promise.resolve(url.endsWith('/release/bioc/src/contrib/PACKAGES') ? Buffer.from(index) : undefined);
			};
			const bioc = bioconductorSource();
			assert.deepStrictEqual((await bioc.archives({ name: 'limma' }, fetch)).map(a => a.url), [
				'https://bioconductor.org/packages/release/bioc/src/contrib/limma_3.66.0.tar.gz',
				'https://codeload.github.com/bioc/limma/tar.gz/HEAD'
			]);
			assert.deepStrictEqual((await bioc.archives({ name: 'notThere' }, fetch)).map(a => a.url), ['https://codeload.github.com/bioc/notThere/tar.gz/HEAD']);
			/* the indices are fetched once per source */
			assert.strictEqual(asked.filter(u => u.endsWith('PACKAGES')).length, 5);
		});
	});

	describe('fetching and caching', () => {
		const archives = new Map([['https://codeload.github.com/masurp/ggmirt/tar.gz/HEAD', packageTar(GgMirt, 'ggmirt-HEAD')]]);
		function setup(options: Partial<OnDemandOptions> = {}, served = archives) {
			const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-on-demand-'));
			const fetched: string[] = [];
			let now = 0;
			const fetch: FetchBytes = url => {
				fetched.push(url);
				return Promise.resolve(served.get(url));
			};
			const recoverer = (sources: readonly OnDemandSource[] = [GitHubSource, cranSource(), bioconductorSource()]) =>
				new OnDemandRecoverer({ enabled: true, ...options }, { sources, fetch, parse, cacheDir, now: () => now });
			return { cacheDir, fetched, recoverer, advance: (hours: number) => {
				now += hours * 60 * 60 * 1000;
			} };
		}
		test(name('a package is fetched once, then served from the cache'), async() => {
			const { fetched, recoverer } = setup();
			const [pkg] = await recoverer().recover([{ name: 'ggmirt', github: 'masurp/ggmirt' }]);
			assert.strictEqual(pkg?.origin, 'github:masurp/ggmirt');
			assert.strictEqual(fetched.length, 1);
			assert.deepStrictEqual(await recoverer().recover([{ name: 'ggmirt', github: 'masurp/ggmirt' }]), []);
			assert.strictEqual(fetched.length, 1);
			assert.strictEqual(recoverer().cached('ggmirt')?.name, 'ggmirt');
		});
		test(name('a package no source has is asked for again only after a while'), async() => {
			const { fetched, recoverer, advance } = setup({ retryAfterHours: 2 });
			await recoverer().recover([{ name: 'nowhere' }]);
			const asked = fetched.length;
			assert.isAbove(asked, 0);
			await recoverer().recover([{ name: 'nowhere' }]);
			assert.strictEqual(fetched.length, asked);
			advance(3);
			await recoverer().recover([{ name: 'nowhere' }]);
			assert.isAbove(fetched.length, asked);
		});
		test(name('another version or repository is fetched anew'), async() => {
			const { fetched, recoverer } = setup();
			await recoverer().recover([{ name: 'ggmirt', github: 'masurp/ggmirt' }]);
			await recoverer().recover([{ name: 'ggmirt', github: 'other/ggmirt' }]);
			assert.include(fetched, 'https://codeload.github.com/other/ggmirt/tar.gz/HEAD');
		});
		test(name('offline, only the cache answers'), async() => {
			const { fetched, recoverer } = setup({ offline: true });
			assert.deepStrictEqual(await recoverer().recover([{ name: 'ggmirt', github: 'masurp/ggmirt' }]), []);
			assert.deepStrictEqual(fetched, []);
		});
		test(name('no more than maxPackages are fetched, and names no package has are skipped'), async() => {
			const { fetched, recoverer } = setup({ maxPackages: 1 });
			await recoverer([GitHubSource]).recover([{ name: 'a/b', github: 'x/y' }, { name: 'ggmirt', github: 'masurp/ggmirt' }, { name: 'other', github: 'o/other' }]);
			assert.deepStrictEqual(fetched, ['https://codeload.github.com/masurp/ggmirt/tar.gz/HEAD']);
		});
		test(name('an archive holding another package does not count'), async() => {
			const served = new Map([['https://codeload.github.com/cran/fake/tar.gz/HEAD', packageTar(GgMirt)]]);
			const { recoverer } = setup({}, served);
			assert.deepStrictEqual(await recoverer().recover([{ name: 'fake' }]), []);
		});
		test(name('a failing source or archive leaves the next to try'), async() => {
			const failing: OnDemandSource = { name: 'failing', archives: () => Promise.reject(new Error('down')) };
			const broken: OnDemandSource = { name: 'broken', archives: () => Promise.resolve([{ url: 'broken', origin: 'broken' }]) };
			const served = new Map([...archives, ['broken', Buffer.from('not an archive at all, but long enough to be read as one'.repeat(20))]]);
			const { recoverer } = setup({}, served);
			const [pkg] = await recoverer([failing, broken, GitHubSource]).recover([{ name: 'ggmirt', github: 'masurp/ggmirt' }]);
			assert.strictEqual(pkg?.name, 'ggmirt');
		});
		test(name('a package that moved to Bioconductor comes from there, not from its old CRAN copy'), async() => {
			const limma = (version: string) => packageTar({ DESCRIPTION: `Package: limma\nVersion: ${version}\n`, NAMESPACE: 'export(lmFit)\n', 'R/lmFit.R': 'lmFit <- function(object, design = NULL) NULL\n' }, 'limma');
			const served = new Map([
				['https://codeload.github.com/cran/limma/tar.gz/HEAD', limma('2.10.7')],
				['https://bioconductor.org/packages/release/bioc/src/contrib/PACKAGES', Buffer.from('Package: limma\nVersion: 3.66.0\n')],
				['https://bioconductor.org/packages/release/bioc/src/contrib/limma_3.66.0.tar.gz', limma('3.66.0')]
			]);
			const { recoverer } = setup({}, served);
			const [pkg] = await recoverer().recover([{ name: 'limma' }]);
			assert.strictEqual(pkg?.version, '3.66.0');
			assert.strictEqual(pkg?.origin, 'bioconductor');
		});
		test(name('a package CRAN lists comes in its current version'), async() => {
			const served = new Map([
				['https://cloud.r-project.org/src/contrib/PACKAGES.gz', zlib.gzipSync('Package: zip\nVersion: 2.3.1\n')],
				['https://cloud.r-project.org/src/contrib/zip_2.3.1.tar.gz', packageTar({ DESCRIPTION: 'Package: zip\nVersion: 2.3.1\n', NAMESPACE: 'export(zip)\n', 'R/zip.R': 'zip <- function(zipfile, files) NULL\n' }, 'zip')]
			]);
			const { recoverer, fetched } = setup({}, served);
			const [pkg] = await recoverer().recover([{ name: 'zip' }]);
			assert.strictEqual(pkg?.version, '2.3.1');
			assert.notInclude(fetched, 'https://codeload.github.com/cran/zip/tar.gz/HEAD');
		});
		test(name('a failing network is not remembered as a missing package'), async() => {
			const { cacheDir, recoverer } = setup();
			const down: OnDemandSource = { name: 'down', archives: () => Promise.resolve([{ url: 'x', origin: 'x' }]) };
			const failing = new OnDemandRecoverer({ enabled: true }, { sources: [down], fetch: () => Promise.reject(new Error('ECONNRESET')), parse, cacheDir });
			assert.deepStrictEqual(await failing.recover([{ name: 'ggmirt' }]), []);
			assert.isFalse(fs.existsSync(path.join(cacheDir, 'ggmirt.json')));
			assert.strictEqual((await recoverer().recover([{ name: 'ggmirt', github: 'masurp/ggmirt' }])).length, 1);
		});
		test(name('a package in a subdirectory of its repository'), async() => {
			const served = new Map([['https://codeload.github.com/o/mono/tar.gz/HEAD', packageTar(Object.fromEntries(Object.entries(GgMirt).map(([f, c]) => [`pkgs/ggmirt/${f}`, c])), 'mono-HEAD')]]);
			const { recoverer } = setup({}, served);
			const [pkg] = await recoverer([GitHubSource]).recover([{ name: 'ggmirt', github: 'o/mono/pkgs/ggmirt' }]);
			assert.strictEqual(pkg?.name, 'ggmirt');
		});
		test(name('a corrupt cache entry is fetched anew'), async() => {
			const { cacheDir, fetched, recoverer } = setup();
			fs.writeFileSync(path.join(cacheDir, 'ggmirt.json'), '{"schema": 1, "name": "ggmirt", "at": 0, "package": {"name": "other"}}');
			assert.isUndefined(recoverer().cached('ggmirt'));
			await recoverer().recover([{ name: 'ggmirt', github: 'masurp/ggmirt' }]);
			assert.strictEqual(fetched.length, 1);
			fs.writeFileSync(path.join(cacheDir, 'ggmirt.json'), 'not json');
			assert.isUndefined(recoverer().cached('ggmirt'));
		});
	});

	describe('what the code says it uses', () => {
		async function named(code: string) {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			return packagesNamedIn(await analyzer.normalize());
		}
		test(name('loads, qualified names, and installs'), async() => {
			const { names, github } = await named('library(a)\nrequire("b")\nrequireNamespace("c", quietly = TRUE)\npacman::p_load(d, e)\nf::g()\nh:::i\nremotes::install_github("masurp/ggmirt")\npak::pkg_install("o/r@v1")\nlibrary(j, character.only = TRUE)');
			assert.sameMembers([...names], ['a', 'b', 'c', 'pacman', 'd', 'e', 'f', 'h', 'remotes', 'pak', 'j']);
			assert.deepStrictEqual([...github], [['ggmirt', 'masurp/ggmirt'], ['r', 'o/r@v1']]);
		});
	});

	describe('in an analysis', () => {
		const served = new Map([['https://codeload.github.com/masurp/ggmirt/tar.gz/HEAD', packageTar(GgMirt, 'ggmirt-HEAD')]]);
		async function analyze(code: string, options: Partial<OnDemandOptions> = {}, cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-on-demand-'))) {
			const fetched: string[] = [];
			const fetch: FetchBytes = url => {
				fetched.push(url);
				return Promise.resolve(served.get(url));
			};
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
				.registerPlugins(new FlowrAnalyzerPackageVersionsOnDemandPlugin({ enabled: true, cacheDir, sources: ['github'], ...options }, [], fetch))
				.build();
			analyzer.addRequest(code);
			const { graph } = await analyzer.dataflow();
			return { analyzer, graph, fetched, cacheDir };
		}
		const code = 'remotes::install_github("masurp/ggmirt")\nlibrary(ggmirt)\np <- tracePlot(fit, theta_range = c(-3, 3))';
		const qualifiedTracePlot = (graph: Awaited<ReturnType<typeof analyze>>['graph']) => {
			const call = graph.vertices(true).find(([, v]) => DfgVertex.isFunctionCall(v) && Identifier.getName(v.name) === 'tracePlot');
			return call === undefined ? undefined : Dataflow.qualify(call[0], graph, false);
		};
		test(name('a bare call of an export names the package, and its formals are known'), async() => {
			const { analyzer, graph, fetched } = await analyze(code);
			assert.deepStrictEqual(fetched, ['https://codeload.github.com/masurp/ggmirt/tar.gz/HEAD']);
			assert.strictEqual(Identifier.getNamespace(qualifiedTracePlot(graph) ?? ''), 'ggmirt');
			const db = analyzer.inspectContext().deps.signatures();
			assert.deepStrictEqual(db.parametersOf(Identifier.make('tracePlot', 'ggmirt')), ['model', 'items', 'theta_range', 'title']);
			assert.strictEqual(db.versionOf('ggmirt'), '0.1.0');
			assert.isUndefined(db.functionOf(Identifier.make('helper', 'ggmirt')));
			assert.isDefined(db.functionOf(Identifier.make('helper', 'ggmirt', true)));
		});
		test(name('the repository may come from the configuration'), async() => {
			const { graph } = await analyze('library(ggmirt)\ntracePlot(fit)', { repositories: { ggmirt: 'masurp/ggmirt' } });
			assert.strictEqual(Identifier.getNamespace(qualifiedTracePlot(graph) ?? ''), 'ggmirt');
		});
		test(name('a later analysis works offline from the cache'), async() => {
			const { cacheDir } = await analyze(code);
			const { graph, fetched } = await analyze('library(ggmirt)\np <- tracePlot(fit)', { offline: true }, cacheDir);
			assert.deepStrictEqual(fetched, []);
			assert.strictEqual(Identifier.getNamespace(qualifiedTracePlot(graph) ?? ''), 'ggmirt');
		});
		test(name('disabled or filtered out, nothing is fetched'), async() => {
			for(const options of [{ enabled: false }, { packages: ['^other$'] }]) {
				const { fetched, graph } = await analyze(code, options);
				assert.deepStrictEqual(fetched, []);
				assert.notStrictEqual(Identifier.getNamespace(qualifiedTracePlot(graph) ?? ''), 'ggmirt');
			}
		});
		test(name('a package a database knows is not fetched'), async() => {
			const { fetched } = await analyze('library(stats)\nlibrary(utils)\nx <- base::sum(1)');
			assert.deepStrictEqual(fetched, []);
		});
	});

	describe('a fetched package is untrusted', () => {
		const evil = {
			DESCRIPTION: 'Package: evil\nVersion: 1.0\n',
			NAMESPACE:   'export(system, eval, download.file, read.csv, harmless)\n',
			'R/a.R':     'system("touch PWNED")\nsystem <- function(command, intern = system("rm -rf ~")) NULL\neval <- function(expr) NULL\ndownload.file <- function(url, destfile) NULL\nread.csv <- function(file) NULL\nharmless <- function(x) x\n'
		};
		test(name('its code is parsed, never run'), () => {
			const before = fs.existsSync('PWNED');
			const pkg = recoverPackage(new Map(Object.entries(evil)), parse, 'test');
			assert.strictEqual(fs.existsSync('PWNED'), before);
			assert.isAtMost(pkg?.functions.find(f => f.name === 'system')?.signature[1].default?.length ?? 0, 11);
		});
		test(name('names, versions, properties, and sizes are cut down to what flowR can trust'), () => {
			const safe = sanitizeRecovered({
				name:      'evil',
				version:   '1.0 && rm -rf',
				origin:    'x\ny',
				exported:  ['ok', 'bad\nname', '__proto__', '', 'x'.repeat(300), 42],
				s4Classes: ['C', 'bad\u0000'],
				functions: [
					{ name: 'ok', file: '../../etc/passwd', line: -3, exported: true, props: ['pure', 'generic', 'sanitizer'], signature: [{ name: 'a', props: 0xffff, default: 'x\u0007y' }, { name: '\n' }, 'junk'], callees: ['system'] },
					{ name: '__proto__', signature: [] }, null, { name: 'nosig' }
				]
			});
			assert.deepStrictEqual(safe, {
				name:      'evil',
				version:   undefined,
				origin:    'unknown',
				exported:  ['ok'],
				s4Classes: ['C'],
				functions: [{ name: 'ok', file: undefined, line: 0, exported: true, props: ['generic'], signature: [{ name: 'a', props: 2, default: 'x y' }], callees: [] }]
			});
			assert.isUndefined(sanitizeRecovered({ name: '../evil', exported: [], functions: [], s4Classes: [] }));
			assert.isUndefined(sanitizeRecovered('not a package'));
			const big = sanitizeRecovered({ name: 'big', exported: Array.from({ length: 30_000 }, (_, i) => `f${i}`), functions: [], s4Classes: [] });
			assert.strictEqual(big?.exported.length, 20_000);
		});
		test(name('it cannot take over a security-relevant function'), () => {
			const safe = sanitizeRecovered(recoverPackage(new Map(Object.entries(evil)), parse, 'test'), new Set(['system', 'eval', 'download.file', 'read.csv']));
			assert.deepStrictEqual(safe?.exported, ['harmless']);
			assert.isFalse(safe?.functions.find(f => f.name === 'system')?.exported);
		});
		const served = new Map([['https://codeload.github.com/evil/evil/tar.gz/HEAD', packageTar(evil, 'evil-HEAD')]]);
		async function analyze(code: string, cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-on-demand-'))) {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
				.registerPlugins(new FlowrAnalyzerPackageVersionsOnDemandPlugin({ enabled: true, cacheDir, sources: ['github'], repositories: { evil: 'evil/evil' } }, [], url => Promise.resolve(served.get(url))))
				.build();
			analyzer.addRequest(code);
			return { analyzer, graph: (await analyzer.dataflow()).graph, cacheDir };
		}
		const namespaceOf = (graph: Awaited<ReturnType<typeof analyze>>['graph'], fn: string) => {
			const call = graph.vertices(true).find(([, v]) => DfgVertex.isFunctionCall(v) && Identifier.getName(v.name) === fn);
			return call === undefined ? undefined : Identifier.getNamespace(Dataflow.qualify(call[0], graph, false) ?? '');
		};
		test(name('so system and eval stay base R, and its harmless exports still resolve'), async() => {
			const body = 'cmd <- readline()\nsystem(cmd)\neval(parse(text = cmd))\nd <- read.csv(cmd)\nharmless(1)';
			const [{ graph }, { graph: without }] = await Promise.all([analyze(`library(evil)\n${body}`), analyze(body)]);
			for(const fn of ['system', 'eval', 'read.csv']) {
				assert.notStrictEqual(namespaceOf(graph, fn), 'evil', fn);
				assert.strictEqual(namespaceOf(graph, fn), namespaceOf(without, fn), fn);
			}
			assert.strictEqual(namespaceOf(graph, 'harmless'), 'evil');
		});
		test(name('a tampered cache does not get around that'), async() => {
			const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-on-demand-'));
			fs.writeFileSync(path.join(cacheDir, 'evil.json'), JSON.stringify({
				schema:  1, name:    'evil', request: {}, at:      Date.now(),
				package: { name: 'evil', origin: 'cache', exported: ['system', 'harmless'], s4Classes: [], functions: [{ name: 'system', exported: true, props: ['pure'], signature: [{ name: 'command', props: 0xffff }], callees: [] }] }
			}));
			const { analyzer, graph } = await analyze('library(evil)\nsystem(cmd)\nharmless(1)', cacheDir);
			assert.notStrictEqual(namespaceOf(graph, 'system'), 'evil');
			assert.strictEqual(namespaceOf(graph, 'harmless'), 'evil');
			assert.isUndefined(analyzer.inspectContext().deps.signatures().functionOf(Identifier.make('system', 'evil')));
		});
		test(name('only https to public hosts, unless a trusted configuration names the mirror'), () => {
			for(const bad of ['http://cran.r-project.org/x', 'file:///etc/passwd', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.1/x', 'https://192.168.1.1/x',
				'https://169.254.169.254/latest/meta-data', 'https://[::1]/x', 'https://[::ffff:127.0.0.1]/x', 'https://user:pw@github.com/x', 'https://cran.internal/x', 'no url']) {
				assert.throws(() => checkedUrl(bad), RefusedUrlError, undefined, bad);
			}
			assert.strictEqual(checkedUrl('https://codeload.github.com/a/b/tar.gz/HEAD').host, 'codeload.github.com');
			assert.strictEqual(checkedUrl('https://cran.internal/x', new Set(['cran.internal'])).host, 'cran.internal');
			assert.isFalse(isLocalHost('bioconductor.org'));
			assert.isTrue(isLocalHost('172.20.0.1'));
		});
		test(name('a repository reference cannot leave the repository'), () => {
			for(const bad of ['o/r@../../x', 'o/r/../x', 'o/r@a/../../b', 'o/.hidden', 'o/r/.git', 'o/r@v1?x=1', 'o/r@%2e%2e']) {
				assert.isUndefined(parseGitHubRemote(bad), bad);
			}
		});
		test(name('a project cannot switch on the fetching for itself'), () => {
			const raw = { solver: { sigdb: { onDemand: { enabled: true, repositories: { x: 'a/b' }, cranMirror: 'https://evil.org/' } } } };
			const dropped = FlowrConfig.dropSecuritySensitive(raw);
			assert.includeMembers(dropped, ['solver.sigdb.onDemand.enabled', 'solver.sigdb.onDemand.repositories', 'solver.sigdb.onDemand.cranMirror']);
		});
	});
}));
