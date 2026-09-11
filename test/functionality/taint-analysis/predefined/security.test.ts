import { describe, test } from 'vitest';
import { testTaintAnalysis, type TaintAnalysisExpectation } from '../helper';
import { securityAnalysis, NetworkInput, FileInput, UserInput } from '../../../../src/taint-analysis/predefined/security-analysis';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { decorateLabelContext, label } from '../../_helper/label';

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
	});

	describe('Connection Argument Aware', () => {
		testSecurity('read.table with a URL literal is NetworkInput', 'x <- read.table("http://example.com/data.csv")', { '1@x': NetworkInput });
		testSecurity('read.csv with a named URL argument is NetworkInput', 'x <- read.csv(file = "https://example.com/d.csv")', { '1@x': NetworkInput });
		testSecurity('namespaced utils::read.csv with a URL is NetworkInput', 'x <- utils::read.csv("http://example.com/data.csv")', { '1@x': NetworkInput });
		testSecurity('read.table with a local path literal is FileInput', 'x <- read.table("data.csv")', { '1@x': FileInput });
		testSecurity('read.table with an unresolved path defaults to FileInput', 'p <- somevar\nx <- read.table(p)', { '2@x': FileInput });
		testSecurity('download.file remains NetworkInput regardless of argument', 'x <- download.file("data.csv", "out.csv")', { '1@x': NetworkInput });
	});

	describe('Sink-Source Conflict', () => {
		testSecurity('sink taint wins when the sink condition matches a tainted argument', 'src <- download.file("http://example.com/data.csv")\nx <- download.file(src, "out.csv")', { '2@x': Bottom });
		testSecurity('source taint wins when the sink condition yields undefined', 'x <- download.file("data.csv", "out.csv")', { '1@x': NetworkInput });
	});

	describe('Disabled Unsupported Calls', () => {
		testSecurity('user input evaluated inline is reported', 'x <- eval(readline())', { '1@x': Bottom });
		testSecurity('user input flowing to eval is reported', 'u <- readline()\nx <- eval(u)', { '2@x': Bottom });
		testSecurity('user input flowing to system is reported', 'u <- readline()\nx <- system(u)', { '2@x': Bottom });
	});

	describe('Unrelated Calls', () => {
		testSecurity('unrelated function call is Top', 'x <- toupper("hello")', { '1@x': Top });
		testSecurity('unrelated literal is untracked', 'x <- 42', { '1@x': undefined });
	});

	describe('Higher-Order Propagation', () => {
		testSecurity('user input inside a sapply closure propagates', 'y <- sapply(1:5, function(i) readline())', { '1@y': UserInput });
		testSecurity('user input inside a lapply closure propagates', 'y <- lapply(1:5, function(i) readline())', { '1@y': UserInput });
	});
});
