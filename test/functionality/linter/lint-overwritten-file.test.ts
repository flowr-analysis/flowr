import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('overwritten-file', () => {
		assertLinter('the same file written twice', parser, 'write.csv(d, "a.csv")\nwrite.csv(e, "a.csv")', 'overwritten-file', [
			{ certainty: LintingResultCertainty.Certain, loc: [2, 1, 2, 21], file: 'a.csv', firstLine: 1 }
		]);
		assertLinter('different files are fine', parser, 'write.csv(d, "a.csv")\nwrite.csv(e, "b.csv")', 'overwritten-file', []);
		assertLinter('appending is no overwrite', parser, 'cat("a", file = "l.txt")\ncat("b", file = "l.txt", append = TRUE)', 'overwritten-file', []);
		assertLinter('writes into one connection are no overwrite', parser, 'con <- file("o.txt", "w")\nwriteLines("a", con)\nwriteLines("b", con)\nclose(con)', 'overwritten-file', []);
		assertLinter('a write only in one branch may overwrite', parser, 'write.csv(d, "a.csv")\nif(u) write.csv(e, "a.csv")', 'overwritten-file', [
			{ certainty: LintingResultCertainty.Uncertain, loc: [2, 7, 2, 27], file: 'a.csv', firstLine: 1 }
		]);
		assertLinter('two calls of a function writing the same file', parser, 'f <- function(n) write.csv(d, n)\nf("a.csv")\nf("a.csv")', 'overwritten-file', [
			{ certainty: LintingResultCertainty.Certain, loc: [3, 1, 3, 10], file: 'a.csv', firstLine: 2 }
		]);
		assertLinter('two plots on one device are two pages of one file', parser, 'pdf("x.pdf")\nplot(1)\nplot(2)\ndev.off()', 'overwritten-file', []);
		assertLinter('a mode that only reads like append is no append', parser, 'write.csv(d, "a")\nwrite.csv(e, "a")', 'overwritten-file', [
			{ certainty: LintingResultCertainty.Certain, loc: [2, 1, 2, 17], file: 'a', firstLine: 1 }
		]);
		assertLinter('a connection opened to append is no overwrite', parser, 'writeLines("a", "l.txt")\ncon <- file("l.txt", "a")\nwriteLines("b", con)\nclose(con)', 'overwritten-file', []);
		assertLinter('a helper building the path saves under a name used before', parser, 'save_figure <- function(name) ggplot2::ggsave(file.path("out", paste0(name, ".pdf")))\nsave_figure("a")\nsave_figure("b")\nsave_figure("a")', 'overwritten-file', [
			{ certainty: LintingResultCertainty.Certain, loc: [4, 1, 4, 16], file: 'out/a.pdf', firstLine: 2 }
		]);
		assertLinter('a helper building the path under distinct names', parser, 'save_figure <- function(name) ggplot2::ggsave(file.path("out", paste0(name, ".pdf")))\nsave_figure("a")\nsave_figure("b")', 'overwritten-file', []);
		assertLinter('a helper called through another helper', parser, 'inner <- function(k) write.csv(d, k)\nouter <- function(n) inner(paste0("x-", n, ".csv"))\nouter("a")\nouter("b")\nouter("a")', 'overwritten-file', [
			{ certainty: LintingResultCertainty.Certain, loc: [5, 1, 5, 10], file: 'x-a.csv', firstLine: 3 }
		]);
		assertLinter('a call relying on the default and one naming it', parser, 'save_it <- function(n = "a.csv") write.csv(d, n)\nsave_it()\nsave_it("a.csv")', 'overwritten-file', [
			{ certainty: LintingResultCertainty.Certain, loc: [3, 1, 3, 16], file: 'a.csv', firstLine: 2 }
		]);
		assertLinter('a call relying on the default and one naming another file', parser, 'save_it <- function(n = "a.csv") write.csv(d, n)\nsave_it()\nsave_it("b.csv")', 'overwritten-file', []);
		assertLinter('a write in the helper and one at the top', parser, 'save_it <- function(n) write.csv(d, n)\nwrite.csv(e, "a.csv")\nsave_it("a.csv")', 'overwritten-file', [
			{ certainty: LintingResultCertainty.Certain, loc: [3, 1, 3, 16], file: 'a.csv', firstLine: 2 }
		]);
		assertLinter('a helper never called writes nothing twice', parser, 'save_it <- function(n) { write.csv(d, n); write.csv(e, n) }', 'overwritten-file', []);
		assertLinter('a helper writing its file twice', parser, 'save_it <- function(n) {\n  write.csv(d, n)\n  write.csv(e, n)\n}\nsave_it("a.csv")', 'overwritten-file', [
			{ certainty: LintingResultCertainty.Certain, loc: [3, 3, 3, 17], file: 'a.csv', firstLine: 2 }
		]);
		assertLinter('two calls of a function writing different files', parser, 'f <- function(n) write.csv(d, n)\nf("a.csv")\nf("b.csv")', 'overwritten-file', []);
	});
}));
