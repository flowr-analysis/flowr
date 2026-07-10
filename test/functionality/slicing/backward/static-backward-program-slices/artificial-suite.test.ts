import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';

/**
 * Slicing tests for the R files added to the artificial performance suite
 * (`test/performance/suite-artificial/static`), so that we keep slicing them as expected.
 */
describe.sequential('Artificial performance suite', withShell(shell => {
	assertSliced(label('for-loop-accumulate: total ignores the acc vector', []),
		shell,
		'acc <- vector()\ntotal <- 0\nfor (i in 1:50) {\n  total <- total + i\n  acc[i] <- total\n}\nprint(acc)\nprint(total)',
		['8@total'],
		'total <- 0\nfor(i in 1:50) total <- total + i\ntotal'
	);

	assertSliced(label('vector-arithmetic: c only needs a and b', []),
		shell,
		'a <- 1:20\nb <- a * 2\nc <- a + b\nd <- c - a\ne <- d / 2\nf <- e ^ 2\nprint(sum(f))\nprint(mean(c))',
		['8@c'],
		'a <- 1 : 20\nb <- a * 2\nc <- a + b\nc'
	);

	assertSliced(label('string-manipulation: the string chain, without parts', []),
		shell,
		's <- "hello world"\ns <- paste(s, "again", sep = " ")\ns <- toupper(s)\ns <- gsub("O", "0", s)\nparts <- strsplit(s, " ")[[1]]\nprint(nchar(s))\nprint(parts)',
		['6@s'],
		's <- "hello world"\ns <- paste(s, "again", sep = " ")\ns <- toupper(s)\ns <- gsub("O", "0", s)\ns'
	);

	assertSliced(label('data-frame-ops: sub keeps the frame chain, not nrow', []),
		shell,
		'df <- data.frame(a = 1:10, b = letters[1:10])\ndf$c <- df$a * 2\ndf <- df[df$a > 3, ]\nsub <- df[, c("a", "c")]\nprint(colnames(sub))\nprint(nrow(df))',
		['5@sub'],
		'df <- data.frame(a = 1:10, b = letters[1:10])\ndf$c <- df$a * 2\ndf <- df[df$a > 3, ]\nsub <- df[, c("a", "c")]\nsub'
	);

	assertSliced(label('nested-list-access: val keeps the list and its update', []),
		shell,
		'lst <- list(x = list(y = list(z = 1:5)))\nlst$x$y$z[3] <- 42\nval <- lst[["x"]][["y"]][["z"]]\nprint(val)\nprint(lst$x$y$z)',
		['4@val'],
		'lst <- list(x = list(y = list(z = 1:5)))\nlst$x$y$z[3] <- 42\nval <- lst[["x"]][["y"]][["z"]]\nval'
	);

	assertSliced(label('many-parameters: first call drops the second', []),
		shell,
		'g <- function(a, b = 1, c = 2, d = 3, e = 4, f = 5, h = 6, i = 7, j = 8, k = 9) {\n  a + b + c + d + e + f + h + i + j + k\n}\nprint(g(10))\nprint(g(10, 20, 30))',
		['4@g'],
		'g <- function(a, b=1, c=2, d=3, e=4, f=5, h=6, i=7, j=8, k=9) a + b + c + d + e + f + h + i + j + k\ng(10)'
	);

	assertSliced(label('long-pipe: the whole pipe is required', []),
		shell,
		'result <- c(1, 2, 3, 4, 5) |>\n  rev() |>\n  cumsum() |>\n  sqrt() |>\n  round(2) |>\n  sum()\nprint(result)',
		['7@result'],
		'result <- c(1, 2, 3, 4, 5) |> rev() |> cumsum() |> sqrt() |> round(2) |> sum()\nresult'
	);

	assertSliced(label('recursive-function: fib keeps its own definition', []),
		shell,
		'fib <- function(n) {\n  if (n < 2) {\n    return(n)\n  }\n  return(fib(n - 1) + fib(n - 2))\n}\nprint(fib(10))',
		['7@fib'],
		'fib <- function(n) {\n        if(n < 2) { return(n) }\n        return(fib(n - 1) + fib(n - 2))\n    }\nfib(10)'
	);

	assertSliced(label('switch-branches: classify keeps the switch and the loop', []),
		shell,
		'classify <- function(n) {\n  switch(as.character(n %% 3),\n    "0" = "zero",\n    "1" = "one",\n    "2" = "two",\n    "other"\n  )\n}\nfor (i in 1:9) {\n  print(classify(i))\n}',
		['10@classify'],
		'classify <- function(n) switch(as.character(n %% 3),\n    "0" = "zero",\n    "1" = "one",\n    "2" = "two",\n    "other"\n  )\nfor(i in 1:9) classify(i)'
	);

	assertSliced(label('deep-nesting: x needs the full nested structure', []),
		shell,
		'x <- 0\nif (x == 0) {\n  if (x < 1) {\n    if (x >= 0) {\n      while (x < 5) {\n        x <- x + 1\n        if (x %% 2 == 0) {\n          x <- x + 1\n        } else {\n          x <- x + 2\n        }\n      }\n    }\n  }\n}\nprint(x)',
		['16@x'],
		'x <- 0\nif(x == 0)\n    { if(x < 1)\n        { if(x >= 0)\n            { while(x < 5) {\n                x <- x + 1\n                if(x %% 2 == 0) { x <- x + 1 } else\n                { x <- x + 2 }\n            } } } }\nx'
	);

	// the closures write to their captured `count` via `<<-`, so the side-effecting calls are all kept
	assertSliced(label('closure-chain: side-effecting closure calls are all kept', []),
		shell,
		'make_counter <- function(start) {\n  count <- start\n  function() {\n    count <<- count + 1\n    count\n  }\n}\nc1 <- make_counter(0)\nc2 <- make_counter(100)\nprint(c1())\nprint(c1())\nprint(c2())',
		['10@c1'],
		'make_counter <- function(start) {\n        count <- start\n        function() {\n            count <<- count + 1\n            count\n        }\n    }\nc1 <- make_counter(0)\nc2 <- make_counter(100)\nc1()\nc1()\nc2()'
	);
}));
