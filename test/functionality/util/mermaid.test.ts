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
