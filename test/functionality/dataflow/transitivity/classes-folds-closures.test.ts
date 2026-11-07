import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';
/** Slices through S4 slots and validity, folds and the apply family, `local` closures, and argument matching, checked against R. */
describe('Slices through S4, folds, and closures, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'S4 slot set', code: 'setClass("P", representation(x = "numeric"))\np <- new("P", x = 1)\np@x <- 5\nprint(p@x)' },
		{ name: 'S4 slot via slot<-', code: 'setClass("P", representation(x = "numeric"))\np <- new("P", x = 1)\nslot(p, "x") <- 7\nprint(p@x)' },
		{ name: 'S4 prototype', code: 'k <- 3\nsetClass("P", representation(x = "numeric"), prototype(x = k))\nprint(new("P")@x)' },
		{ name: 'S4 validity side effect', code: 'n <- 0\nsetClass("P", representation(x = "numeric"), validity = function(object) { n <<- 5; TRUE })\np <- new("P", x = 1)\nprint(n)' },
		{ name: 'S4 generic with valueClass', code: 'setGeneric("ar", function(o) standardGeneric("ar"))\nsetClass("P", representation(x = "numeric"))\nk <- 2\nsetMethod("ar", "P", function(o) o@x * k)\nprint(ar(new("P", x = 3)))' },
		{ name: 'S4 isVirtualClass method', code: 'setClass("B", representation("VIRTUAL"))\nsetClass("C", contains = "B", representation(x = "numeric"))\nsetGeneric("f", function(o) standardGeneric("f"))\nk <- 9\nsetMethod("f", "B", function(o) k)\nprint(f(new("C", x = 1)))' },
		{ name: 'Reduce init', code: 'k <- 10\nr <- Reduce(function(a, b) a + b, 1:3, k)\nprint(r)' },
		{ name: 'Reduce right accumulate', code: 'r <- Reduce(function(a, b) paste0(a, b), c("x", "y"), accumulate = TRUE, right = TRUE)\nprint(r)' },
		{ name: 'local sys.function', code: 'f <- local({ k <- 3; function(n) if(n == 0) k else sys.function()(n - 1) })\nprint(f(2))' },
		{ name: 'local closure counter', code: 'counter <- local({ i <- 0; function() { i <<- i + 1; i } })\ncounter()\nprint(counter())' },
		{ name: 'Map with names', code: 'k <- 2\nr <- Map(function(x, y) x * y * k, 1:2, 3:4)\nprint(r[[2]])' },
		{ name: 'mapply MoreArgs', code: 'k <- 5\nr <- mapply(function(x, z) x + z, 1:2, MoreArgs = list(z = k))\nprint(r)' },
		{ name: 'vapply FUN.VALUE', code: 'k <- 1\nr <- vapply(1:2, function(i) i + k, numeric(1))\nprint(r)' },
		{ name: 'rapply', code: 'k <- 1\nr <- rapply(list(1, list(2)), function(x) x + k, how = "unlist")\nprint(r)' },
		{ name: 'Filter Position', code: 'k <- 2\nprint(Position(function(x) x > k, c(1, 3, 5)))' },
		{ name: 'environment manipulation local', code: 'e <- local({ v <- 4; environment() })\nprint(get("v", envir = e))' },
		{ name: 'sys.call match.arg', code: 'f <- function(type = c("a", "b")) { type <- match.arg(type); type }\nprint(f("b"))' },
		{ name: 'nested function default reading later local', code: 'f <- function() { g <- function(x = y) x; y <- 4; g() }\nprint(f())' },
		{ name: 'missing arg', code: 'f <- function(a, b) if(missing(b)) a else b\nk <- 3\nprint(f(k))' },
		{ name: 'switch returning function', code: 'k <- 7\nf <- switch("b", a = function() 1, b = function() k)\nprint(f())' },
		{ name: 'formula environment', code: 'k <- 2\nfo <- y ~ x\nd <- data.frame(x = 1:3, y = (1:3) * k)\nprint(coef(lm(fo, d))[[2]])' },
		{ name: 'Negate Compose', code: 'k <- 2\nisBig <- function(x) x > k\nprint(Filter(Negate(isBig), 1:4))' },
		{ name: 'Vectorize', code: 'k <- 1\nf <- Vectorize(function(a, b) a + b + k)\nprint(f(1:2, 3:4))' },
		{ name: 'do.call with names', code: 'k <- 4\nf <- function(a, b) a - b\nprint(do.call(f, list(b = 1, a = k)))' },
		{ name: 'Recall in anonymous', code: 'print((function(n) if(n <= 1) 1 else n * Recall(n - 1))(4))' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
