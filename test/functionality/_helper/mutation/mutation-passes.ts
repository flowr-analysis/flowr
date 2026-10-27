import semver from 'semver/preload';
import type { ParentInformation, RNodeWithParent } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { RLoopConstructs, type RNode } from '../../../../src/r-bridge/lang-4.x/ast/model/model';
import { uniqueArray } from '../../../../src/util/collections/arrays';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import { RBinaryOp } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RFunctionCall, type RNamedFunctionCall } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RExpressionList } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RFunctionDefinition } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RIfThenElse } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RForLoop } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import { RWhileLoop } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RSymbol } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNumber } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RPipe } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { RAccess } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RArgument } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RParameter } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { RString } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-string';
import { MIN_VERSION_LAMBDA } from '../../../../src/r-bridge/lang-4.x/ast/model/versions';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { AttachedBasePackageSet, baseRExportOwner } from '../../../../src/util/r-base-packages';
import type { SourceRange } from '../../../../src/util/range';
import { MutationProgram, Rewrite, type MutationTarget, type SimpleAssignment } from './mutation-program';

/** what a pass changes about a program, which is how the wiki groups them */
export enum MutationCategory {
	Noise = 'formatting and noise',
	Assignment = 'assignment spelling',
	Naming = 'naming',
	Literal = 'literals and layout',
	ControlFlow = 'control flow',
	DeadCode = 'dead code',
	Structure = 'structure and braces',
	Function = 'function forms',
	Value = 'changed value'
}

/** one rewrite, applied to every counterexample it fits */
export interface MutationPass {
	/** what the mutants of this pass are named after */
	readonly name:         string;
	readonly category:     MutationCategory;
	/** what the pass does, with an example, as the wiki lists it */
	readonly description:  string;
	/** the R version the rewrite needs, so a host below it explains an idle pass without a name list */
	readonly minRVersion?: string;
	/** the rewrite only moves code around or renames it, so the graphs flowR builds keep their shape */
	readonly keepsGraph?:  boolean;
	/** the rewrite adds code of its own, about which the linter may say more, but never less */
	readonly adds?:        boolean;
	/** the mutated program, or `undefined` if the pass does not apply */
	apply(program: MutationProgram): Promise<MutationTarget | undefined> | MutationTarget | undefined;
}

type PassSpec = Omit<MutationPass, 'apply'>;

/** edits the program through `edit`, see {@link Rewrite} */
type Rewriter = (program: MutationProgram, edit: Rewrite) => unknown;

/** a pass that edits the program in place, optionally only one whose lines are whole statements (see {@link MutationProgram#lineByLine}) */
class RewritePass implements MutationPass {
	readonly name!:        string;
	readonly category!:    MutationCategory;
	readonly description!: string;
	readonly minRVersion?: string;
	readonly keepsGraph?:  boolean;
	readonly adds?:        boolean;

	constructor(spec: PassSpec, private readonly rewrite: Rewriter, private readonly lineByLine = true) {
		Object.assign(this, spec);
	}

	async apply(program: MutationProgram): Promise<MutationTarget | undefined> {
		if(this.lineByLine && !program.lineByLine) {
			return undefined;
		}
		const edit = new Rewrite(program);
		await this.rewrite(program, edit);
		return edit.result();
	}
}

/** a pass rewriting the {@link MutationProgram#assignments|simple assignments} it accepts, each as a whole */
class AssignmentPass extends RewritePass {
	constructor(spec: PassSpec, rewrite: (assignment: SimpleAssignment, rhs: string, program: MutationProgram) => string | undefined) {
		super(spec, (program, edit) => {
			for(const assignment of program.assignments) {
				const rewritten = rewrite(assignment, program.text(assignment.value), program);
				if(rewritten !== undefined) {
					edit.replace(assignment.node, rewritten);
				}
			}
		});
	}
}

/** a pass replacing the first string literal that fits by an expression of the same value */
class LiteralPass extends RewritePass {
	constructor(spec: PassSpec, by: (literal: RString<ParentInformation>, edit: Rewrite) => string, fits: (value: string) => boolean = () => true) {
		super(spec, (program, edit) => {
			const literal = program.plainStrings.find(s => fits(s.content.str) && !program.takenAsWritten(s));
			if(literal !== undefined) {
				edit.replace(literal, by(literal, edit));
			}
		}, false);
	}
}

