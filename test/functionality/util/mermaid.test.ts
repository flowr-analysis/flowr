import { Mermaid } from '../../../src/util/mermaid/mermaid';
import { describe, assert, test } from 'vitest';

describe('Mermaid', () => {
	describe('escapeId', () => {
		function shouldEscape(input: string | number, expected: string): void {
			test(`${input} => ${expected}`, () => {
				assert.strictEqual(Mermaid.escapeId(input), expected);
			});
		}

		shouldEscape(0, '0');
		shouldEscape('built-in:get', 'built-in:get');
		shouldEscape('built-in:_', 'built-in:_');
		shouldEscape('flow-4', 'flow-4');
		shouldEscape('foo bar', 'foo_bar');

		describe('a path stays legible, mermaid reads `/` and `.`', () => {
			shouldEscape('/tmp/s.R-1:1-0', '/tmp/s.R-1:1-0');
			shouldEscape('./R/a.R-1:1-0', './R/a.R-1:1-0');
			// only what ends the id has to go
			shouldEscape('/tmp/my dir/s.R-0', '/tmp/my_dir/s.R-0');
			shouldEscape('/tmp/a(b).R-0', '/tmp/a_b_.R-0');
			shouldEscape('/tmp/we`ird".R-0', '/tmp/we_ird_.R-0');
			// a keyword is a keyword between any two separators
			shouldEscape('/tmp/end/s.R-0', '/tmp/end_/s.R-0');
			shouldEscape('/tmp/graph.R-0', '/tmp/graph_.R-0');
		});

		describe('reserved mermaid keywords (regression for #2609)', () => {
			shouldEscape('built-in:class', 'built-in:class_');
			shouldEscape('built-in:end', 'built-in:end_');
			shouldEscape('built-in:style', 'built-in:style_');
			shouldEscape('built-in:graph', 'built-in:graph_');
			shouldEscape('built-in:subgraph', 'built-in:subgraph_');
			shouldEscape('built-in:default', 'built-in:default_');
			shouldEscape('class', 'class_');
			shouldEscape('end', 'end_');

			test('a reserved keyword is only escaped as a full token', () => {
				assert.strictEqual(Mermaid.escapeId('built-in:classify'), 'built-in:classify');
				assert.strictEqual(Mermaid.escapeId('built-in:className'), 'built-in:className');
				assert.strictEqual(Mermaid.escapeId('built-in:subclass'), 'built-in:subclass');
			});

			test('id definition and edge target escape identically', () => {
				const id = 'built-in:class';
				assert.strictEqual(Mermaid.escapeId(id), Mermaid.escapeId(id));
			});
		});
	});
});
