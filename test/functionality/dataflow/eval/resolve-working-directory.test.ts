import { describe, test, expect } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import type { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { VertexType } from '../../../../src/dataflow/graph/vertex';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { WorkingDirectory, type WorkingDirectoryResolution } from '../../../../src/dataflow/eval/resolve/resolve-working-directory';
import { label } from '../../_helper/label';

/** `mark()` stands for an arbitrary program point (any call would do) whose working directory we query */
const MARK = 'mark';

describe('resolveWorkingDirectoryAt', withTreeSitter((ts: TreeSitterExecutor) => {
	const norm = (r: WorkingDirectoryResolution) => ({ candidates: [...r.candidates].sort(), certain: r.certain });

	/** the resolution at every `mark()` point, in source order */
	async function wdMarks(code: string, baseWd = 'proj') {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(code);
		const dfg = (await analyzer.dataflow()).graph;
		const cfg = (await analyzer.controlflow()).graph;
		const changes = WorkingDirectory.collect(dfg, analyzer.inspectContext());
		const marks: { id: number, res: WorkingDirectoryResolution }[] = [];
		for(const [id, v] of dfg.verticesOfType(VertexType.FunctionCall)) {
			if(Identifier.getName(v.name) === MARK) {
				marks.push({ id: Number(id), res: WorkingDirectory.resolveAt(id, v.cds ?? [], baseWd, changes, cfg) });
			}
		}
		return marks.sort((a, b) => a.id - b.id).map(r => norm(r.res));
	}

	const wdMarksCase = (name: string, code: string, expected: WorkingDirectoryResolution[]) =>
		test(label(name, ['working-directory'], ['dataflow', 'resolve']), async() => expect(await wdMarks(code)).toEqual(expected.map(norm)));
	const wdCase = (name: string, code: string, expected: WorkingDirectoryResolution) => wdMarksCase(name, code, [expected]);

	wdCase('no setwd', 'mark()', { candidates: ['proj'], certain: true });
	wdCase('relative compound', 'setwd("a")\nsetwd("../b")\nmark()', { candidates: ['proj/b'], certain: true });
	wdCase('absolute resets', 'setwd("data")\nsetwd("/abs")\nmark()', { candidates: ['/abs'], certain: true });
	wdCase('setwd after point', 'mark()\nsetwd("later")', { candidates: ['proj'], certain: true });
	wdCase('unresolvable arg', 'setwd(some_var)\nmark()', { candidates: [], certain: false });
	wdCase('branch-only', 'if(cond) setwd("branch")\nmark()', { candidates: ['proj', 'proj/branch'], certain: false });
	wdCase('in-branch point', 'if(cond) { setwd("s")\nmark() }', { candidates: ['proj/s'], certain: true });
	wdCase('if/else branches', 'if(cond) setwd("a") else setwd("b")\nmark()', { candidates: ['proj/a', 'proj/b'], certain: false });
	wdCase('relative in loop', 'for(i in 1:n) setwd("sub")\nmark()', { candidates: [], certain: false });
	wdCase('absolute in loop', 'for(i in 1:n) setwd("/abs")\nmark()', { candidates: ['/abs', 'proj'], certain: false });
	wdCase('called function propagates', 'f <- function() setwd("inside")\nf()\nmark()', { candidates: ['proj/inside'], certain: true });
	wdCase('uncalled function', 'f <- function() setwd("inside")\nmark()', { candidates: ['proj'], certain: true });

	wdMarksCase('multiple points', 'setwd("data")\nmark()\nsetwd("sub")\nmark()\nsetwd("/abs")\nmark()', [
		{ candidates: ['proj/data'], certain: true },
		{ candidates: ['proj/data/sub'], certain: true },
		{ candidates: ['/abs'], certain: true }
	]);
	wdMarksCase('around a branch', 'setwd("base")\nmark()\nif(cond) { setwd("in")\nmark() }\nmark()', [
		{ candidates: ['proj/base'], certain: true },
		{ candidates: ['proj/base/in'], certain: true },
		{ candidates: ['proj/base', 'proj/base/in'], certain: false }
	]);
	wdMarksCase('around a loop', 'mark()\nfor(i in 1:n) setwd("s")\nmark()', [
		{ candidates: ['proj'], certain: true },
		{ candidates: [], certain: false }
	]);
}));
