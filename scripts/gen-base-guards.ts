/**
 * Regenerates `src/data/r-base-guards.generated.ts`: what the closures of the base packages ask of their
 * arguments, as the `inspect-fn-guards` query works it out for the R running this script.
 * The closures of a package are analyzed together, so its internal helpers count, except for `base`, which
 * defines `stop` and `stopifnot` itself and so has each of its closures analyzed on its own.
 *   ts-node --transpile-only scripts/gen-base-guards.ts [--json <path>]
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../src/r-bridge/retriever';
import { RBinaryOp } from '../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { NodeId } from '../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { FunctionSemantics } from '../src/dataflow/fn/function-semantics';
import { reasonsOf, type StatedGuards } from '../src/dataflow/fn/guards/built-in-guards';

const Target = path.join('src', 'data', 'r-base-guards.generated.ts');

interface Closure {
	readonly name:     string
	readonly exported: boolean
	readonly code:     string
}

const quoted = (name: string): string => '`' + name + '`';
const definition = ({ name, code }: Closure): string => `${quoted(name)} <- ${code}\n`;

function readClosures(file: string): Closure[] {
	return fs.readFileSync(file, 'utf8').split('\n').filter(l => l !== '').map(line => {
		const [name, exported, code] = line.split('\t');
		return { name, exported: exported === 'TRUE', code: code.replace(/\\(.)/g, (_, c: string) => c === 'n' ? '\n' : c) };
	});
}

/** Adds what the program states of the given names to `into`, leaving out those with nothing to state. */
async function guardsIn(code: string, names: ReadonlySet<string>, into: Record<string, StatedGuards>): Promise<void> {
	const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
	analyzer.addRequest(requestFromInput(code));
	const { idMap } = await analyzer.normalize();
	const { guards } = (await analyzer.query([{ type: 'inspect-fn-guards' }]))['inspect-fn-guards'];
	for(const [id, guard] of Object.entries(guards)) {
		const parentId = idMap.get(NodeId.normalize(id))?.info.parent;
		const parent = parentId === undefined ? undefined : idMap.get(parentId);
		const name = parent !== undefined && RBinaryOp.is(parent) ? parent.lhs.lexeme?.replaceAll('`', '') : undefined;
		/* what R's internals are asked for says nothing to a reader, who cannot write it */
		const clauses = guard.clauses.filter(c => !c.rendered.includes('.Internal('));
		const formals = Object.keys(guard.formals).length > 0 ? { formals: guard.formals } : {};
		/* a formal being required alone is what the signature already says of those without a default */
		if(name !== undefined && names.has(name) && (clauses.length > 0 || formals.formals !== undefined)) {
			into[name] = {
				requires: FunctionSemantics.guardSummary(clauses).requires,
				...(guard.required.length > 0 ? { required: guard.required } : {}),
				...formals,
				...(clauses.length > 0 ? { because: reasonsOf(clauses, idMap) } : {})
			};
		}
	}
}

async function guardsOfPackage(pkg: string, closures: readonly Closure[]): Promise<Record<string, StatedGuards>> {
	const guards: Record<string, StatedGuards> = {};
	const exported = closures.filter(c => c.exported);
	if(pkg === 'base') {
		const known = new Set(closures.map(c => c.name));
		for(const closure of exported) {
			/* with a default method around, dispatching cannot fail for lack of a method */
			const fallback = known.has(`${closure.name}.default`) ? `${quoted(`${closure.name}.default`)} <- function(...) NULL\n` : '';
			await guardsIn(definition(closure) + fallback, new Set([closure.name]), guards);
		}
	} else {
		await guardsIn(closures.map(definition).join('\n'), new Set(exported.map(c => c.name)), guards);
	}
	return guards;
}

async function main(): Promise<void> {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-base-guards-'));
	execFileSync('Rscript', [path.join('scripts', 'gen-base-guards.R'), dir], { stdio: 'inherit' });
	const version = fs.readFileSync(path.join(dir, 'R-version'), 'utf8').trim();
	const all: Record<string, Record<string, StatedGuards>> = {};
	for(const file of fs.readdirSync(dir).filter(f => f.endsWith('.closures.tsv')).sort()) {
		const pkg = file.slice(0, -'.closures.tsv'.length);
		all[pkg] = await guardsOfPackage(pkg, readClosures(path.join(dir, file)));
		console.log(`  ${pkg}: ${Object.keys(all[pkg]).length} functions`);
	}
	fs.rmSync(dir, { recursive: true });
	const json = process.argv.indexOf('--json');
	if(json >= 0) {
		fs.writeFileSync(process.argv[json + 1], JSON.stringify(all));
	}
	/* one line per function, so what changes between versions of R stays readable and small */
	const rows = Object.entries(all).map(([pkg, guards]) => `\t${JSON.stringify(pkg)}: {\n${Object.entries(guards).map(([name, guard]) => `\t\t${JSON.stringify(name)}: ${JSON.stringify(guard)}`).join(',\n')}\n\t}`);
	fs.writeFileSync(Target, `import type { BaseGuards } from '../dataflow/fn/guards/built-in-guards';
/* GENERATED by scripts/gen-base-guards.ts from R ${version}, do not edit. */
/** What the closures of the base packages ask of their arguments, as \`package -> name -> guards\`. */
export const RBaseGuards: BaseGuards = {
${rows.join(',\n')}
};

/** The R version {@link RBaseGuards} was read off. */
export const RBaseGuardsVersion = ${JSON.stringify(version)};
`);
	console.log(`wrote ${Target}`);
	process.exit(0);
}

void main();
