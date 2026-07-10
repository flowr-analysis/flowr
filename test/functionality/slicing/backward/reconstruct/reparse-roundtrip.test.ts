import { describe, expect, test } from 'vitest';
import { retrieveNormalizedAst, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { createSlicePipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { collectAllSlicingCriteria } from '../../../../../src/slicing/criterion/collect-all';
import { DefaultAllVariablesFilter } from '../../../../../src/slicing/criterion/filters/all-variables';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import type { RShell } from '../../../../../src/r-bridge/shell';

/**
 * Guards that reconstruction always emits valid, re-parseable R: for representative constructs seen in the
 * social-science benchmark suite we slice at *every* variable criterion, reconstruct, and hand the result back
 * to R. If reconstruction ever produced code R cannot parse (the benchmark's `failedToRepParse`), one of these
 * would fail. Samples deliberately mix in CRLF line endings so both the parser and reconstructor stay robust.
 */
describe.sequential('Reconstruction re-parse round-trip', withShell(shell => {
	async function assertEverySliceReparses(shell: RShell, input: string): Promise<void> {
		const ast = await retrieveNormalizedAst(shell, input);
		const criteria = [...collectAllSlicingCriteria(ast.ast, DefaultAllVariablesFilter)];
		expect(criteria.length, 'sample should have at least one slicing criterion').toBeGreaterThan(0);
		for(const criterion of criteria) {
			const result = await createSlicePipeline(shell, {
				context: contextFromInput(input),
				criterion
			}).allRemainingSteps();
			const code = result.reconstruct.code as string;
			// R itself must accept the reconstructed slice - otherwise the slice is unusable
			await expect(
				shell.parse({ request: 'text', content: code }),
				`reconstruction for criterion ${JSON.stringify(criterion)} must re-parse, but R rejected:\n${code}`
			).resolves.toBeDefined();
		}
	}

	const samples: Record<string, string> = {
		'native pipe chain':       'res <- c(1, 2, 3) |>\n  rev() |>\n  cumsum() |>\n  sum()\nprint(res)',
		'magrittr pipe chain':     'library(magrittr)\nres <- c(1, 2, 3) %>% rev() %>% cumsum()\nprint(res)',
		'replacement functions':   'df <- data.frame(a = 1:3)\nnames(df) <- c("x")\ndf$y <- df$x * 2\ndf[1, "x"] <- 9\nprint(df)',
		'control flow and loops':  'total <- 0\nfor(i in 1:10) {\n  if(i %% 2 == 0) {\n    total <- total + i\n  } else {\n    next\n  }\n}\nwhile(total > 0) total <- total - 1\nprint(total)',
		'closures and functions':  'make <- function(start) {\n  count <- start\n  function() {\n    count <<- count + 1\n    count\n  }\n}\nc1 <- make(0)\nprint(c1())',
		'strings and escapes':     'msg <- paste0("a\\t\\"b\\"", \'single\')\nlbl <- gsub("O", "0", "FOO")\ncat(msg, lbl)',
		'switch and index access': 'classify <- function(n) switch(as.character(n), "1" = "one", "two")\nv <- list(a = 1:5)[["a"]][2]\nprint(classify(v))'
	};

	for(const [name, program] of Object.entries(samples)) {
		test(label(`${name} re-parses for every slice`, [], ['other']), () => assertEverySliceReparses(shell, program));
		test(label(`${name} (CRLF) re-parses for every slice`, [], ['other']), () => assertEverySliceReparses(shell, program.replaceAll('\n', '\r\n')));
	}
}));