/** a pass rewriting the constructs of a kind written as a statement of their own or as the value of an assignment */
class ConstructPass<T extends RNodeWithParent> extends RewritePass {
	constructor(spec: PassSpec, is: (node: RNode<ParentInformation>) => node is T, rewrite: (construct: T, program: MutationProgram) => string | undefined, assigned = true) {
		super(spec, (program, edit) => {
			for(const construct of constructsOf(program, assigned).filter(is)) {
				const rewritten = rewrite(construct, program);
				if(rewritten !== undefined) {
					edit.replace(construct, rewritten);
				}
			}
		});
	}
}

/** a pass that renames variables, each binding and every reference to it alike */
class RenamingPass extends RewritePass {
	constructor(spec: PassSpec, onlyCriterion: boolean, fresh: (index: number) => string) {
		super(spec, async(program, edit) => {
			const at = program.criterion;
			const names = onlyCriterion
				? at !== undefined && program.assignments.some(a => a.name === at.name) && !program.spellsOut(at.name) ? [at.name] : []
				: program.readsNamesAsData ? [] : renameableNames(program);
			const renames: Record<string, string> = {};
			for(const name of names) {
				const places = await program.occurrencesOf(name);
				/* the search and the AST have to agree on every occurrence, or one of them sees something the other does not */
				if(places.length === 0 || (!onlyCriterion && !sameRanges(places, symbolsNamed(program, name)))) {
					continue;
				}
				const to = fresh(Object.keys(renames).length + 1);
				renames[to] = name;
				places.forEach(p => edit.replace(p, to));
			}
			edit.change({ renames }).renameCriterion(Object.entries(renames).find(([, from]) => from === at?.name)?.[0]);
		}, false);
	}
}

/** a pass rewriting each line that holds one statement, see {@link MutationProgram#lineByLine} */
class StatementPass extends RewritePass {
	constructor(spec: PassSpec, rewrite: (statement: RNodeWithParent, program: MutationProgram, edit: Rewrite) => void) {
		super(spec, (program, edit) => {
			for(const statement of program.statements) {
				if(program.statementsOn(program.span(statement)[0]).length === 1) {
					rewrite(statement, program, edit);
				}
			}
		});
	}
}

const isDefinition = (n: RNode<ParentInformation>): n is RFunctionDefinition<ParentInformation> => RFunctionDefinition.is(n);
const isArgument = (n: RNode<ParentInformation> | undefined): n is RArgument<ParentInformation> => RArgument.is(n);

/** the prefix every name a pass makes up starts with, so no program already uses it */
const MutationPrefix = 'mut_';

const PipeVersion = RPipe.availableFromRVersion().toString();

/** whether the host R runs what the pass makes, which a pass applies regardless, as only running it needs the version */
export function passIsAvailable(pass: MutationPass): boolean {
	return pass.minRVersion === undefined || (!!globalThis.rVersion && semver.satisfies(globalThis.rVersion, `>=${pass.minRVersion}`));
}

/** the statements of the program, and the values of its top-level assignments where `assigned` */
function constructsOf(program: MutationProgram, assigned: boolean): RNodeWithParent[] {
	return program.statements.map(s => assigned && RBinaryOp.is(s) && (s.operator === '<-' || s.operator === '=') ? s.rhs : s);
}

const braced = (program: MutationProgram, body: RNode<ParentInformation>): string => MutationProgram.isBraced(body) ? program.text(body) : `{ ${program.text(body)} }`;

/** the bodies of a construct that R runs as the construct says, an `if` without braces giving both of its branches */
function bodiesOf(node: RNode<ParentInformation>): readonly RNode<ParentInformation>[] {
	if(RIfThenElse.is(node)) {
		return node.otherwise === undefined ? [node.then] : [node.then, node.otherwise];
	}
	return RForLoop.is(node) || RWhileLoop.is(node) || RFunctionDefinition.is(node) ? [node.body] : [];
}

function argumentTexts(program: MutationProgram, call: RFunctionCall<ParentInformation>): string[] | undefined {
	const args = MutationProgram.argumentsOf(call);
	return args.every(a => a !== undefined) ? args.map(a => program.text(a)) : undefined;
}

