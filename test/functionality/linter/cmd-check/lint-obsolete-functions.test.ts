import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('obsolete-functions', () => {
		const rule = 'obsolete-functions';

		/* the R CMD check cases */
		assertLinterPackage('deprecated function', parser, 'f <- function(x) plclust(x)', rule, [
			{ certainty: LintingResultCertainty.Certain, kind: 'deprecated', name: 'plclust', message: 'Found the deprecated function: plclust' }
		]);
		assertLinterPackage('defunct function', parser, 'f <- function(x) La.eigen(x)', rule, [
			{ kind: 'defunct', name: 'La.eigen', message: 'Found the defunct/removed function: La.eigen' }
		]);
		assertLinterPackage('platform-specific device', parser, 'f <- function() x11()', rule, [
			{ kind: 'platform-device', name: 'x11', message: 'Found the platform-specific device: x11, dev.new() is the preferred way to open a new device' }
		]);
		assertLinterPackage('upper-case device', parser, 'f <- function() X11()', rule, [
			{ kind: 'platform-device', name: 'X11' }
		]);
		assertLinterPackage('quartz device', parser, 'f <- function() quartz()', rule, [{ kind: 'platform-device', name: 'quartz' }]);
		assertLinterPackage('windows device', parser, 'f <- function() windows()', rule, [{ kind: 'platform-device', name: 'windows' }]);
		assertLinterPackage('win.graph device', parser, 'f <- function() win.graph()', rule, [{ kind: 'platform-device', name: 'win.graph' }]);
		assertLinterPackage('win.metafile device', parser, 'f <- function() win.metafile()', rule, [{ kind: 'platform-device', name: 'win.metafile' }]);
		assertLinterPackage('win.print device', parser, 'f <- function() win.print()', rule, [{ kind: 'platform-device', name: 'win.print' }]);
		assertLinterPackage('several devices in one function', parser, 'f <- function() {\n  windows()\n  win.print()\n}', rule, [
			{ kind: 'platform-device', name: 'windows' }, { kind: 'platform-device', name: 'win.print' }
		]);
		assertLinterPackage('device with arguments', parser, 'f <- function() x11(width = 5, display = ":0")', rule, [{ kind: 'platform-device', name: 'x11' }]);
		assertLinterPackage('defunct .readRDS', parser, 'f <- function(x) .readRDS(x)', rule, [{ kind: 'defunct', name: '.readRDS' }]);
		assertLinterPackage('defunct as.real', parser, 'f <- function(x) as.real(x)', rule, [{ kind: 'defunct', name: 'as.real' }]);
		assertLinterPackage('defunct tk functions', parser, 'f <- function() tkopen()', rule, [{ kind: 'defunct', name: 'tkopen' }]);
		assertLinterPackage('defunct .find.package', parser, 'f <- function(p) .find.package(p)', rule, [{ kind: 'defunct', name: '.find.package' }]);

		describe('locations', () => {
			assertLinterPackage('reports the location of the call', parser, 'f <- function(x) {\n  y <- 1\n  plclust(x)\n}', rule, [
				{ loc: [3, 3, 3, 12, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('calls in nested functions', parser, 'f <- function() {\n  g <- function() La.eigen(1)\n  g()\n}', rule, [
				{ kind: 'defunct', loc: [2, 19, 2, 29, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('calls at the top level of a package file', parser, 'x <- X11()', rule, [{ kind: 'platform-device', name: 'X11' }]);
		});

		describe('namespaced calls', () => {
			assertLinterPackage('namespaced device', parser, 'f <- function() grDevices::x11()', rule, [{ kind: 'platform-device', name: 'x11' }]);
			assertLinterPackage('namespaced defunct function', parser, 'f <- function(x) base::.find.package(x)', rule, [{ kind: 'defunct', name: '.find.package' }]);
			assertLinterPackage('internal namespace access', parser, 'f <- function(x) stats:::tetragamma(x)', rule, [{ kind: 'defunct', name: 'tetragamma' }]);
		});

		describe('own definitions', () => {
			assertLinterPackage('function defined in the same file', parser, 'x11 <- function() 1\nf <- function() x11()', rule, []);
			assertLinterPackage('local function shadowing the name', parser, 'f <- function() {\n  plclust <- function(x) x\n  plclust(1)\n}', rule, []);
		});

		describe('config', () => {
			assertLinterPackage('additional deprecated function', parser, 'f <- function(x) foo(x)\ng <- function(x) plclust(x)', rule, [
				{ kind: 'deprecated', name: 'foo' }, { kind: 'deprecated', name: 'plclust' }
			], { deprecated: ['foo'] });
			assertLinterPackage('only the given functions', parser, 'f <- function(x) foo(x)\ng <- function(x) plclust(x)', rule, [
				{ kind: 'deprecated', name: 'foo' }
			], { defaults: false, deprecated: ['foo'] });
			assertLinterPackage('no built-in functions', parser, 'f <- function(x) plclust(x)\ng <- function() x11()\nh <- function(x) La.eigen(x)', rule, [], { defaults: false });
			assertLinterPackage('additional defunct function', parser, 'f <- function(x) old_fn(x)', rule, [{ kind: 'defunct', name: 'old_fn' }], { defunct: ['old_fn'] });
			assertLinterPackage('additional platform device', parser, 'f <- function() myDevice()', rule, [{ kind: 'platform-device', name: 'myDevice', message: 'Found the platform-specific device: myDevice, dev.new() is the preferred way to open a new device' }], { platformDevices: ['myDevice'] });
			assertLinterPackage('built-in platform device disabled', parser, 'f <- function() x11()', rule, [], { defaults: false, platformDevices: ['myDevice'] });
		});

		describe('no findings', () => {
			assertLinterPackage('dev.new is the preferred way', parser, 'f <- function() dev.new()', rule, []);
			assertLinterPackage('similar names are no match', parser, 'f <- function() x11mod() + plclusters()', rule, []);
			assertLinterPackage('a plain function call', parser, 'f <- function(x) sum(x)', rule, []);
			assertLinterPackage('obsolete name not called', parser, 'f <- function(x) x$plclust', rule, []);
			assertLinterPackage('test code is no package code', parser, 'plclust(1)', rule, [], { file: 'tests/testthat/test-a.R' });
			assertLinterPackage('inst code is no package code', parser, 'plclust(1)', rule, [], { file: 'inst/scripts/run.R' });
			assertLinterPackage('vignette code is no package code', parser, 'x11()', rule, [], { file: 'vignettes/intro.R' });
		});

		describe('without a DESCRIPTION', () => {
			assertLinterPackage('code without a package is package code', parser, 'plclust(1)', rule, [{ kind: 'deprecated' }], { files: { DESCRIPTION: null } });
		});
	});
}));
