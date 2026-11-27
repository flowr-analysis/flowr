import { describe } from 'vitest';
import type { AliasesQuery } from '../../../src/queries/catalog/aliases-query/aliases-query-format';
import { assertQuery } from '../_helper/query';
import { label } from '../_helper/label';
import type { QueryResultsWithoutMeta } from '../../../src/queries/query';
import { withTreeSitter } from '../_helper/shell';
import type { SourceLocation } from '../../../src';

describe('Aliases Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly AliasesQuery[], expected: QueryResultsWithoutMeta<AliasesQuery>) {
		assertQuery(label(name), parser, code, query, expected);
	}

	testQuery('Basic', 'f <- function(...) 42\ng <- f', [{ type: 'aliases', criteria: ['1@f'] }], { aliases: { result: [['1@f', [[2, 1, 2, 1] as SourceLocation]]] } });
	testQuery('Basic 2', 'f <- function(...) 42\ng <- f\nh <- g', [{ type: 'aliases', criteria: ['1@f', '2@g'] }], { aliases: { result: [['1@f', [[2, 1, 2, 1] as SourceLocation, [3, 6, 3, 6] as SourceLocation, [3, 1, 3, 1] as SourceLocation]], ['2@g', [[3, 1, 3, 1] as SourceLocation]]] } });
	testQuery('Basic - using nodeId criteria', 'f <- function(...) 42\ng <- f\nh <- g', [{ type: 'aliases', criteria: ['1@f', '2@g'], id: [7]  }], { aliases: { result: [['1@f', [[2, 1, 2, 1] as SourceLocation, [3, 6, 3, 6] as SourceLocation, [3, 1, 3, 1] as SourceLocation]], ['2@g', [[3, 1, 3, 1] as SourceLocation]], [7, [10]]] } });
	testQuery('several levels of aliases', 'f <- function(...){g <- h}\nh <- f\nf()', [{ type: 'aliases', criteria: ['3@f'] }], { aliases: { result: [['3@f', [[2, 1, 2, 1] as SourceLocation, [1, 25, 1, 25] as SourceLocation, [1, 20, 1, 20] as SourceLocation]]] } });
	testQuery('several levels of aliases 2', 'f <- function(...){g <- h}\nh <- f', [{ type: 'aliases', criteria: ['2@f'] }], { aliases: { result: [['2@f', [[2, 1, 2, 1] as SourceLocation, [1, 25, 1, 25] as SourceLocation, [1, 20, 1, 20] as SourceLocation]]] } });
	testQuery('several levels of aliases - interrupted', 'f <- 5\ng <- f\nf <- f+1\nh <- g', [{ type: 'aliases', criteria: ['1@f', '3@f', '2@g'] }], { aliases: { result: [['1@f', [[2, 1, 2, 1] as SourceLocation, [4, 6, 4, 6] as SourceLocation, [4, 1, 4, 1] as SourceLocation]], ['3@f', []], ['2@g', [[4, 1, 4, 1] as SourceLocation]]] } });
	testQuery('branches - if/else', `a <- function(a){
	print(a);
}
b <- function(a){
	print("Hello");
}
x <- 4
if(x < 0){
	c <- a
} else {
	c <- b
}
c`, [{ type: 'aliases', criteria: ['1@a'] }], { aliases: { result: [['1@a', [[9, 2, 9, 2] as SourceLocation, [13, 1, 13, 1] as SourceLocation]]] } });
	testQuery('lazy evaluation - value set at call', `f <- function(c, a=b) {
	b <- c;
	a()
}
g <- function(){ 42 }
f(g)`, [{ type: 'aliases', criteria: ['1@f', '1@a', '1@b', '5@g'] }], { aliases: { result: [['1@f', []], ['1@a', []], ['1@b', [[1, 18, 1, 20] as SourceLocation, [3, 2, 3, 4] as SourceLocation]], ['5@g', [[1, 15, 1, 15] as SourceLocation, [2, 7, 2, 7] as SourceLocation, [2, 2, 2, 2] as SourceLocation, [1, 20, 1, 20] as SourceLocation, [1, 18, 1, 20] as SourceLocation, [3, 2, 3, 4] as SourceLocation]]] } });

	testQuery('lazy evaluation - ambigious definition', `a <- function() { -1 }
f <- function(c, a=b) { 
    b <- 4; 
	print(a);
	b <- c;
    a() 
}
g <- function(){ 42 }
f(g)`, [{ type: 'aliases', criteria: ['1@a', '2@a', '2@b', '8@g'] }], { aliases: { result: [['1@a', []], ['2@a', []], ['2@b', [[2, 18, 2, 20] as SourceLocation, [4, 8, 4, 8] as SourceLocation]], ['8@g', [[2, 15, 2, 15] as SourceLocation, [5, 7, 5, 7] as SourceLocation, [5, 2, 5, 2] as SourceLocation]]] } });

	testQuery('branches - only if', `a <- function(a){
	print(a);
}
b <- function(a){
	print("Hello");
}
x <- 4
c <- b
if(x < 0){
	c <- a
}
c`, [{ type: 'aliases', criteria: ['1@a', '4@b'] }], { aliases: { result: [['1@a', [[10, 2, 10, 2] as SourceLocation, [12, 1, 12, 1] as SourceLocation]], ['4@b', [[8, 1, 8, 1] as SourceLocation, [12, 1, 12, 1] as SourceLocation]]] } });

	testQuery('branches - overwrite in if', `a <- function(a){
	print(a);
}
a
b <- function(a){
	print("Hello");
}
x <- 4
c <- b
if(x < 0){
	c <- a
	c <- b
}
c`, [{ type: 'aliases', criteria: ['1@a', '5@b'] }], { aliases: { result: [['1@a', [[11, 2, 11, 2] as SourceLocation]], ['5@b', [[12, 2, 12, 2] as SourceLocation, [14, 1, 14, 1] as SourceLocation, [9, 1, 9, 1] as SourceLocation]]] } });
	testQuery('Loop and if', `x <- 4
b <- function(a){
	print("Hello");
}
a <- function(a){
	print(a);
}
while(x > 0){
	if(x %% 2){
		c <- a
		c()
	}
	c <- b
	x <- x - 1
}
c()
a
b`, [{ type: 'aliases', criteria: ['2@b', '5@a'] }], { aliases: { result: [['2@b', [[13, 2, 13, 2] as SourceLocation, [16, 1, 16, 3] as SourceLocation]], ['5@a', [[10, 3, 10, 3] as SourceLocation, [11, 3, 11, 5] as SourceLocation]]] } });
}));