function shadowsAttachedBase(name: string): boolean {
	const owner = baseRExportOwner(name);
	return owner !== undefined && AttachedBasePackageSet.has(owner);
}

function symbolsNamed(program: MutationProgram, name: string): SourceRange[] {
	return program.nodes().flatMap(n => RSymbol.is(n) && Identifier.getName(n.content) === name && n.location !== undefined ? [n.location] : []);
}

function sameRanges(a: readonly SourceRange[], b: readonly SourceRange[]): boolean {
	const key = (r: readonly SourceRange[]) => uniqueArray(r.map(([l, c]) => `${l}.${c}`)).sort().join();
	return key(a) === key(b);
}

/** the names R binds no matter how they are written, which a renaming has to leave alone */
const NotRenameable: ReadonlySet<string> = new Set(['T', 'F']);

/**
 * The names a program binds that every reference reaches under the same spelling: never an argument name, a
 * `$` or `@` field, a package, a name a string spells out or an attached package exports, as a renaming must leave those be.
 */
function renameableNames(program: MutationProgram): string[] {
	const bound = new Set<string>();
	const unsafe = new Set<string>();
	for(const node of program.nodes()) {
		if(MutationProgram.isAssignment(node)) {
			const target = node.operator === '->' || node.operator === '->>' ? node.rhs : node.lhs;
			if(RSymbol.is(target)) {
				bound.add(Identifier.getName(target.content));
			}
		} else if(RParameter.is(node)) {
			bound.add(Identifier.getName(node.name.content));
		} else if(RForLoop.is(node)) {
			bound.add(Identifier.getName(node.variable.content));
		} else if(RArgument.isNamed(node)) {
			unsafe.add(Identifier.getName(node.name.content));
		} else if(RAccess.is(node) && (node.operator === '$' || node.operator === '@')) {
			program.nodes(node).filter(n => n !== node.accessed && RSymbol.is(n)).forEach(n => unsafe.add(program.text(n)));
		} else if(RSymbol.is(node) && Identifier.getNamespace(node.content) !== undefined) {
			unsafe.add(Identifier.getName(node.content));
		}
	}
	/* a dotted name may be an S3 method, which dispatch finds by its spelling */
	return [...bound].filter(n => !unsafe.has(n) && !n.startsWith('..') && !n.includes('.') && !NotRenameable.has(n)
		&& baseRExportOwner(n) === undefined && !program.spellsOut(n));
}

/** whether a statement's value reads `name` */
function reads(program: MutationProgram, node: RNodeWithParent, name: string): boolean {
	return program.nodes(node).some(n => RSymbol.is(n) && Identifier.getName(n.content) === name);
}

/** whether R prints nothing for any statement but the last, so wrapping them changes nothing it prints */
function onlyLastPrints(program: MutationProgram): boolean {
	return program.statements.slice(0, -1).every(s => program.printsNothing(s));
}

const leadingNoise = new RewritePass({
	name:        'leading noise',
	category:    MutationCategory.Noise,
	description: 'two bindings nothing reads are put before the program, `mut_a <- 1` and `mut_b <- mut_a + 1`',
	adds:        true
}, (program, edit) => void edit.insertLines(1, `${MutationPrefix}a <- 1`, `${MutationPrefix}b <- ${MutationPrefix}a + 1`));

const trailingNoise = new RewritePass({
	name:        'trailing noise',
	category:    MutationCategory.Noise,
	description: 'a binding nothing reads, `mut_c <- 2`, is put after a program that ends in a call printing nothing of its own',
	adds:        true
}, (program, edit) => {
	const last = program.statements.at(-1);
	if(last !== undefined && RFunctionCall.is(last) && program.printsNothing(last)) {
		edit.insertLines(program.lines.length + 1, `${MutationPrefix}c <- 2`);
	}
});

const comments = new RewritePass({
	name:        'interleaved comments',
	category:    MutationCategory.Noise,
	description: 'a comment `# mut_note` is put before every line',
	keepsGraph:  true
}, (program, edit) => program.lines.forEach((_, i) => edit.insertLines(i + 1, `# ${MutationPrefix}note`)));

const trailingComments = new RewritePass({
	name:        'trailing comments',
	category:    MutationCategory.Noise,
	description: 'a comment `# mut_note` is appended to every line',
	keepsGraph:  true
}, (program, edit) => program.lines.forEach((line, i) => line.trim() === '' ? undefined : edit.insert(program.offset(i + 1, line.length + 1), ` # ${MutationPrefix}note`)));

