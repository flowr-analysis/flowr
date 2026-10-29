import type { KnownParser } from '../../../../src/r-bridge/parser';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { NormalizedAst, ParentInformation, RNodeWithParent } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../../../src/dataflow/info';
import { RLoopConstructs, RNode } from '../../../../src/r-bridge/lang-4.x/ast/model/model';
import { escapeRegex } from '../../../../src/util/text/strings';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import { RBinaryOp } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RUnaryOp } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RFunctionCall, EmptyArgument } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RExpressionList } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RSymbol } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RLogical } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { RAccess } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-access';
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { SourceRange } from '../../../../src/util/range';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { callFnProps } from '../../../../src/dataflow/environments/query-fn-props';
import { ArgProp, CallProp, ImpureProps, SemanticCallTag, type BuiltInFnInfo } from '../../../../src/dataflow/environments/built-in-props';
import { FunctionSemantics } from '../../../../src/dataflow/fn/function-semantics';
import { BuiltInProcName } from '../../../../src/dataflow/environments/built-in-proc-name';
import { BuiltInEvalName } from '../../../../src/dataflow/environments/built-in-eval-name';
import { Identifier, ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { BuiltInEvalHandlerMapper } from '../../../../src/dataflow/environments/built-in';
import { DfgVertex } from '../../../../src/dataflow/graph/vertex';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { DfEdge, EdgeType } from '../../../../src/dataflow/graph/edge';
import { Q } from '../../../../src/search/flowr-search-builder';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

export interface MutationTarget {
	/** the program to mutate */
	readonly code:      string;
	/** where to slice, in the only form the passes can move along */
	readonly criterion: `${number}@${string}`;
	/** what {@link code} prints when it is run */
	readonly expected:  string;
	/** the names a pass gave the variables, each mapped to the one the program had before */
	readonly renames?:  Readonly<Record<string, string>>;
}

/** a top-level assignment `name <- value` that is the only statement on its line */
export interface SimpleAssignment {
	readonly node:  RBinaryOp<ParentInformation>;
	readonly name:  string;
	readonly value: RNodeWithParent;
	readonly line:  number;
}

/** the processors that handle a call as R calls any function, evaluating its arguments as written */
const PlainProcessors: ReadonlySet<string> = new Set([BuiltInProcName.Default, BuiltInProcName.DefaultReadAllArgs]);
/** what a call may do with an argument besides using its value, so calling it another way changes what the call sees */
const ArgumentAsWritten = ArgProp.Nse | ArgProp.Lazy | ArgProp.Presence | ArgProp.Written | ArgProp.Callee | ArgProp.Bounds | ArgProp.Deparsed;
/** the call properties of code that looks at the frame it runs in or the code it is written as */
const Reflective = CallProp.Lang | CallProp.Scope;

const analyzers = new WeakMap<KnownParser, Map<string, Promise<FlowrAnalyzer>>>();

/** the analysis of `code`, shared by every pass and observation of the same program */
export function analyzerFor(parser: KnownParser, code: string): Promise<FlowrAnalyzer> {
	const known = analyzers.get(parser) ?? new Map<string, Promise<FlowrAnalyzer>>();
	analyzers.set(parser, known);
	const analyzer = known.get(code) ?? new FlowrAnalyzerBuilder().setParser(parser).build().then(a => (a.addRequest(code), a));
	known.set(code, analyzer);
	return analyzer;
}

/**
 * A program to mutate, as flowR sees it: the statements of its normalized AST, the dataflow graph, and what the
 * built-in configuration states about the calls it makes. Passes ask this instead of reading the code as text.
 */
export class MutationProgram {
	readonly lines:              readonly string[];
	/** the top-level statements, in order */
	readonly statements:         readonly RNodeWithParent[];
	private readonly lineStarts: readonly number[];

	private constructor(
		readonly target: MutationTarget,
		readonly ast: NormalizedAst,
		readonly dataflow: DataflowInformation,
		private readonly analyzer: FlowrAnalyzer
	) {
		this.lines = target.code.split('\n');
		const starts = [0];
		for(const line of this.lines) {
			starts.push(starts[starts.length - 1] + line.length + 1);
		}
		this.lineStarts = starts;
		const root = ast.ast.files[0]?.root;
		this.statements = root === undefined ? [] : root.children;
	}

	static async of(parser: KnownParser, target: MutationTarget): Promise<MutationProgram> {
		const analyzer = await analyzerFor(parser, target.code);
		return new MutationProgram(target, await analyzer.normalize(), await analyzer.dataflow(), analyzer);
	}

	get code(): string {
		return this.target.code;
	}

	/** the line and name of the criterion */
	get criterion(): { readonly line: number, readonly name: string } | undefined {
		return SlicingCriterion.nameAt(this.target.criterion);
	}

	/** the index of the given position (both one-based) in the code */
	offset(line: number, column: number): number {
		return this.lineStarts[line - 1] + column - 1;
	}

	/** the code between the given positions, both inclusive */
	slice([sl, sc, el, ec]: SourceRange): string {
		return this.code.slice(this.offset(sl, sc), this.offset(el, ec) + 1);
	}

	span(node: RNode<ParentInformation>): SourceRange {
		return RNode.span(node) ?? [0, 0, 0, 0];
	}

	text(node: RNode<ParentInformation>): string {
		return this.slice(this.span(node));
	}

	/** the token `node` is made of, the name of a call rather than the call */
	token(node: RNode<ParentInformation>): string {
		return this.slice(SourceRange.ownFromNode(node) ?? this.span(node));
	}

	/** every node below `node` (the whole program if there is none) in the order they are written */
	nodes(node?: RNodeWithParent): RNodeWithParent[] {
		const all: RNodeWithParent[] = [];
		for(const root of node === undefined ? this.statements : [node]) {
			RNode.visitAst(root, n => {
				all.push(n);
			});
		}
		return all;
	}

	/**
	 * Whether every line is whole: no statement continues on the next line and nothing but statements, separated
	 * by `;`, is written on a line. A comment is no statement, so a line holding one is not whole either.
	 */
	get lineByLine(): boolean {
		const covered = this.lines.map(() => '');
		for(const statement of this.statements) {
			const [sl, , el] = this.span(statement);
			if(sl !== el) {
				return false;
			}
			covered[sl - 1] += this.text(statement);
		}
		return this.lines.every((line, i) => line.replace(/[\s;]/g, '').length === covered[i].replace(/[\s;]/g, '').length);
	}

	/** the statements on each line, by line number */
	statementsOn(line: number): RNodeWithParent[] {
		return this.statements.filter(s => this.span(s)[0] === line);
	}

	/** the top-level assignments `name <- value` that are the only statement on their line, see {@link lineByLine} */
	get assignments(): SimpleAssignment[] {
		return this.statements.flatMap(s => {
			const line = this.span(s)[0];
			return RBinaryOp.is(s) && s.operator === '<-' && RSymbol.is(s.lhs) && this.statementsOn(line).length === 1 && this.span(s)[2] === line
				? [{ node: s, name: Identifier.getName(s.lhs.content), value: s.rhs, line }] : [];
		});
	}

	/** what the built-in configuration states about the call, `undefined` for a call of something the program defines */
	callInfo(call: RNodeWithParent): BuiltInFnInfo | undefined {
		return callFnProps(call.info.id, this.dataflow);
	}

	/** the calls below `node`, the operators and accesses R calls as functions included */
	calls(node?: RNodeWithParent): RNodeWithParent[] {
		return this.nodes(node).filter(n => DfgVertex.isFunctionCall(this.dataflow.graph.getVertex(n.info.id)));
	}

	/**
	 * The calls that are no assignment written as an operator. An assignment binds the name it is written with,
	 * which a pass sees in the code, while a call like `assign` binds a name it computes.
	 */
	private reflectingCalls(): RNodeWithParent[] {
		return this.calls().filter(c => !MutationProgram.isAssignment(c));
	}

	/** whether `node` is an assignment of any kind, `<-`, `=`, `->`, `<<-` or `->>` */
	static isAssignment(node: RNode<ParentInformation>): node is RBinaryOp<ParentInformation> {
		return RBinaryOp.is(node) && OperatorDatabase[node.operator]?.usedAs === 'assignment';
	}

	/**
	 * Whether evaluating `node` computes a value and nothing else, as flowR states of every call within it: no
	 * assignment, and only calls of built-ins stated {@link CallProp.Pure} without an impure tag. A function
	 * definition is a value, whatever its body does once called.
	 */
	isPure(node: RNodeWithParent): boolean {
		let pure = true;
		RNode.visitAst(node, n => {
			if(!pure || RFunctionDefinition.is(n)) {
				return true;
			}
			if(MutationProgram.isAssignment(n)) {
				pure = false;
			} else if(n !== node || RFunctionCall.is(n) || RBinaryOp.is(n) || RUnaryOp.is(n) || RAccess.is(n)) {
				const vertex = this.dataflow.graph.getVertex(n.info.id);
				if(DfgVertex.isFunctionCall(vertex)) {
					const info = this.callInfo(n);
					pure = info !== undefined && FunctionSemantics.call.props.hasAll(info, CallProp.Pure) && !FunctionSemantics.call.props.hasAny(info, [...ImpureProps.tags]);
				}
			}
			return !pure;
		});
		return pure;
	}

	/** whether some call reads code as it is written or the frame it runs in, like `quote(x)`, `substitute(x)`, or `match.call()` */
	get readsCodeAsWritten(): boolean {
		return this.calls().some(c => {
			const info = this.callInfo(c);
			return info !== undefined && (FunctionSemantics.call.props.hasAny(info, CallProp.Lang) || (info.frame ?? 0) !== 0);
		}) || this.dataflow.graph.vertices(true).some(([id]) => this.hasEdgeOfType(id, EdgeType.NonStandardEvaluation));
	}

	/**
	 * Whether the program may read a name as data, so renaming a variable would change what it finds: a call that
	 * looks a name up or binds one by its spelling (`get`, `assign`, `exists`), reads code as written, or dispatches by name.
	 */
	get readsNamesAsData(): boolean {
		return this.readsCodeAsWritten || this.reflectingCalls().some(c => {
			const info = this.callInfo(c);
			return info !== undefined && (FunctionSemantics.call.props.hasAny(info, Reflective)
				|| FunctionSemantics.call.props.hasAny(info, [SemanticCallTag.Eval, SemanticCallTag.Frames, SemanticCallTag.Declares, SemanticCallTag.LoadsPackage]));
		}) || this.nodes().some(n => (RAccess.is(n) && n.operator === '@') || (RSymbol.is(n) && n.lexeme?.startsWith('`') === true));
	}

	/**
	 * Whether the program depends on the frame its statements run in, so moving them into another (`local({...})`)
	 * changes what they do: a call that binds or removes names (`assign`, `rm`), evaluates code in an environment,
	 * or reads its frame (`environment()`), and any super-assignment.
	 */
	get seesTheFrame(): boolean {
		return this.readsCodeAsWritten || this.nodes().some(n => RBinaryOp.is(n) && (n.operator === '<<-' || n.operator === '->>')) || this.reflectingCalls().some(c => {
			const info = this.callInfo(c);
			return info !== undefined && (FunctionSemantics.call.props.hasAny(info, Reflective)
				|| FunctionSemantics.call.props.hasAny(info, [SemanticCallTag.Eval, SemanticCallTag.Frames, SemanticCallTag.Declares]));
		});
	}

	/** whether R prints nothing for `statement` at the top level: an assignment, a loop, or a call returning invisibly */
	printsNothing(statement: RNodeWithParent): boolean {
		if(MutationProgram.isAssignment(statement) || RLoopConstructs.is(statement)) {
			return true;
		}
		const info = RFunctionCall.is(statement) ? this.callInfo(statement) : undefined;
		return info !== undefined && FunctionSemantics.call.props.hasAny(info, CallProp.Invisible);
	}

	/**
	 * Whether `call` can be made another way, through `do.call` or with an argument wrapped, without the callee
	 * noticing: flowR processes it as any call and the callee only uses the values of its arguments. A function the
	 * program defines qualifies where it neither quotes a parameter nor asks whether one was supplied.
	 */
	async isPlainCall(call: RNodeWithParent): Promise<boolean> {
		const vertex = this.dataflow.graph.getVertex(call.info.id);
		if(!DfgVertex.isFunctionCall(vertex) || this.hasEdgeOfType(call.info.id, EdgeType.NonStandardEvaluation)) {
			return false;
		}
		const targets = Dataflow.callTargetsOf(call.info.id, this.dataflow.graph, this.dataflow.environment);
		const definitions = targets.filter(t => DfgVertex.isFunctionDefinition(this.dataflow.graph.getVertex(t)));
		if(definitions.length > 0) {
			return definitions.length === targets.length && await this.definesPlainFunctions(definitions);
		}
		const info = this.callInfo(call);
		return info !== undefined && Array.isArray(vertex.origin) && vertex.origin.every(o => PlainProcessors.has(o))
			&& !FunctionSemantics.call.props.hasAny(info, Reflective) && (info.frame ?? 0) === 0
			&& !FunctionSemantics.call.props.hasAny(info, [SemanticCallTag.Eval, SemanticCallTag.Frames, SemanticCallTag.Transforms])
			&& (info.sig ?? []).every(([, props]) => (props & ArgumentAsWritten) === 0);
	}

	private async definesPlainFunctions(definitions: readonly NodeId[]): Promise<boolean> {
		const { 'inspect-fn-props': props } = await this.analyzer.query([{ type: 'inspect-fn-props' }]);
		return definitions.every(d => Object.values(props.roles[d] ?? {}).every(role => (role & (ArgProp.Nse | ArgProp.Presence)) === 0));
	}

	/** whether the condition is a single logical, so that negating it swaps the branches and nothing else */
	isLogical(condition: RNodeWithParent): boolean {
		if(RLogical.is(condition)) {
			return true;
		}
		const name = RBinaryOp.is(condition) || RUnaryOp.is(condition) ? condition.operator
			: RFunctionCall.isNamed(condition) ? Identifier.getName(condition.functionName.content) : undefined;
		/* R's own `is.*` predicates answer with one logical */
		if(name === undefined || (RFunctionCall.is(condition) && !name.startsWith('is.'))) {
			return false;
		}
		const handler = this.analyzer.inspectContext().env.builtInDefinitionsOf(name)
			.find(d => d.type === ReferenceType.BuiltInFunction)?.evalHandler;
		return RFunctionCall.is(condition) ? this.callInfo(condition) !== undefined
			: handler === BuiltInEvalHandlerMapper[BuiltInEvalName.Comparison] || handler === BuiltInEvalHandlerMapper[BuiltInEvalName.Logical];
	}

	/** whether a call reads `node` as it is written rather than for its value, like the package in `library("x")` */
	takenAsWritten(node: RNodeWithParent): boolean {
		for(let parent = RNode.directParent(node, this.ast.idMap); parent !== undefined; parent = RNode.directParent(parent, this.ast.idMap)) {
			if(this.hasEdgeOfType(parent.info.id, EdgeType.NonStandardEvaluation)) {
				return true;
			}
			const info = RFunctionCall.is(parent) ? this.callInfo(parent) : undefined;
			if(info !== undefined && (FunctionSemantics.call.props.hasAny(info, CallProp.Lang)
				|| FunctionSemantics.call.props.hasAny(info, [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage]))) {
				return true;
			}
		}
		return false;
	}

	/** the string literals in double quotes that hold no escape, in the order they are written */
	get plainStrings(): RString<ParentInformation>[] {
		return this.nodes().filter((n): n is RString<ParentInformation> => RString.is(n) && n.content.quotes === '"' && n.content.flag !== 'raw' && !n.lexeme.includes('\\'));
	}

	/** whether a string literal spells `name` out, so a renaming would leave it behind */
	spellsOut(name: string): boolean {
		const word = new RegExp(`(?<![\\w.])${escapeRegex(name)}(?![\\w.])`);
		return this.nodes().some(n => RString.is(n) && word.test(n.content.str));
	}

	/** the arguments of a call, `undefined` for an empty one */
	static argumentsOf(call: RFunctionCall<ParentInformation>): readonly (RNodeWithParent | undefined)[] {
		return call.arguments.map(a => a === EmptyArgument ? undefined : a);
	}

	/** whether `node` is all the left side of a pipe takes: a name, a constant, a call, or a range of them (see `?Syntax`) */
	static isPrimary(node: RNode<ParentInformation>): boolean {
		switch(node.type) {
			case RType.Symbol: case RType.Number: case RType.String: case RType.Logical: return true;
			case RType.FunctionCall: return node.named === true;
			case RType.UnaryOp: return node.operator === '-' && MutationProgram.isPrimary(node.operand);
			case RType.BinaryOp: return node.operator === ':' && MutationProgram.isPrimary(node.lhs) && MutationProgram.isPrimary(node.rhs);
			default: return false;
		}
	}

	/** whether the body is a block in braces */
	static isBraced(body: RNode<ParentInformation>): boolean {
		return RExpressionList.is(body) && !RExpressionList.isImplicit(body);
	}

	/** where `name` is written in the program, as the flowR search finds it */
	async occurrencesOf(name: string): Promise<SourceRange[]> {
		const found = (await this.analyzer.runSearch(Q.var(name).build())).getElements()
			/* a call is found as the call, but the name it is written with is where the name occurs */
			.map(e => RFunctionCall.isNamed(e.node) ? e.node.functionName : e.node)
			.flatMap(node => RSymbol.is(node) && node.location !== undefined ? [node.location] : []);
		return [...new Map(found.map(p => [SourceRange.format(p), p])).values()];
	}

	private hasEdgeOfType(id: NodeId, type: EdgeType): boolean {
		return this.dataflow.graph.edgesFrom(id).values().some(e => DfEdge.includesType(e, type));
	}
}

/**
 * Text edits to a {@link MutationProgram}, applied all at once so each names its place in the original code.
 * The criterion moves along with the lines edits add or remove before it.
 */
export class Rewrite {
	private readonly edits: { readonly from: number, readonly to: number, readonly text: string }[] = [];
	private changes:        Partial<MutationTarget> = {};
	private criterionName?: string;

	constructor(private readonly program: MutationProgram) {}

	/** replaces the code `node` (or the range) spans */
	replace(at: RNode<ParentInformation> | SourceRange, text: string): this {
		const [sl, sc, el, ec] = Array.isArray(at) ? at : this.program.span(at);
		this.edits.push({ from: this.program.offset(sl, sc), to: this.program.offset(el, ec) + 1, text });
		return this;
	}

	/** replaces the code between the given offsets of the original code, `to` exclusive */
	splice(from: number, to: number, text: string): this {
		this.edits.push({ from, to, text });
		return this;
	}

	/** inserts `text` at the given offset of the original code */
	insert(offset: number, text: string): this {
		this.edits.push({ from: offset, to: offset, text });
		return this;
	}

	/** inserts `text` before and `after` behind what `node` spans */
	wrap(node: RNode<ParentInformation>, before: string, after: string): this {
		const [sl, sc, el, ec] = this.program.span(node);
		return this.insert(this.program.offset(sl, sc), before).insert(this.program.offset(el, ec) + 1, after);
	}

	/** inserts whole lines before line `line` (one past the last line appends them) */
	insertLines(line: number, ...lines: readonly string[]): this {
		return line > this.program.lines.length
			? this.insert(this.program.code.length, lines.map(l => '\n' + l).join(''))
			: this.insert(this.program.offset(line, 1), lines.map(l => l + '\n').join(''));
	}

	/** what the mutant states differently besides its code, like the output a changed value prints */
	change(changes: Partial<MutationTarget>): this {
		this.changes = { ...this.changes, ...changes };
		return this;
	}

	/** the name the criterion has in the mutant, where a pass renamed its variable */
	renameCriterion(name: string | undefined): this {
		this.criterionName = name;
		return this;
	}

	get changed(): boolean {
		return this.edits.length > 0;
	}

	/** the mutated target, `undefined` if nothing was edited */
	result(): MutationTarget | undefined {
		if(!this.changed) {
			return undefined;
		}
		const { code } = this.program;
		let out = code;
		for(const { from, to, text } of [...this.edits].sort((a, b) => b.from - a.from || b.to - a.to)) {
			out = out.slice(0, from) + text + out.slice(to);
		}
		const at = this.program.criterion;
		if(at === undefined) {
			return undefined;
		}
		const start = this.program.offset(at.line, 1);
		const breaks = (s: string) => s.split('\n').length - 1;
		const moved = this.edits.filter(e => e.from <= start).reduce((sum, e) => sum + breaks(e.text) - breaks(code.slice(e.from, e.to)), 0);
		return { ...this.program.target, code: out, criterion: `${at.line + moved}@${this.criterionName ?? at.name}`, ...this.changes };
	}
}
