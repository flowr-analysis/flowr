import fs from 'fs';
import path from 'path';

/* `ts-node scripts/extract-yield-snippets.ts <dir with .tex files> <out.json>` collects the `# :yields:` checks of minted R blocks */

/** a `# :yields: <R value>` comment, on the statement's line or on a comment line after it */
export interface YieldSnippetCheck {
	/** the 0-based line of the statement within `code` */
	readonly line:   number
	/** the R expression the statement yields */
	readonly yields: string
}

export interface YieldSnippet {
	readonly prefix:    string
	readonly libraries: readonly string[]
	readonly code:      readonly string[]
	readonly checks:    readonly YieldSnippetCheck[]
}

const Yields = /#\s*:yields:\s*(.*)$/;

/** The value of a `key={...}` or `key=...` option of a `minted` block, braces balanced. */
function option(options: string, key: string): string | undefined {
	const at = options.indexOf(`${key}=`);
	if(at < 0) {
		return undefined;
	}
	let i = at + key.length + 1;
	if(options[i] !== '{') {
		return /^[^,\]]*/.exec(options.slice(i))?.[0];
	}
	let depth = 0;
	const start = ++i;
	for(; i < options.length; i++) {
		if(options[i] === '{') {
			depth++;
		} else if(options[i] === '}') {
			if(depth-- === 0) {
				break;
			}
		}
	}
	return options.slice(start, i);
}

/** Every `minted` R block below `dir` that states what it yields, in the order of the files and their lines. */
export function extractYieldSnippets(dir: string): YieldSnippet[] {
	const snippets: YieldSnippet[] = [];
	for(const file of fs.readdirSync(dir).filter(f => f.endsWith('.tex')).sort()) {
		const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
		for(let i = 0; i < lines.length; i++) {
			const open = /\\begin\{minted\}(\[(.*)\])?\{R\}/.exec(lines[i]);
			if(open === null) {
				continue;
			}
			const options = open[2] ?? '';
			const code: string[] = [];
			while(++i < lines.length && !lines[i].includes('\\end{minted}')) {
				/* `!*...*!` escapes into LaTeX for markers drawn over the code, they are no part of it */
				code.push(lines[i].replace(/!\*.*?\*!/g, ''));
			}
			const checks: YieldSnippetCheck[] = [];
			for(const [at, text] of code.entries()) {
				const yields = Yields.exec(text)?.[1].trim();
				if(yields === undefined || yields === '') {
					continue;
				}
				let line = at;
				while(line >= 0 && code[line].trim().startsWith('#')) {
					line--;
				}
				if(line >= 0) {
					checks.push({ line, yields });
				}
			}
			if(checks.length > 0) {
				const libraries = option(options, 'mrlibrary');
				snippets.push({ prefix: option(options, 'mrprefix') ?? '', libraries: libraries ? libraries.split(',').map(l => l.trim()) : [], code, checks });
			}
		}
	}
	return snippets;
}

if(require.main === module) {
	const [dir, out] = process.argv.slice(2);
	const snippets = extractYieldSnippets(dir);
	fs.writeFileSync(out, JSON.stringify(snippets, null, '\t') + '\n');
	console.log(`${snippets.length} snippets, ${snippets.reduce((n, s) => n + s.checks.length, 0)} checks -> ${out}`);
}
