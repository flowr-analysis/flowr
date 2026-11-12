/**
 * Regenerates `src/data/r-group-method-guards.generated.ts`: what the S3 methods the base packages define for the members of
 * R's group generics ask of their arguments, one entry per member and class vector of a value R makes, as the
 * `inspect-fn-guards` query works it out for the R running this script with `.Generic` replaced by the member,
 * leaving out the methods that ask nothing. The analysis of the methods reads the table already there, so start from an empty one to reproduce it.
 *   ts-node --transpile-only scripts/gen-group-method-guards.ts
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../src/r-bridge/retriever';
import { RBinaryOp } from '../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { NodeId } from '../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { GuardTerm } from '../src/dataflow/fn/guards/guard-term';
import type { GroupMethodGuard } from '../src/dataflow/fn/guards/group-method-guards';
import { writePacked } from './pack-generated';

const Target = path.join('src', 'data', 'r-group-method-guards.generated.ts');

interface Extracted {
	readonly member:  string
	readonly classes: readonly string[]
	readonly method:  string
	readonly formals: readonly string[]
	readonly code:    string
}

/** What the method, defined on its own as `base` defines `stop` itself, asks, `TRUE` if nothing. */
async function requiresOf(code: string): Promise<GuardTerm> {
	const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
	analyzer.addRequest(requestFromInput(`method <- ${code}\n`));
	const { idMap } = await analyzer.normalize();
	const { guards } = (await analyzer.query([{ type: 'inspect-fn-guards' }]))['inspect-fn-guards'];
	for(const [id, guard] of Object.entries(guards)) {
		const parentId = idMap.get(NodeId.normalize(id))?.info.parent;
		const parent = parentId === undefined ? undefined : idMap.get(parentId);
		if(parent !== undefined && RBinaryOp.is(parent) && parent.lhs.lexeme === 'method') {
			return GuardTerm.all(...guard.clauses.map(c => c.requires));
		}
	}
	return GuardTerm.True;
}

async function main(): Promise<void> {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-methods-'));
	const file = path.join(dir, 'methods.json');
	execFileSync('Rscript', [path.join('scripts', 'gen-group-method-guards.R'), file], { stdio: 'inherit' });
	const extracted = JSON.parse(fs.readFileSync(file, 'utf8')) as Extracted[];
	const version = execFileSync('Rscript', ['-e', 'cat(as.character(getRversion()))']).toString().trim();
	const known = new Map<string, GuardTerm>();
	const table: Record<string, GroupMethodGuard[]> = {};
	for(const { member, classes, method, formals, code } of extracted) {
		const requires = known.get(code) ?? await requiresOf(code);
		known.set(code, requires);
		/* a method asking nothing lets anything through, as a class not listed does */
		if(!GuardTerm.isTrue(requires)) {
			(table[member] ??= []).push({ classes, method, formals, requires });
		}
	}
	writePacked(Target, `scripts/gen-group-method-guards.ts from R ${version}`, ["import type { GroupMethodGuard } from '../dataflow/fn/guards/group-method-guards';"], [
		{ name: 'RGroupMethodGuards', doc: 'What the methods of the base packages for the members of the group generics ask, as `member -> entries`, see {@link GroupMethodGuard}.', type: 'Readonly<Record<string, readonly GroupMethodGuard[]>>', value: table }
	]);
	console.log(`wrote ${Object.keys(table).length} members, ${extracted.length} entries, ${known.size} methods`);
	process.exit(0);
}

void main();
