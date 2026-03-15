import { assert, describe, test } from 'vitest';
import { escapeNewline } from '../../../src/documentation/doc-util/doc-escape';

describe('Document Escape Tests', () => {
	test(() => {
		const input = 'Line 1\nLine 2\rLine 3\r\nLine 4';
		const expectedOutput = 'Line 1\\nLine 2\\rLine 3\\r\\nLine 4';
		const result = escapeNewline(input);
		assert.strictEqual(result, expectedOutput);
	});
});