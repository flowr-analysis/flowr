import { describe } from 'vitest';
import { assertLinter, controlledSigDb } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

/** every package here resolves to version `1.0.0` */
const sigDb = controlledSigDb({
	ggplot2: ['ggplot', 'aes', 'geom_point'],
	random1: ['test1', 'test3'],
	p:       ['f']
});

describe('flowR linter', withTreeSitter(parser => {
	describe('unused import', () => {
		const unused = (pkg: string, loc: [number, number, number, number], quickFix = true) => ({
			certainty: LintingResultCertainty.Uncertain as const,
			loc,
			package:   pkg,
			version:   '1.0.0',
			quickFix:  quickFix ? [{ type: 'remove' as const, description: `Remove the unused import of ${pkg}`, loc }] : undefined
		});
		const meta = (considered: number, unresolved: number, multiPackage: number, reported: number) => ({
			totalConsidered:   considered,
			totalUnresolved:   unresolved,
			totalMultiPackage: multiPackage,
			totalUnused:       reported
		});

		describe('basics', () => {
			assertLinter('a lone import is unused', parser, 'library(ggplot2)', 'unused-import',
				[unused('ggplot2', [1, 1, 1, 16])], meta(1, 0, 0, 1), { sigDb });

			assertLinter('character.only resolves the package from the variable', parser,
				'pkg <- "ggplot2"\nlibrary(pkg, character.only = TRUE)', 'unused-import',
				[unused('ggplot2', [2, 1, 2, 35])], meta(1, 0, 0, 1), { sigDb });

			assertLinter('a called export keeps the import', parser, 'library(ggplot2)\nggplot()', 'unused-import',
				[], undefined, { sigDb });

			assertLinter('require counts just like library', parser, 'require(ggplot2)\nrequire(random1)\naes()', 'unused-import',
				[unused('random1', [2, 1, 2, 16])], undefined, { sigDb });

			assertLinter('only the unused ones are reported', parser, 'library(p)\nlibrary(ggplot2)\nlibrary(random1)\nggplot()', 'unused-import',
				[unused('p', [1, 1, 1, 10]), unused('random1', [3, 1, 3, 16])], undefined, { sigDb });
		});

		describe('what counts as a use', () => {
			assertLinter('a namespaced call keeps the import', parser, 'library(ggplot2)\nggplot2::ggplot()', 'unused-import',
				[], undefined, { sigDb });

			assertLinter('a use inside a function body keeps the import', parser, 'library(ggplot2)\nf <- function() aes()\nf()', 'unused-import',
				[], undefined, { sigDb });

			assertLinter('a use inside a branch keeps the import', parser, 'library(ggplot2)\nif(x) { ggplot() }', 'unused-import',
				[], undefined, { sigDb });

			assertLinter('a shadowed export does not keep the import', parser, 'library(ggplot2)\naes <- function() 1\naes()', 'unused-import',
				[unused('ggplot2', [1, 1, 1, 16])], undefined, { sigDb });

			assertLinter('a call we cannot bind yet keeps the import, even when the code defines the name itself', parser,
				'library(ggplot2)\naes <- function() 1\nf <- function() aes()\nf()', 'unused-import',
				[], undefined, { sigDb });

			assertLinter('using one package does not excuse the others', parser,
				'library(p)\nlibrary(ggplot2)\nlibrary(random1)\np::f()\ntest1()', 'unused-import',
				[unused('ggplot2', [2, 1, 2, 16])], undefined, { sigDb });
		});

		describe('quick fix', () => {
			assertLinter('a braced branch can be emptied', parser, 'library(ggplot2)\nif(x) { print(1) }', 'unused-import',
				[unused('ggplot2', [1, 1, 1, 16])], undefined, { sigDb });

			assertLinter('an unbraced branch offers no removal', parser, 'if(x) library(ggplot2)', 'unused-import',
				[unused('ggplot2', [1, 7, 1, 22], false)], undefined, { sigDb });

			assertLinter('an unbraced function body offers no removal', parser, 'f <- function() library(ggplot2)', 'unused-import',
				[unused('ggplot2', [1, 17, 1, 32], false)], undefined, { sigDb });
		});

		describe('what is out of scope', () => {
			assertLinter('a package the database does not know is skipped', parser,
				'library(ggplot2)\nlibrary(random1)\nlibrary(notInDb)\naes()', 'unused-import',
				[unused('random1', [2, 1, 2, 16])], undefined, { sigDb });

			assertLinter('a whitelisted package is never reported', parser,
				'require(p)\nrequire(ggplot2)\nrequire(random1)\naes()', 'unused-import',
				[unused('p', [1, 1, 1, 10])], undefined, { sigDb, whitelist: ['random1'] });

			assertLinter('nothing is reported without a signature database', parser, 'library(ggplot2)', 'unused-import',
				[], undefined, { noSigDb: true });

			assertLinter('requireNamespace is not an import', parser,
				'if(!requireNamespace("ggplot2", quietly = TRUE)) stop("need it")', 'unused-import',
				[], undefined, { sigDb });

			assertLinter('loadNamespace is not an import', parser, 'loadNamespace("ggplot2")', 'unused-import',
				[], undefined, { sigDb });

			assertLinter('a qualified call is not an import of its own', parser, 'p::f()', 'unused-import',
				[], undefined, { sigDb });

			assertLinter('an attach naming several packages at once is skipped', parser,
				'for(pkg in c("ggplot2", "p")) library(pkg, character.only = TRUE)', 'unused-import',
				[], meta(1, 0, 1, 0), { sigDb });

			assertLinter('an attach whose package cannot be resolved is skipped', parser,
				'library(pkg, character.only = TRUE)', 'unused-import',
				[], meta(1, 1, 0, 0), { sigDb });
		});
	});
}));
