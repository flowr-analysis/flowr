import { describe, test, expect } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { collectScopeDefinedNames } from '../../../src/linter/rules/undefined-symbol-util';

describe('undefined-symbol-util', withTreeSitter(parser => {
	// the scope fallback must record unconditional bindings and skip conditional ones (bound only in a branch)
	test('collectScopeDefinedNames records unconditional bindings only', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(requestFromInput('f <- function(p) {\n  a <- 1\n  if (p) { b <- 2 }\n  for (i in 1:2) { c <- 3 }\n}'));
		const defined = collectScopeDefinedNames((await analyzer.dataflow()).graph);
		const all = new Set<string>();
		for(const names of defined.values()) {
			for(const n of names) {
				all.add(n);
			}
		}
		expect(all.has('f')).toBe(true);   // top-level binding
		expect(all.has('a')).toBe(true);   // unconditional in f
		expect(all.has('p')).toBe(true);   // parameter
		expect(all.has('b')).toBe(false);  // bound only inside `if`
		expect(all.has('c')).toBe(false);  // bound only inside `for`
	});
}));
