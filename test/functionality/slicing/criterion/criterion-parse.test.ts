import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import type { AstIdMap, RNodeWithParent } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';

/** the node a criterion resolves to, which tells far more about the pick than a bare id */
function nodeOf(criterion: SlicingCriterion, idMap: AstIdMap): RNodeWithParent | undefined {
	const id = SlicingCriterion.tryParse(criterion, idMap);
	return id === undefined ? undefined : idMap.get(id);
}

async function idMapOf(ts: TreeSitterExecutor, code: string): Promise<AstIdMap> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
	analyzer.addRequest(requestFromInput(code));
	return (await analyzer.normalize()).idMap;
}

describe('Slicing criteria', withTreeSitter(ts => {
	describe('line@name', () => {
		test('prefers the call over the symbol naming it, which share a position', async() => {
			const idMap = await idMapOf(ts, 'h <- function() 1\nh <- h()');
			const call = nodeOf('2@[2]h', idMap);
			expect(call?.type).toBe(RType.FunctionCall);
			expect(call?.location?.[1]).toBe(6);
		});

		test('the bare form is exactly [1]', async() => {
			const idMap = await idMapOf(ts, 'h <- function() 1\nh <- h()');
			expect(nodeOf('2@h', idMap)?.info.id).toBe(nodeOf('2@[1]h', idMap)?.info.id);
			// i.e. the leftmost occurrence, here the assignment target in column 1
			expect(nodeOf('2@h', idMap)?.location?.[1]).toBe(1);
		});

		test('an [n] prefix picks the n-th occurrence in the line, [1] being the first', async() => {
			const idMap = await idMapOf(ts, 'a <- 1\nb <- a + a + a');
			const columnOf = (criterion: SlicingCriterion) => nodeOf(criterion, idMap)?.location?.[1];
			const columns = [columnOf('2@[1]a'), columnOf('2@[2]a'), columnOf('2@[3]a')];
			expect(columns.every(c => c !== undefined)).toBe(true);
			expect(new Set(columns).size).toBe(3);
			expect(columns).toStrictEqual([...columns].sort((x = 0, y = 0) => x - y));
			// [-1] is the last one, and going past either end resolves to nothing rather than to a wrong node
			expect(columnOf('2@[-1]a')).toBe(columns[2]);
			expect(SlicingCriterion.tryParse('2@[4]a', idMap)).toBeUndefined();
			expect(SlicingCriterion.tryParse('2@[0]a', idMap)).toBeUndefined();
		});

		test('0 addresses nothing, as lines, columns and occurrences are 1-based', async() => {
			const idMap = await idMapOf(ts, 'x <- 1\ny <- f(x)');
			for(const criterion of ['0@y', '0:1', '0~1', '2:0', '2~0', '2@[0]y'] as const) {
				expect(SlicingCriterion.tryParse(criterion, idMap), criterion).toBeUndefined();
			}
		});

		test('a negative line counts from the end of the input', async() => {
			const idMap = await idMapOf(ts, 'x <- 1\ny <- 2\nzzz <- 3');
			expect(nodeOf('-1@zzz', idMap)?.lexeme).toBe('zzz');
			expect(nodeOf('-3@x', idMap)?.lexeme).toBe('x');
		});
	});

	describe('line:column vs line~column', () => {
		//           columns: 123456789
		const code = 'x <- 1\ny <- f(x)';

		test('line:column wants an element starting exactly there', async() => {
			const idMap = await idMapOf(ts, code);
			expect(nodeOf('2:6', idMap)?.type).toBe(RType.FunctionCall);
			// the `(` in column 7 starts no element of its own, so the strict form finds nothing
			expect(SlicingCriterion.tryParse('2:7', idMap)).toBeUndefined();
		});

		test('line~column takes the innermost element containing the position', async() => {
			const idMap = await idMapOf(ts, code);
			// column 7 is the `(`: contained by the call, started by nothing (unlike 2:7 above)
			expect(nodeOf('2~7', idMap)?.type).toBe(RType.FunctionCall);
			// column 8 is the argument `x`, the innermost node containing it
			expect(nodeOf('2~8', idMap)?.lexeme).toBe('x');
			// `y` is more precise than the whole `y <- f(x)` containing column 1 as well
			expect(nodeOf('2~1', idMap)?.lexeme).toBe('y');
		});
	});

	describe('robustness', () => {
		test.each([
			{ criterion: 'x@y', why: 'a non-numeric line' },
			{ criterion: '@x', why: 'a missing line' },
			{ criterion: '2@', why: 'a missing name' },
			{ criterion: 'a~b', why: 'a non-numeric fuzzy position' },
			{ criterion: 'a:b', why: 'a non-numeric position' },
			{ criterion: '2:x', why: 'a non-numeric column' },
			{ criterion: '1:2:3', why: 'too many position parts' },
			{ criterion: 'nonsense', why: 'no criterion syntax at all' },
			{ criterion: '2@x([)', why: 'a malformed file regex' },
		])('$why ($criterion) resolves to nothing instead of throwing', async({ criterion }) => {
			const idMap = await idMapOf(ts, 'x <- 1\ny <- x');
			expect(() => SlicingCriterion.tryParse(criterion, idMap)).not.toThrow();
			expect(SlicingCriterion.tryParse(criterion, idMap)).toBeUndefined();
		});

		test('a name containing the other separators is not mistaken for them', async() => {
			// `@` is checked before `:` and `~`, so the name may contain both of them
			const idMap = await idMapOf(ts, 'x <- 1\n`a~b` <- 2\n`c:d` <- 3');
			expect(nodeOf('2@`a~b`', idMap)?.lexeme).toBe('`a~b`');
			expect(nodeOf('3@`c:d`', idMap)?.lexeme).toBe('`c:d`');
		});
	});

	describe('(file-regex) suffix', () => {
		const requests = [
			{ request: 'file', content: 'test/testfiles/parse-multiple/a.R' },
			{ request: 'file', content: 'test/testfiles/parse-multiple/b.R' }
		] as const;

		async function multiFileIdMap(): Promise<AstIdMap> {
			const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
			analyzer.addRequest(requests);
			return (await analyzer.normalize()).idMap;
		}

		test('restricts a criterion to the matching file', async() => {
			const idMap = await multiFileIdMap();
			// both files have a line 1 column 1, so only the file filter can tell the two apart
			const inA = nodeOf('1:1(a\\.R$)', idMap);
			const inB = nodeOf('1:1(b\\.R$)', idMap);
			expect(inA?.info.file).toMatch(/a\.R$/);
			expect(inB?.info.file).toMatch(/b\.R$/);
			expect(inA?.info.id).not.toBe(inB?.info.id);
		});

		test('a file that matches nothing resolves to nothing', async() => {
			expect(SlicingCriterion.tryParse('1:1(no-such-file)', await multiFileIdMap())).toBeUndefined();
		});
	});
}));