const semicolonJoined = new RewritePass({
	name:        'semicolon-separated statements',
	category:    MutationCategory.Structure,
	description: 'the lines before and after the line of the criterion are each joined into one with `;`',
	keepsGraph:  true
}, (program, edit) => {
	const at = program.criterion;
	if(at === undefined) {
		return;
	}
	const before = program.lines.slice(0, at.line - 1).filter(l => l.trim() !== '');
	const after = program.lines.slice(at.line).filter(l => l.trim() !== '');
	if(before.length < 2 && after.length < 2) {
		return;
	}
	edit.splice(0, program.offset(at.line, 1), before.length > 0 ? before.join('; ') + '\n' : '');
	edit.splice(program.offset(at.line, program.lines[at.line - 1].length + 1), program.code.length, after.length > 0 ? '\n' + after.join('; ') : '');
});

const statementBlocks = new StatementPass({
	name:        'every statement in a block',
	category:    MutationCategory.Structure,
	description: 'every statement on a line of its own is wrapped in a block, `{ x <- 1 }`'
}, (statement, _, edit) => void edit.wrap(statement, '{ ', ' }'));

const wholeProgramBlock = new RewritePass({
	name:        'whole program in a block',
	category:    MutationCategory.Structure,
	description: 'the whole program is wrapped in a `{ ... }` block, where no statement but the last would print'
}, (program, edit) => {
	if(onlyLastPrints(program)) {
		edit.insertLines(1, '{').insertLines(program.lines.length + 1, '}');
	}
});

const wholeProgramLocal = new RewritePass({
	name:        'whole program in local',
	category:    MutationCategory.Structure,
	description: 'the whole program is wrapped in `local({ ... })`, where no statement but the last would print and none depends on the frame it runs in'
}, (program, edit) => {
	if(onlyLastPrints(program) && !program.seesTheFrame) {
		edit.insertLines(1, 'local({').insertLines(program.lines.length + 1, '})');
	}
});

const guardedByIf = new StatementPass({
	name:        'every statement guarded by if(TRUE)',
	category:    MutationCategory.ControlFlow,
	description: 'every statement on a line of its own that is no control construct is guarded, `if(TRUE) x <- 1`'
}, (statement, _, edit) => {
	if(!RIfThenElse.is(statement) && !RLoopConstructs.is(statement) && !RFunctionDefinition.is(statement)) {
		edit.wrap(statement, 'if(TRUE) ', '');
	}
});

/* a body holding anything but an expression would no longer bind to what it binds to now */
const OpenBodies: readonly RType[] = [RType.FunctionDefinition, RType.IfThenElse, RType.ForLoop, RType.WhileLoop, RType.RepeatLoop];

const rightAssign = new AssignmentPass({
	name:        'right assignment',
	category:    MutationCategory.Assignment,
	description: '`x <- 1` becomes `1 -> x`'
}, ({ name, value }, rhs, program) => OpenBodies.includes(value.type) || program.nodes(value).some(n => MutationProgram.isAssignment(n)) ? undefined : `${rhs} -> ${name}`);

const groupedRhs = new AssignmentPass({
	name:        'grouped right hand side',
	category:    MutationCategory.Assignment,
	description: '`x <- 1` becomes `x <- (1)`'
}, ({ name }, rhs) => `${name} <- (${rhs})`);

const bracedRhs = new AssignmentPass({
	name:        'braced right hand side',
	category:    MutationCategory.Assignment,
	description: '`x <- 1` becomes `x <- { 1 }`'
}, ({ name }, rhs) => `${name} <- { ${rhs} }`);

const assignCall = new AssignmentPass({
	name:        'assign call',
	category:    MutationCategory.Assignment,
	description: '`x <- 1` becomes `assign("x", 1)`, except on the line of the criterion, which has to keep naming the variable'
}, ({ name, line }, rhs, program) => line === program.criterion?.line ? undefined : `assign("${name}", ${rhs})`);

const equalsAssign = new AssignmentPass({
	name:        'equals assignment',
	category:    MutationCategory.Assignment,
	description: '`x <- 1` becomes `x = 1`'
}, ({ name }, rhs) => `${name} = ${rhs}`);

