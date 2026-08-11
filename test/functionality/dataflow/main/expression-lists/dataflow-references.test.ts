import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import type { IdentifierReference } from '../../../../../src/dataflow/environments/identifier';
import { Identifier, isReferenceType, ReferenceType } from '../../../../../src/dataflow/environments/identifier';
import type { KillReference } from '../../../../../src/dataflow/info';

/** the variable-like references, as the sets also carry the called functions */
function variableNames(references: readonly IdentifierReference[]): string[] {
	const names = new Set(references
		.filter(r => r.name !== undefined && isReferenceType(r.type, ReferenceType.Unknown | ReferenceType.Variable))
		.map(r => Identifier.getName(r.name as Identifier)));
	return [...names].sort();
}

function killNames(kills: readonly KillReference[] | undefined): string[] {
	const names = new Set((kills ?? []).map(k => k.kind === 'named'
		? (k.reference.name !== undefined ? Identifier.getName(k.reference.name) : '?')
		: k.kind));
	return [...names].sort();
}

describe('References of an Expression List', withTreeSitter(parser => {
	interface ExpectedReferences {
		readonly in?:      readonly string[];
		readonly out?:     readonly string[];
		readonly unknown?: readonly string[];
		readonly kill?:    readonly string[];
	}

	function assertReferences(name: string, code: string, expected: ExpectedReferences) {
		test(name, async() => {
			const { dataflow } = await createDataflowPipeline(parser, { context: contextFromInput(code) }).allRemainingSteps();
			expect({
				in:      variableNames(dataflow.in),
				out:     variableNames(dataflow.out),
				unknown: variableNames(dataflow.unknownReferences),
				kill:    killNames(dataflow.kill)
			}).toEqual({
				in:      [...expected.in ?? []].sort(),
				out:     [...expected.out ?? []].sort(),
				unknown: [...expected.unknown ?? []].sort(),
				kill:    [...expected.kill ?? []].sort()
			});
		});
	}

	describe('Plain Definitions', () => {
		assertReferences('unresolved read', 'y <- x', { in: ['x'], out: ['y'] });
		assertReferences('locally defined read', 'x <- 1\ny <- x', { out: ['x', 'y'] });
		assertReferences('redefinition', 'x <- 1\nx <- 2\ny <- x', { out: ['x', 'y'] });
		assertReferences('nested list', '{ x <- 1 }\ny <- x', { out: ['x', 'y'] });
		assertReferences('read within a function', 'x <- 1\nf <- function() { y <- x }', { out: ['x'] });
	});

	describe('Conditional Definitions', () => {
		assertReferences('definition in one branch', 'if(c) x <- 1\ny <- x', { in: ['c', 'x'], out: ['x', 'y'] });
		assertReferences('definition in every branch', 'if(c) x <- 1 else x <- 2\ny <- x', { in: ['c'], out: ['x', 'y'] });
		assertReferences('definition in every nested branch', 'if(c) { if(d) x <- 1 else x <- 2 } else x <- 3\ny <- x', { in: ['c', 'd'], out: ['x', 'y'] });
		assertReferences('conditional redefinition', 'x <- 1\nif(c) x <- 2\ny <- x', { in: ['c'], out: ['x', 'y'] });
		assertReferences('definition within a loop', 'for(i in 1:2) x <- 1\ny <- x', { in: ['x'], out: ['i', 'x', 'y'] });
		assertReferences('redefinition within a loop', 'x <- 1\nwhile(c) x <- 2\ny <- x', { in: ['c'], out: ['x', 'y'] });
	});

	describe('Replacements', () => {
		assertReferences('without a definition', 'x$a <- x$a', { in: ['x'], out: ['x'] });
		assertReferences('nested target', 'x <- list()\nnames(x$a) <- v', { in: ['v'], out: ['x'] });
		assertReferences('one replacement', 'x <- foo()\nx$a <- x$a', { out: ['x'] });
		assertReferences('two replacements', 'x <- foo()\nx$a <- x$a\nx$b <- x$b', { out: ['x'] });
		assertReferences('conditional replacement', 'x <- 1\nif(c) x$a <- 2\ny <- x', { in: ['c'], out: ['x', 'y'] });
		assertReferences('replacement of a branched definition', 'if(c) x <- 1 else x <- 2\nx$a <- x$a\ny <- x', { in: ['c'], out: ['x', 'y'] });
	});

	describe('Removals', () => {
		assertReferences('removed definition', 'x <- 1\nrm(x)\ny <- x', { in: ['x'], out: ['x', 'y'], kill: ['x'] });
		assertReferences('conditional removal', 'x <- 1\nif(c) rm(x)\ny <- x', { in: ['c', 'x'], out: ['x', 'y'], kill: ['x'] });
		assertReferences('removal revived by a later write', 'x <- 1\nrm(x)\nx <- 2', { out: ['x'] });
		assertReferences('removal of the whole scope', 'x <- 1\nrm(list = ls())\ny <- x', { in: ['x'], out: ['x', 'y'], kill: ['all'] });
		assertReferences('whole scope removal with a later write', 'x <- 1\nrm(list = ls())\nx <- 2\nz <- x', { out: ['x', 'z'], kill: ['all'] });
		assertReferences('unresolvable removal', 'x <- 1\nrm(list = c("x"))\ny <- x', { in: ['x'], out: ['x', 'y'], kill: ['unknown'] });
		assertReferences('whole scope removal in a branch', 'x <- 1\ny <- 1\nif(c) { rm(list = ls()); y <- 2 }\nz <- x\nw <- y',
			{ in: ['c', 'x'], out: ['w', 'x', 'y', 'z'], kill: ['all'] });
		assertReferences('revived in one branch only', 'x <- 1\nrm(x)\nif(c) x <- 2\ny <- x', { in: ['c', 'x'], out: ['x', 'y'], kill: ['x'] });
		assertReferences('revived in every branch', 'x <- 1\nrm(x)\nif(c) x <- 2 else x <- 3\ny <- x', { in: ['c'], out: ['x', 'y'] });
	});

	describe('Constructs Evaluated in the Enclosing Scope', () => {
		assertReferences('repeat body', 'repeat { x <- 1; break }\ny <- x', { out: ['x', 'y'] });
		assertReferences('while body', 'while(c) { x <- 1 }\ny <- x', { in: ['c', 'x'], out: ['x', 'y'] });
		assertReferences('tryCatch block', 'tryCatch({ x <- 1 })\ny <- x', { out: ['x', 'y'] });
		assertReferences('tryCatch finally', 'tryCatch({ x <- 1 }, finally = { w <- 2 })\ny <- x\nv <- w', { out: ['v', 'w', 'x', 'y'] });
		assertReferences('local scope', 'local({ x <- 1 })\ny <- x', { in: ['x'], out: ['y'] });
		assertReferences('local super assignment', 'local({ x <<- 1 })\ny <- x', { out: ['x', 'y'] });
		assertReferences('loop variable', 'for(i in 1:3) x <- i\ny <- x', { in: ['x'], out: ['i', 'x', 'y'] });
		assertReferences('loop variable redefined in the body', 'for(i in 1:10) { i; i <- 12 }\ni', { out: ['i'] });
	});
}));
