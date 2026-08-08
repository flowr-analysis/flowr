import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { instrumentDataflowCount } from '../../../../src/dataflow/instrument/instrument-dataflow-count';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import { requestFromInput } from '../../../../src/r-bridge/retriever';

describe('DF Instrumentation', withTreeSitter(ts => {
	function chk(code: string, expectedCounts: Partial<Record<RType, number>>): void {
		test(code, async() => {
			const map = new Map<RType, number>();
			const analyzer = await new FlowrAnalyzerBuilder()
				.setParser(ts)
				.configure('solver.instrument.dataflowExtractors', instrumentDataflowCount(map, () => map.clear()))
				.build();
			analyzer.addRequest(requestFromInput(code));
			await analyzer.dataflow();
			for(const [key, value] of Object.entries(expectedCounts)) {
				assert.strictEqual(map.get(key as RType), value, `Expected count for type ${key} to be ${value}, but got ${map.get(key as RType) ?? 0}`);
			}
		});
	}
	chk('x <- 1', { [RType.Number]: 1 });
}));