const superAssign = new AssignmentPass({
	name:        'top level super assignment',
	category:    MutationCategory.Assignment,
	description: '`x <- 1` becomes `x <<- 1`, except for a name an attached base package exports, as a `<<-` would try to change that binding'
}, ({ name }, rhs) => shadowsAttachedBase(name) ? undefined : `${name} <<- ${rhs}`);

const irregularWhitespace = new AssignmentPass({
	name:        'irregular whitespace around assignments',
	category:    MutationCategory.Literal,
	description: '`x <- 1` becomes `x\\t<-   1`',
	keepsGraph:  true
}, ({ name }, rhs) => `${name}\t<-   ${rhs}`);

const assignmentContinued = new AssignmentPass({
	name:        'assignment continued on the next line',
	category:    MutationCategory.Literal,
	description: 'an assignment before the criterion is continued on the next line, `x <-` and `  1`',
	keepsGraph:  true
}, ({ name, line }, rhs, program) => line < (program.criterion?.line ?? 0) ? `${name} <-\n  ${rhs}` : undefined);

const renameCriterion = new RenamingPass({
	name:        'renamed criterion variable',
	category:    MutationCategory.Naming,
	description: 'the variable the criterion points at is renamed to `mut_v`',
	keepsGraph:  true
}, true, () => `${MutationPrefix}v`);

const renameCriterionNonSyntactic = new RenamingPass({
	name:        'non-syntactic criterion name',
	category:    MutationCategory.Naming,
	description: 'the variable the criterion points at is renamed to a name only valid in backticks, `` `mut_non syntactic` ``'
}, true, () => `\`${MutationPrefix}non syntactic\``);

const isomorphicRenaming = new RenamingPass({
	name:        'every variable renamed',
	category:    MutationCategory.Naming,
	description: 'every variable the program binds is renamed consistently, to `mut_r1`, `mut_r2`, ..., unless the program may read a name as data',
	keepsGraph:  true
}, false, i => `${MutationPrefix}r${i}`);

const isomorphicRenamingNonSyntactic = new RenamingPass({
	name:        'every variable renamed to a non-syntactic name',
	category:    MutationCategory.Naming,
	description: 'every variable the program binds is renamed consistently to a name in backticks, `` `mut_r 1` ``'
}, false, i => `\`${MutationPrefix}r ${i}\``);

const splitString = new LiteralPass({
	name:        'split string literal',
	category:    MutationCategory.Literal,
	description: 'a string literal is split apart, `"vvv"` becomes `paste0("v", "vv")`'
}, ({ content: { str } }) => `paste0("${str.slice(0, 1)}", "${str.slice(1)}")`, value => value.length > 1);

const sprintfString = new LiteralPass({
	name:        'string literal formatted by sprintf',
	category:    MutationCategory.Literal,
	description: 'a string literal is formatted, `"a"` becomes `sprintf("%s", "a")`'
}, literal => `sprintf("%s", ${literal.lexeme})`);

const filePathString = new LiteralPass({
	name:        'path literal built by file.path',
	category:    MutationCategory.Literal,
	description: 'a path literal is built from its parts, `"a/b.txt"` becomes `file.path("a", "b.txt")`'
}, ({ content: { str } }) => `file.path(${str.split('/').map(p => `"${p}"`).join(', ')})`, value => /^[^/]+(\/[^/]+)+$/.test(value));

const hoistString = new LiteralPass({
	name:        'string literal hoisted into a variable',
	category:    MutationCategory.Literal,
	description: 'a string literal is bound to a variable first, `mut_s <- "a"`, which is used in its place',
	adds:        true
}, (literal, edit) => {
	edit.insertLines(1, `${MutationPrefix}s <- ${literal.lexeme}`);
	return `${MutationPrefix}s`;
});

const singleQuoted = new RewritePass({
	name:        'string literals in single quotes',
	category:    MutationCategory.Literal,
	description: '`"a"` becomes `\'a\'`'
}, (program, edit) => program.plainStrings.filter(s => !s.lexeme.includes('\'')).forEach(s => edit.replace(s, `'${s.content.str}'`)), false);

