import { describe, expect, test } from 'vitest';
import { retrieveNormalizedAst, withShell } from '../_helper/shell';
import { label } from '../_helper/label';
import { RProject } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';

/**
 * R's `parse(text=)` rejects a carriage return as an "invalid token" (unlike reading a file, which normalizes
 * line endings). Real-world Windows scripts therefore used to fail to parse as text requests. We normalize
 * CRLF/CR to LF at the r-bridge boundary; these tests make sure Windows/old-Mac line endings keep parsing
 * exactly like their LF equivalent.
 */
describe.sequential('Parsing is robust to line endings', withShell(shell => {
	const lexemes = (ast: NormalizedAst): string[] => {
		const out: string[] = [];
		RProject.visitAst(ast.ast, t => {
			if(t.lexeme !== undefined) {
				out.push(t.lexeme);
			}
			return false;
		});
		return out;
	};

	// covers assignments, calls, control flow, function definitions, strings and comments
	const program = 'x <- 1\ny <- x + 2\n# a comment\nif(y > 0) {\n  print("hi")\n}\nf <- function(a) a * 2\nz <- f(y)';

	test(label('CRLF parses identically to LF', [], ['other']), async() => {
		const lf = await retrieveNormalizedAst(shell, program);
		const crlf = await retrieveNormalizedAst(shell, program.replaceAll('\n', '\r\n'));
		expect(lexemes(crlf)).toEqual(lexemes(lf));
	});

	test(label('lone CR parses identically to LF', [], ['other']), async() => {
		const lf = await retrieveNormalizedAst(shell, program);
		const cr = await retrieveNormalizedAst(shell, program.replaceAll('\n', '\r'));
		expect(lexemes(cr)).toEqual(lexemes(lf));
	});
}));
