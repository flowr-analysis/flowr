import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { extractCfg } from '../../../src/control-flow/control-flow-graph';
import { happensBefore, someAlwaysBefore } from '../../../src/control-flow/happens-before';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { Ternary } from '../../../src/util/logic';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

const programs = [
	'x <- 1\ny <- x\nprint(x)',
	'x <- 4\nrepeat { print(x) }',
	'x <- 4\nwhile(x < 1)\nx <- 5',
	'x<-1\nif(u) x <- 2\nx <- 3',
	'x<-1\nif(u) x <- 2 else x <- 3\nx <- 4',
	'f <- function(a) { if(a) print(a) else a; for(i in 1:3) { if(i > 1) next; print(a) }; a }\nf(1)\nf(2)',
	'x <- 1\nrepeat { if(x > 3) break; x <- x + 1; while(x < 2) { print(x); if(u) next } }\nprint(x)'
];

describe('someAlwaysBefore', withTreeSitter(parser => {
	for(const code of programs) {
		test(`agrees with happensBefore on ${JSON.stringify(code.slice(0, 40))}`, async() => {
			const result = await createDataflowPipeline(parser, { context: contextFromInput(code) }).allRemainingSteps();
			const cfg = extractCfg(result.dataflow).graph;
			const ids = [...cfg.vertices().keys()] as NodeId[];
			/* a spread of candidate sets, built the same on every run */
			const sets: ReadonlySet<NodeId>[] = [new Set(ids)];
			for(let stride = 2; stride < 6; stride++) {
				for(let offset = 0; offset < stride; offset++) {
					sets.push(new Set(ids.filter((_, i) => i % stride === offset)));
				}
			}
			for(const candidates of sets) {
				for(const b of ids) {
					const expected = [...candidates].some(a => a !== b && happensBefore(cfg, a, b) === Ternary.Always);
					assert.strictEqual(someAlwaysBefore(cfg, candidates, b), expected, `candidates ${[...candidates].join(',')} before ${b}`);
				}
			}
		});
	}
}));