const scientificNumbers = new RewritePass({
	name:        'numbers in scientific notation',
	category:    MutationCategory.Literal,
	description: 'every whole number is written with an exponent, `3` becomes `3e0`'
}, (program, edit) => {
	if(!program.readsCodeAsWritten) {
		program.nodes().filter(n => RNumber.is(n) && /^\d+$/.test(n.lexeme)).forEach(n => edit.wrap(n, '', 'e0'));
	}
}, false);

const shiftCriterionValue = new RewritePass({
	name:        'criterion value shifted by one',
	category:    MutationCategory.Value,
	description: 'the one value the program prints is changed, `x <- 5` becomes `x <- (5) + 1`, and the expected output with it, so the corpus also checks that a slice tracks a value and not just a name'
}, async(program, edit) => {
	const at = program.criterion;
	const printed = /^\[1] (-?\d+)$/.exec(program.target.expected);
	const [statement] = at === undefined ? [] : program.statementsOn(at.line);
	const printsName = statement !== undefined && RFunctionCall.is(statement) && program.text(statement) === `print(${at?.name})`;
	const bindings = program.assignments.filter(a => a.name === at?.name);
	if(at === undefined || printed === null || !printsName || bindings.length !== 1 || (await program.occurrencesOf(at.name)).length !== 2) {
		return;
	}
	edit.replace(bindings[0].node, `${at.name} <- (${program.text(bindings[0].value)}) + 1`).change({ expected: `[1] ${Number(printed[1]) + 1}` });
});

const swapIndependent = new RewritePass({
	name:        'independent statements swapped',
	category:    MutationCategory.ControlFlow,
	description: 'two adjacent assignments before the criterion trade places, where both compute a value and nothing else and neither reads what the other binds'
}, (program, edit) => {
	const at = program.criterion?.line ?? 0;
	const assignments = program.assignments.filter(a => a.line < at);
	const pair = assignments.slice(1).map((b, i) => [assignments[i], b] as const).find(([a, b]) => b.line === a.line + 1 && a.name !== b.name
		&& program.isPure(a.value) && program.isPure(b.value) && !reads(program, a.value, b.name) && !reads(program, b.value, a.name));
	if(pair !== undefined) {
		edit.replace(pair[0].node, program.text(pair[1].node)).replace(pair[1].node, program.text(pair[0].node));
	}
});

const deadStore = new RewritePass({
	name:        'dead assignment to the criterion variable',
	category:    MutationCategory.DeadCode,
	description: 'an assignment to the variable of the criterion is put right before it under `if(FALSE)`',
	adds:        true
}, (program, edit) => {
	const at = program.criterion;
	if(at !== undefined && program.assignments.some(a => a.name === at.name)) {
		edit.insertLines(at.line, `if(FALSE) ${at.name} <- NULL`);
	}
});

const bracesAdded = new RewritePass({
	name:        'braces added to a construct body',
	category:    MutationCategory.Structure,
	description: 'the body of an `if` (both arms of an `if`/`else`), `for`, `while`, or `function` written without braces gets them'
}, (program, edit) => {
	if(program.readsCodeAsWritten) {
		return;
	}
	for(const bodies of constructsOf(program, true).map(bodiesOf)) {
		if(!bodies.some(b => MutationProgram.isBraced(b))) {
			bodies.forEach(b => edit.wrap(b, '{ ', ' }'));
		}
	}
});

const ifElseSwapped = new ConstructPass({
	name:        'if and else swapped under a negated condition',
	category:    MutationCategory.ControlFlow,
	description: 'the branches of an `if`/`else` trade places under the negated condition, where the condition is a single logical'
}, RIfThenElse.is, (node, program) => node.otherwise === undefined || program.readsCodeAsWritten || !program.isLogical(node.condition) ? undefined
	: `if(!(${program.text(node.condition)})) ${braced(program, node.otherwise)} else ${braced(program, node.then)}`);

const whileAsRepeat = new ConstructPass({
	name:        'while loop as a repeat loop',
	category:    MutationCategory.ControlFlow,
	description: '`while(c) b` becomes `repeat { if(!(c)) break; b }`, where the condition is a single logical',
	/* the guard `if(!(cond)) break` is code of its own, dead where the condition always holds */
	adds:        true
}, RWhileLoop.is, (node, program) => program.isLogical(node.condition) ? `repeat { if(!(${program.text(node.condition)})) break; ${program.text(node.body)} }` : undefined, false);

