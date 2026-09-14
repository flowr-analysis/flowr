import { describe, test } from 'vitest';
import { testTaintAnalysis, type TaintAnalysisExpectation } from '../helper';
import { securityAnalysis, NetworkInput, FileInput, UserInput } from '../../../../src/taint-analysis/predefined/security-analysis';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { decorateLabelContext, label } from '../../_helper/label';
import { testLoopFixpoint } from '../loop-helper';

function testSecurity(name: string, code: string, expectation: TaintAnalysisExpectation): void {
	const effectiveName = decorateLabelContext(label(name), ['taint']);
	test(effectiveName, async() => {
		await testTaintAnalysis(code, securityAnalysis, expectation);
	});
}

describe('Security Taint Analysis', () => {
	describe('User Input', () => {
		testSecurity('readline is UserInput', 'x <- readline()', { '1@x': UserInput });
		testSecurity('namespaced base::readline is UserInput', 'x <- base::readline("name: ")', { '1@x': UserInput });
		testSecurity('file.choose is UserInput', 'x <- file.choose()', { '1@x': UserInput });
		testSecurity('menu is UserInput', 'x <- menu(c("a", "b"))', { '1@x': UserInput });
		testSecurity('scan is UserInput', 'x <- scan()', { '1@x': UserInput });
	});

	describe('Connection Argument Aware', () => {
		testSecurity('read.table with a URL literal is NetworkInput', 'x <- read.table("http://example.com/data.csv")', { '1@x': NetworkInput });
		testSecurity('read.csv with a named URL argument is NetworkInput', 'x <- read.csv(file = "https://example.com/d.csv")', { '1@x': NetworkInput });
		testSecurity('namespaced utils::read.csv with a URL is NetworkInput', 'x <- utils::read.csv("http://example.com/data.csv")', { '1@x': NetworkInput });
		testSecurity('read.table with a local path literal is FileInput', 'x <- read.table("data.csv")', { '1@x': FileInput });
		testSecurity('read.table with an unresolved path defaults to FileInput', 'p <- somevar\nx <- read.table(p)', { '2@x': FileInput });
		testSecurity('download.file remains NetworkInput regardless of argument', 'x <- download.file("data.csv", "out.csv")', { '1@x': NetworkInput });
	});

	describe('Hand-written sink rules', () => {
		testSecurity('user input evaluated via source is reported', 'x <- source(readline())', { '1@x': Bottom });
		testSecurity('user input evaluated via sys.source is reported', 'x <- sys.source(readline())', { '1@x': Bottom });
		testSecurity('user input parsed via parse is reported', 'x <- parse(readline())', { '1@x': Bottom });
	});

	describe('Serialization sinks (serialize / unserialize / dump)', () => {
		testSecurity('user input deserialized via unserialize (connection) is reported', 'u <- readline()\nx <- unserialize(u)', { '2@x': Bottom });
		testSecurity('network input deserialized via unserialize is reported', 'con <- url("http://x")\nx <- unserialize(con)', { '2@x': Bottom });

		testSecurity('a tainted object serialized is reported', 'x <- serialize(readline())', { '1@x': Bottom });
		testSecurity('a tainted serialize destination is reported', 'o <- 1\nx <- serialize(o, readline())', { '2@x': Bottom });
		testSecurity('a tainted named serialize connection is reported', 'o <- 1\nx <- serialize(object = o, connection = readline())', { '2@x': Bottom });
		testSecurity('namespaced base::serialize of tainted data is reported', 'x <- base::serialize(readline())', { '1@x': Bottom });
		testSecurity('serialize of untainted arguments yields no finding', 'x <- serialize(o, con)', { '1@x': Top });

		testSecurity('tainted dump object list is reported', 'x <- dump(readline())', { '1@x': Bottom });
		testSecurity('tainted dump destination is reported', 'u <- readline()\nx <- dump("obj", u)', { '2@x': Bottom });
		testSecurity('file input dumped is reported', 'f <- read.table("data.csv")\nx <- dump(f)', { '2@x': Bottom });
		testSecurity('dump to an untainted file yields no finding', 'x <- dump("obj", "out.R")', { '1@x': Top });
	});

	describe('Sinks from builtin-index', () => {
		testSecurity('user input evaluated inline via eval is reported', 'x <- eval(readline())', { '1@x': Bottom });
		testSecurity('user input flowing to eval is reported', 'u <- readline()\nx <- eval(u)', { '2@x': Bottom });
		testSecurity('user input flowing to system is reported', 'u <- readline()\nx <- system(u)', { '2@x': Bottom });
		testSecurity('user input flowing to do.call is reported', 'u <- readline()\nx <- do.call(u, list())', { '2@x': Bottom });
		testSecurity('network input flowing to get is reported', 'n <- url("http://x")\nx <- get(n)', { '2@x': Bottom });
		testSecurity('user input opening a pipe is reported', 'x <- pipe(readline())', { '1@x': Bottom });
		testSecurity('user input written via write.csv (Resource arg) is reported', 'u <- readline()\nx <- write.csv(d, u)', { '2@x': Bottom });
		testSecurity('file input used as save destination (Resource arg) is reported', 'f <- read.table("data.csv")\nx <- save(obj, file = f)', { '2@x': Bottom });
		testSecurity('user input passed to sourceCpp (Ffi, Resource arg) is reported', 'x <- sourceCpp(readline())', { '1@x': Bottom });
	});

	describe('Sanitizers', () => {
		testSecurity('shQuote maps user input to Top', 'x <- shQuote(readline())', { '1@x': Top });
		testSecurity('match.arg maps user input to Top', 'x <- match.arg(readline())', { '1@x': Top });
		testSecurity('make.names maps user input to Top', 'x <- make.names(readline())', { '1@x': Top });

		testSecurity('shQuote neutralizes user input before it reaches system (no finding)', 'u <- readline()\nsafe <- shQuote(u)\nx <- system(safe)', { '3@x': Top });
		testSecurity('shQuote neutralizes user input before it reaches eval (no finding)', 'u <- readline()\nsafe <- shQuote(u)\nx <- eval(safe)', { '3@x': Top });
		testSecurity('make.names neutralizes user input before it reaches do.call (no finding)', 'u <- readline()\ncmd <- make.names(u)\nx <- do.call(cmd, list())', { '3@x': Top });
	});

	describe('Pass-through transformers', () => {
		testSecurity('which passes through user input', 'x <- which(readline())', { '1@x': UserInput });
		testSecurity('rep passes through user input', 'x <- rep(readline(), 2)', { '1@x': UserInput });
		testSecurity('user input passed through rep reaches system (finding)', 'u <- readline()\nr <- rep(u, 2)\nx <- system(r)', { '3@x': Bottom });
		testSecurity('user input passed through which reaches system (finding)', 'u <- readline()\nw <- which(u)\nx <- system(w)', { '3@x': Bottom });
	});

	describe('Sink-Source Conflict', () => {
		testSecurity('sink taint wins when the sink condition matches a tainted argument', 'n <- url("http://example.com")\nx <- serialize(n)', { '2@x': Bottom });
		testSecurity('source taint wins when the sink argument is untracked', 'x <- download.file("data.csv", "out.csv")', { '1@x': NetworkInput });
	});

	describe('Multi-argument sinks (any tainted resource/injectable argument is a finding)', () => {
		testSecurity('download.file with a tainted url argument is reported', 'src <- download.file("http://example.com/data.csv")\nx <- download.file(src, "out.csv")', { '2@x': Bottom });
		testSecurity('download.file with a tainted destfile argument is reported', 'd <- readline()\nx <- download.file("http://example.com/d.csv", d)', { '2@x': Bottom });
		testSecurity('download.file with only untainted arguments keeps its NetworkInput source taint', 'x <- download.file("data.csv", "out.csv")', { '1@x': NetworkInput });
		testSecurity('system2 with a tainted args argument is reported', 'u <- readline()\nx <- system2("ls", u)', { '2@x': Bottom });
		testSecurity('system2 with a tainted command argument is reported', 'u <- readline()\nx <- system2(u, "-la")', { '2@x': Bottom });
		testSecurity('system2 with only untainted arguments yields no finding', 'x <- system2("ls", "-la")', { '1@x': Top });
	});

	describe('Unrelated Calls', () => {
		testSecurity('unrelated function call is Top', 'x <- toupper("hello")', { '1@x': Top });
		testSecurity('unrelated literal is untracked', 'x <- 42', { '1@x': undefined });
	});

	describe('Higher-Order Propagation', () => {
		testSecurity('user input inside a sapply closure propagates', 'y <- sapply(1:5, function(i) readline())', { '1@y': UserInput });
		testSecurity('user input inside a lapply closure propagates', 'y <- lapply(1:5, function(i) readline())', { '1@y': UserInput });
	});

	describe('Loops preserve the taint (no unexpected widening)', () => {
		testLoopFixpoint(securityAnalysis, 'a user-input source re-read each iteration stays UserInput', 'x <- readline()', 'x <- readline()', UserInput);
		testLoopFixpoint(securityAnalysis, 'UserInput forwarded through the loop stays UserInput', 'x <- readline()', 'x <- x', UserInput);
		testLoopFixpoint(securityAnalysis, 'FileInput forwarded through the loop stays FileInput', 'x <- read.table("data.csv")', 'x <- x', FileInput);
		testLoopFixpoint(securityAnalysis, 'NetworkInput forwarded through the loop stays NetworkInput', 'x <- download.file("http://example.com/d.csv")', 'x <- x', NetworkInput);
	});
});
