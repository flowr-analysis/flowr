import { assert, describe, it } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { tryResolveSliceCriterionToId } from '../../../../src/slicing/criterion/parse';
import { graphToMermaidUrl } from '../../../../src/util/mermaid/dfg';
import { getAllLinkedFunctionDefinitions } from '../../../../src/dataflow/internal/linker';
import { builtInId } from '../../../../src/dataflow/environments/built-in';
import { label } from '../../_helper/label';

describe('Linked Function Definitions', withTreeSitter(ts => {
	function expectLinkedFns(lab: string, code: string, expect: Record<string, { fns?: string[], bi?: string[] }>) {
		it(label(lab, [], ['dataflow']), async() => {
			const a = await new FlowrAnalyzerBuilder().setParser(ts).build();
			a.addRequest(requestFromInput(code));
			const df = await a.dataflow();
			const idMap = (await a.normalize()).idMap;
			try {
				for(const [call, { fns, bi }] of Object.entries(expect)) {
					const callId = tryResolveSliceCriterionToId(call, idMap) ?? call;
					const [lfns, lbi] = getAllLinkedFunctionDefinitions(new Set([callId]), df.graph);

					assert.deepStrictEqual(Array.from(lbi).sort(), (bi ?? []).sort(), `linked bi for call ${call}`);
					// decode linked function names
					const expected = (fns ?? []).map(n => tryResolveSliceCriterionToId(n, idMap) ?? n).sort();
					assert.deepStrictEqual(Array.from(lfns, l => l.id).sort(), expected, `linked fns for call ${call}`);
				}
			} catch(e) {
				console.log(e);
				console.log('Code:\n' + code);
				console.log(graphToMermaidUrl(df.graph));
				throw e;
			}
		});
	}

	expectLinkedFns('one definition', 'x <- function(a) { a + 1 }', {
		'1@x': { fns: ['1@function'] }
	});
	expectLinkedFns('alias bi', 'x <- c', {
		'1@x': { bi: [builtInId('c')] }
	});
	expectLinkedFns('alias bi with sconst', 'if(u) c <- 3\nx <- c', {
		'2@x': { bi: [builtInId('c')] }
	});
	expectLinkedFns('one definition ho', 'x <- function(a) { a + 1 }\ny <- function() { x } \nh <- y()', {
		'3@h': { fns: ['1@function'] }
	});
	expectLinkedFns('hidden with get', 'x <- function(a) { a + 1 }\ny <- function() { get("x") } \nh <- y()', {
		'3@h': { fns: ['1@function'] }
	});
	expectLinkedFns('hidden with side-effect', 'y <- function() {\nx <<- function(a) { a + 1 } }\ny()\nh <- x', {
		'4@h': { fns: ['2@function'] }
	});
	expectLinkedFns('unreturned fn', 'y <- function() {\nfunction(); 2 }\nh <- y()', {
		'4@h': { fns: [] }
	});
	expectLinkedFns('multiple defs', 'x <- function(a) { a + 1 }\nk <- function() function() 2\ny <- function() { if(u) { x } else { k() } } \nh <- y()', {
		'4@h': { fns: ['1@function', '2@function'] }
	});
}));