const forAsWhile = new ConstructPass({
	name:        'for loop as a while loop',
	category:    MutationCategory.ControlFlow,
	description: '`for(i in 1:3) b` becomes a `while` loop over the indices of the range, for a range of two whole numbers, which is never empty',
	adds:        true
}, RForLoop.is, (node, program) => {
	/* a loop over an empty sequence leaves its variable `NULL`, which a while loop would not */
	const range = node.vector;
	if(!RBinaryOp.is(range) || range.operator !== ':' || !RNumber.is(range.lhs) || !RNumber.is(range.rhs) || !/^\d+$/.test(range.lhs.lexeme) || !/^\d+$/.test(range.rhs.lexeme)) {
		return undefined;
	}
	const [seq, k] = [`${MutationPrefix}seq`, `${MutationPrefix}k`];
	return `${seq} <- ${program.text(range)}; ${k} <- 0L; while(${k} < length(${seq})) { ${k} <- ${k} + 1L; ${program.text(node.variable)} <- ${seq}[[${k}]]; ${program.text(node.body)} }`;
}, false);

const lambdaShorthand = new RewritePass({
	name:        'lambda shorthand',
	category:    MutationCategory.Function,
	description: '`function(x)` becomes `\\(x)`',
	minRVersion: MIN_VERSION_LAMBDA
}, (program, edit) => {
	for(const definition of program.nodes().filter(isDefinition)) {
		const [sl, sc] = definition.location;
		const start = program.offset(sl, sc);
		if(program.code.startsWith('function', start)) {
			edit.splice(start, program.code.indexOf('(', start), '\\');
		}
	}
}, false);

const nestedCallToPipe = new AssignmentPass({
	name:        'nested call rewritten as a pipe',
	category:    MutationCategory.Function,
	description: 'a call nested in another one becomes a native pipe, `r <- f(g(x))` becomes `r <- x |> g() |> f()`',
	minRVersion: PipeVersion
}, ({ name, value }, _, program) => {
	const outer = RFunctionCall.isNamed(value) ? value : undefined;
	const [inner] = outer === undefined ? [] : MutationProgram.argumentsOf(outer);
	const call = outer !== undefined && outer.arguments.length === 1 && RArgument.is(inner) && inner.name === undefined && RFunctionCall.is(inner.value) && inner.value.named ? inner.value : undefined;
	const [piped, ...rest] = call === undefined ? [] : MutationProgram.argumentsOf(call);
	/* a pipe hands on its left side as the first unnamed argument, and takes no more than what binds tighter than it */
	if(outer === undefined || call === undefined || !RArgument.is(piped) || piped.name !== undefined || piped.value === undefined || !MutationProgram.isPrimary(piped.value)
		|| rest.includes(undefined)) {
		return undefined;
	}
	return `${name} <- ${program.text(piped)} |> ${program.token(call.functionName)}(${rest.map(a => program.text(a as RNodeWithParent)).join(', ')}) |> ${program.token(outer.functionName)}()`;
});

const pipeAsCall = new ConstructPass({
	name:        'pipe rewritten as a nested call',
	category:    MutationCategory.Function,
	description: 'a native pipe becomes the call it stands for, `x |> f(y)` becomes `f(x, y)`'
}, RPipe.is, (node, program) => {
	const call = node.rhs;
	const args = RFunctionCall.isNamed(call) ? argumentTexts(program, call) : undefined;
	const lhs = RArgument.is(node.lhs) ? node.lhs.value : node.lhs;
	/* the placeholder `_` names where the left side goes, which is no longer the first argument */
	const placeholder = program.nodes(call).some(n => (RSymbol.is(n) && Identifier.getName(n.content) === '_') || RPipe.is(n));
	return args === undefined || lhs === undefined || !MutationProgram.isPrimary(lhs) || placeholder || !RFunctionCall.is(call) || !call.named ? undefined
		: `${program.token(call.functionName)}(${[program.text(lhs), ...args].join(', ')})`;
});

const doCall: PassSpec = {
	name:        'call made by do.call',
	category:    MutationCategory.Function,
	description: '`r <- f(1, b = 2)` becomes `r <- do.call(f, list(1, b = 2))`, where `f` only uses the values of its arguments and each argument computes a value and nothing else, as the list evaluates them first'
};

