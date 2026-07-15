import { afterAll, describe, expect, test } from 'vitest';
import { RShell } from '../../../src/r-bridge/shell';
import { retrieveNormalizedAstFromRCode } from '../../../src/r-bridge/retriever';
import { RProject } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';
import { label } from '../_helper/label';

/**
 * Under a non-UTF-8 host locale, R's `getParseData` (`encodeString`) escapes non-ASCII as octal `\303\264`,
 * which is invalid JSON and used to crash parsing of real-world (accented, smart-quoted) R sources - the
 * benchmark's `failed to reconstruct/re-parse` spike. flowR now forces a UTF-8 `LC_CTYPE` in its R session,
 * so this must keep working even when the surrounding process runs in `C`.
 */
describe.sequential('Parsing is robust to a non-UTF-8 host locale', () => {
	// force the R child process into a POSIX/C locale, independent of the host running the tests
	const shell = new RShell(undefined, { env: { ...process.env, LC_ALL: 'C', LC_CTYPE: 'C', LANG: 'C' } });
	afterAll(() => shell.close());

	test(label('non-ASCII R parses under an LC_ALL=C locale', [], ['other']), async() => {
		const code = 'x <- "Côte d\'Ivoire"\ny <- "smart ’quote’"\nz <- x';
		const ast = await retrieveNormalizedAstFromRCode({ request: 'text', content: code }, shell);
		const lexemes: string[] = [];
		RProject.visitAst(ast.ast, t => {
			if(t.lexeme !== undefined) {
				lexemes.push(t.lexeme);
			}
			return false;
		});
		// the accented and smart-quoted string content must survive intact (not be mangled or dropped)
		const joined = lexemes.join(' ');
		expect(joined).toContain('Côte d\'Ivoire');
		expect(joined).toContain('’quote’');
	});
});
