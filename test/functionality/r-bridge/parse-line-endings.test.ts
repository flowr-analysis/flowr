import { describe, expect, test } from 'vitest';
import { retrieveNormalizedAst, withShell, withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { RProject } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';

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

/* escaped so this file stays plain ASCII while the program under test is not */
const Staerke = 'st\u00e4rke';
const NonAsciiString = '"caf\u00e9 \u4e2d\u6587"';
const NonAscii = `${Staerke} <- ${NonAsciiString} # \u00fcber\nprint(${Staerke})`;
const EscapedName = '`\u03b1 \u03b2`';
const Bom = '\ufeff';

/**
 * R's `parse(text=)` rejects a carriage return as an "invalid token" (unlike reading a file, which normalizes
 * line endings). Real-world Windows scripts therefore used to fail to parse as text requests. We normalize
 * CRLF/CR to LF at the r-bridge boundary; these tests make sure Windows/old-Mac line endings keep parsing
 * exactly like their LF equivalent.
 */
describe('Parsing is robust to line endings', { concurrent: false }, withShell(shell => {
	test(label('CRLF parses identically to LF', ['line-endings', 'newlines'], ['parse']), async() => {
		const lf = await retrieveNormalizedAst(shell, program);
		const crlf = await retrieveNormalizedAst(shell, program.replaceAll('\n', '\r\n'));
		expect(lexemes(crlf)).toEqual(lexemes(lf));
	});

	test(label('lone CR parses identically to LF', ['line-endings', 'newlines'], ['parse']), async() => {
		const lf = await retrieveNormalizedAst(shell, program);
		const cr = await retrieveNormalizedAst(shell, program.replaceAll('\n', '\r'));
		expect(lexemes(cr)).toEqual(lexemes(lf));
	});

	test(label('non-ASCII names, strings, and comments survive', ['source-encoding'], ['parse']), async() => {
		const ast = await retrieveNormalizedAst(shell, NonAscii);
		expect(lexemes(ast)).toContain(Staerke);
		expect(lexemes(ast)).toContain(NonAsciiString);
	});

	test(label('non-ASCII escaped names survive', ['source-encoding', 'name-escaped'], ['parse']), async() => {
		const ast = await retrieveNormalizedAst(shell, `${EscapedName} <- 2\n${EscapedName} + 1`);
		expect(lexemes(ast)).toContain(EscapedName);
	});
}));

// tree-sitter skips a leading BOM; r-shell does not, so BOM support is only partial
describe('Parsing is robust to a byte-order mark', withTreeSitter(parser => {
	test(label('a leading BOM does not change the program', ['byte-order-mark'], ['parse']), async() => {
		const plain = await retrieveNormalizedAst(parser, 'x <- 1\ny <- x');
		const withBom = await retrieveNormalizedAst(parser, `${Bom}x <- 1\ny <- x`);
		expect(lexemes(withBom)).toEqual(lexemes(plain));
	});

	test(label('non-ASCII parses with the tree-sitter engine too', ['source-encoding'], ['parse']), async() => {
		const ast = await retrieveNormalizedAst(parser, NonAscii);
		expect(lexemes(ast)).toContain(Staerke);
	});

	test(label('CRLF parses identically to LF with the tree-sitter engine', ['line-endings'], ['parse']), async() => {
		const lf = await retrieveNormalizedAst(parser, program);
		const crlf = await retrieveNormalizedAst(parser, program.replaceAll('\n', '\r\n'));
		expect(lexemes(crlf)).toEqual(lexemes(lf));
	});
}));