const identityArgument: PassSpec = {
	name:        'argument passed through identity',
	category:    MutationCategory.Function,
	description: 'the first argument that is a plain name is passed through `identity`, `sum(v, 1)` becomes `sum(identity(v), 1)`, where the callee only uses the values of its arguments'
};

const explicitReturn = new RewritePass({
	name:        'function result made an explicit return',
	category:    MutationCategory.Function,
	description: 'the body of a function written without braces is returned explicitly, `function(x) x * 3` becomes `function(x) return(x * 3)`'
}, (program, edit) => {
	if(program.readsCodeAsWritten) {
		return;
	}
	for(const definition of program.nodes().filter(isDefinition)) {
		const [result] = RExpressionList.is(definition.body) ? definition.body.children : [definition.body];
		if(!MutationProgram.isBraced(definition.body) && result !== undefined && !(RFunctionCall.isNamed(result, 'return'))) {
			edit.wrap(definition.body, 'return(', ')');
		}
	}
}, false);

/**
 * `do.call` and `identity` change how a call is made, so they apply where flowR knows the callee only uses the values of
 * its arguments; that takes the dataflow of the callee, so these are rewritten here rather than in {@link AssignmentPass}.
 */
class PlainCallPass extends RewritePass {
	constructor(spec: PassSpec, rewrite: (call: RNamedFunctionCall<ParentInformation>, program: MutationProgram) => string | undefined) {
		super(spec, async(program, edit) => {
			if(program.readsCodeAsWritten) {
				return;
			}
			for(const { node, name, value } of program.assignments) {
				if(RFunctionCall.isNamed(value) && await program.isPlainCall(value)) {
					const rewritten = rewrite(value, program);
					if(rewritten !== undefined) {
						edit.replace(node, `${name} <- ${rewritten}`);
					}
				}
			}
		});
	}
}

const doCallPass = new PlainCallPass(doCall, (call, program) => {
	const args = MutationProgram.argumentsOf(call);
	/* `list(...)` evaluates every argument the call might never have, so each has to be a value that cannot fail */
	if(args.some(a => !isArgument(a) || a.value === undefined || !program.isPure(a.value)
		|| program.nodes(a).some(n => RFunctionDefinition.is(n) || (RSymbol.is(n) && Identifier.getName(n.content) === '...')))) {
		return undefined;
	}
	return `do.call(${program.token(call.functionName)}, list(${args.map(a => program.text(a as RNodeWithParent)).join(', ')}))`;
});

const identityPass = new PlainCallPass(identityArgument, (call, program) => {
	const args = MutationProgram.argumentsOf(call);
	const at = args.findIndex(a => isArgument(a) && a.name === undefined && RSymbol.is(a.value) && !Identifier.getName(a.value.content).startsWith('..'));
	return at < 0 ? undefined : `${program.token(call.functionName)}(${args.map((a, i) => i === at ? `identity(${program.text(a as RNodeWithParent)})` : program.text(a as RNodeWithParent)).join(', ')})`;
});

/** how many passes follow each pass in a chain of two the robustness checks try, so chains reach every pass without trying every pair */
export const ChainedWith = 4;

/** every pass a mutant is generated for; add to this list to check another rewrite */
export const MutationPasses: readonly MutationPass[] = [
	leadingNoise,
	trailingNoise,
	comments,
	trailingComments,
	statementBlocks,
	wholeProgramBlock,
	rightAssign,
	groupedRhs,
	bracedRhs,
	assignCall,
	equalsAssign,
	superAssign,
	renameCriterion,
	renameCriterionNonSyntactic,
	splitString,
	shiftCriterionValue,
	semicolonJoined,
	bracesAdded,
	lambdaShorthand,
	nestedCallToPipe,
	hoistString,
	sprintfString,
	filePathString,
	doCallPass,
	guardedByIf,
	wholeProgramLocal,
	isomorphicRenaming,
	isomorphicRenamingNonSyntactic,
	swapIndependent,
	deadStore,
	ifElseSwapped,
	whileAsRepeat,
	forAsWhile,
	identityPass,
	explicitReturn,
	pipeAsCall,
	singleQuoted,
	scientificNumbers,
	assignmentContinued,
	irregularWhitespace
];
