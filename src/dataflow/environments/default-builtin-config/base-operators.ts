import { fn, pkg, base, utils } from './define-helpers';
import type { AnyBuiltInDefinition } from '../built-in-config';
import { PkgName } from '../pkg-name';
import { BuiltInProcName } from '../built-in-proc-name';
import { BuiltInEvalName } from '../built-in-eval-name';
import { ArgProp, CallProp } from '../built-in-props';
import { NseArguments } from '../../internal/process/functions/call/nse-kind';
import { RawRType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { SupportedFlowrCapabilityId } from '../../../r-bridge/data/get';
import { SigAtomicBinOp, SigAtomicX, SigXTable, SigXY, sig, Forced } from './shared-signatures';

/** The arity of an operator. */
export const enum OperatorArity {
	Unary = 1,
	Binary = 2,
	Both = 3,
}

export enum OperatorWrittenAs {
	Infix  = 'infix',
	Prefix = 'prefix'
}

export enum OperatorUsedAs {
	Assignment = 'assignment',
	Operation  = 'operation',
	Access     = 'access'
}

/** What an operation computes, for operators that belong to one of these families. */
export enum OperatorCategory {
	Arithmetic = 'arithmetic',
	Comparison = 'comparison',
	Logical    = 'logical'
}

/** What flowR knows about an operator as part of R's syntax, stated by the built-in definition of the operator (see {@link BuiltInOperators}). */
export interface OperatorFacts {
	readonly name:             string;
	/** how the R parser names the token, `**` is `^` there */
	readonly stringUsedInRAst: RawRType | `%${string}%`;
	readonly writtenAs:        OperatorWrittenAs;
	readonly arity:            OperatorArity;
	readonly usedAs:           OperatorUsedAs;
	readonly category?:        OperatorCategory;
	/** the capabilities this operator maps to */
	readonly capabilities:     SupportedFlowrCapabilityId[];
}

function operator(name: string, stringUsedInRAst: OperatorFacts['stringUsedInRAst'], capabilities: SupportedFlowrCapabilityId[], more: Partial<Pick<OperatorFacts, 'arity' | 'writtenAs' | 'category' | 'usedAs'>> = {}): OperatorFacts {
	return { name, stringUsedInRAst, capabilities, usedAs: OperatorUsedAs.Operation, writtenAs: OperatorWrittenAs.Infix, arity: OperatorArity.Binary, ...more };
}

const Binary: SupportedFlowrCapabilityId[] = ['binary-operator', 'infix-calls', 'function-calls'];
const Special: SupportedFlowrCapabilityId[] = ['binary-operator', 'infix-calls', 'special-operator', 'function-calls'];
const Logical: SupportedFlowrCapabilityId[] = ['binary-operator', 'infix-calls', 'function-calls', 'non-strict-logical-operators'];
const assignment = (kind: SupportedFlowrCapabilityId): SupportedFlowrCapabilityId[] => ['binary-operator', 'infix-calls', 'assignment-functions', kind, 'function-calls'];
const InArithmetic = { category: OperatorCategory.Arithmetic } as const;
const InComparison = { category: OperatorCategory.Comparison } as const;
const InLogical = { category: OperatorCategory.Logical } as const;
const Assigns = { usedAs: OperatorUsedAs.Assignment } as const;

/** The built-in definitions of R's operators, each stating the {@link OperatorFacts} of the names it defines. */
export const OperatorDefinitions = [
	/* formula: operands are model terms/columns, not variables */
	fn(base('~'), BuiltInProcName.DefaultReadAllArgs,
		{ markArgsAsMasked: NseArguments.All, sig: sig({ y: 0, model: ArgProp.NoDefault }) },
		{
			operators: { '~': operator('model formulae', RawRType.Tilde, ['binary-operator', 'infix-calls', 'model-formula', 'function-calls'], { arity: OperatorArity.Both }) }
		}
	),
	fn(base('+', '-', '*', '/', '^', '**', '%%', '%/%'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: SigAtomicBinOp },
		{
			assumePrimitive: true,
			evalHandler:     BuiltInEvalName.Numeric,
			operators:       { '+': operator('addition or unary +', RawRType.Plus, ['function-calls'], { ...InArithmetic, arity: OperatorArity.Both }), '-': operator('subtraction or unary -', RawRType.Minus, ['function-calls'], { ...InArithmetic, arity: OperatorArity.Both }), '*': operator('multiplication', RawRType.Times, Binary, InArithmetic), '/': operator('division', RawRType.Div, Binary, InArithmetic), '^': operator('exponentiation', RawRType.Exp, Binary, InArithmetic), '**': operator('alternative exponentiation', RawRType.Exp, Binary, InArithmetic), '%%': operator('modulus', '%%', Special, InArithmetic), '%/%': operator('integer division', '%/%', Special, InArithmetic) }
		}
	),
	fn(base('==', '!=', '>', '>=', '<', '<='), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: SigAtomicBinOp },
		{
			assumePrimitive: true,
			evalHandler:     BuiltInEvalName.Comparison,
			operators:       { '==': operator('equal to', RawRType.Eq, Binary, InComparison), '!=': operator('not equal to', RawRType.Ne, Binary, InComparison), '>': operator('greater than', RawRType.Gt, Binary, InComparison), '>=': operator('greater than or equal to', RawRType.Ge, Binary, InComparison), '<': operator('less than', RawRType.Lt, Binary, InComparison), '<=': operator('less than or equal to', RawRType.Le, Binary, InComparison) }
		}
	),
	fn(base('%*%'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: SigXY },
		{ assumePrimitive: true, operators: { '%*%': operator('matrix product', '%*%', Special, InArithmetic) } }
	),
	fn(base('%in%'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: SigXTable }, { assumePrimitive: true, operators: { '%in%': operator('matching operator', '%in%', Special) } }
	),
	fn(base(':'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ from: Forced.Value | ArgProp.Atomic, to: Forced.Value | ArgProp.Atomic }) },
		{ assumePrimitive: true, evalHandler: BuiltInEvalName.Seq, operators: { ':': operator('sequence operator', RawRType.Colon, Binary) } }
	),
	fn(base('!'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: SigAtomicX },
		{
			assumePrimitive: true,
			evalHandler:     BuiltInEvalName.Logical,
			operators:       { '!': operator('unary not', RawRType.Exclamation, ['unary-operator', 'function-calls'], { ...InLogical, arity: OperatorArity.Unary, writtenAs: OperatorWrittenAs.Prefix }) }
		}
	),
	fn(utils('?'), BuiltInProcName.DefaultReadAllArgs,
		{ sig: sig({ e1: ArgProp.Nse, e2: ArgProp.Nse }) },
		{
			assumePrimitive: true,
			operators:       { '?': operator('question', RawRType.Question, ['unary-operator', 'built-in-help'], { arity: OperatorArity.Unary, writtenAs: OperatorWrittenAs.Prefix }) }
		}
	),
	fn(['<-', '='], BuiltInProcName.Assignment,
		{
			canBeReplacement: true,
			props:            CallProp.Scope | CallProp.Invisible,
			sig:              sig({ x: ArgProp.NoDefault, value: ArgProp.NoDefault | ArgProp.Forced | ArgProp.Alias })
		},
		{
			assumePrimitive: true,
			operators:       { '<-': operator('left assignment', RawRType.LeftAssign, assignment('local-left-assignment'), Assigns), '=': operator('equal assignment', RawRType.EqualAssign, assignment('local-equal-assignment'), Assigns) }
		}
	),
	fn(pkg(PkgName.DataTable, ':='), BuiltInProcName.Assignment,
		{ props: CallProp.Invisible | CallProp.Scope },
		{
			assumePrimitive: true,
			operators:       { ':=': operator('left assignment', RawRType.LeftAssign, assignment('local-table-assignment'), Assigns) }
		}
	),
	fn(['<<-'], BuiltInProcName.Assignment,
		{
			superAssignment:  true,
			canBeReplacement: true,
			props:            CallProp.Scope | CallProp.Invisible,
			sig:              sig({ x: ArgProp.NoDefault, value: ArgProp.NoDefault | ArgProp.Forced | ArgProp.Alias })
		},
		{
			assumePrimitive: true,
			operators:       { '<<-': operator('left global assignment', RawRType.LeftAssign, assignment('super-left-assignment'), Assigns) }
		}
	),
	fn(['->'], BuiltInProcName.Assignment,
		{
			swapSourceAndTarget: true,
			canBeReplacement:    true,
			props:               CallProp.Scope | CallProp.Invisible,
			sig:                 sig({ value: ArgProp.NoDefault | ArgProp.Forced | ArgProp.Alias, x: ArgProp.NoDefault })
		},
		{
			assumePrimitive: true,
			operators:       { '->': operator('right assignment', RawRType.RightAssign, assignment('local-right-assignment'), Assigns) }
		}
	),
	fn(['->>'], BuiltInProcName.Assignment,
		{
			superAssignment:     true,
			swapSourceAndTarget: true,
			canBeReplacement:    true,
			props:               CallProp.Scope | CallProp.Invisible,
			sig:                 sig({ value: ArgProp.NoDefault | ArgProp.Forced | ArgProp.Alias, x: ArgProp.NoDefault })
		},
		{
			assumePrimitive: true,
			operators:       { '->>': operator('right global assignment', RawRType.RightAssign, assignment('super-right-assignment'), Assigns) }
		}
	),
	/* only `&&`/`||` short-circuit */
	fn(base('&&'), BuiltInProcName.SpecialBinOp,
		{
			lazy:        true,
			evalRhsWhen: true,
			props:       CallProp.Pure,
			sig:         sig({ x: ArgProp.NoDefault | ArgProp.Forced | ArgProp.Atomic, y: ArgProp.NoDefault | ArgProp.Atomic })
		},
		{
			assumePrimitive: true,
			evalHandler:     BuiltInEvalName.Logical,
			operators:       { '&&': operator('logical and (non-vectorized)', RawRType.And2, Logical, InLogical) }
		}
	),
	fn(base('||'), BuiltInProcName.SpecialBinOp,
		{
			lazy:        true,
			evalRhsWhen: false,
			props:       CallProp.Pure,
			sig:         sig({ x: ArgProp.NoDefault | ArgProp.Forced | ArgProp.Atomic, y: ArgProp.NoDefault | ArgProp.Atomic })
		},
		{
			assumePrimitive: true,
			evalHandler:     BuiltInEvalName.Logical,
			operators:       { '||': operator('logical or (not-vectorized)', RawRType.Or2, Logical, InLogical) }
		}
	),
	fn(base('&', '|'), BuiltInProcName.SpecialBinOp,
		{
			lazy:  false,
			props: CallProp.Pure,
			sig:   sig({ e1: ArgProp.NoDefault | Forced.Value | ArgProp.Atomic, e2: ArgProp.NoDefault | Forced.Value | ArgProp.Atomic })
		},
		{
			assumePrimitive: true,
			evalHandler:     BuiltInEvalName.Logical,
			operators:       { '&': operator('logical and (vectorized)', RawRType.And, Logical, InLogical), '|': operator('logical or (vectorized)', RawRType.Or, Logical, InLogical) }
		}
	),
	/* R defines them as closures over `outer` and `kronecker` */
	fn(base('%o%', '%x%'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ X: Forced.Value, Y: Forced.Value }) },
		{
			operators: { '%o%': operator('outer product', '%o%', Special, InArithmetic), '%x%': operator('kronecker product', '%x%', Special, InArithmetic) }
		}
	),
] as const satisfies AnyBuiltInDefinition[];

const byName: Readonly<Record<string, OperatorFacts>> = Object.fromEntries(OperatorDefinitions.flatMap(d => Object.entries(d.operators ?? {})));
const names: readonly string[] = Object.keys(byName);
const inRAst = (ops: readonly string[]): ReadonlySet<string> => new Set(ops.map(op => byName[op].stringUsedInRAst));

/**
 * The operators of R, as the {@link OperatorDefinitions} state them.
 * @helper ast
 */
export const BuiltInOperators = {
	name:        'BuiltInOperators',
	/** the facts of every operator, by the operator as written in R code */
	byName,
	/** every operator as written in R code */
	names,
	/** the token names the R parser uses for the operators */
	inRAst:      inRAst(names),
	/** the token names of the operators that can be unary */
	unaryInRAst: inRAst(names.filter(op => byName[op].arity !== OperatorArity.Binary)),
	/** the facts of `op`, `undefined` if it is no operator */
	get(this: void, op: string): OperatorFacts | undefined {
		return byName[op];
	},
	/** the operators of the given category */
	ofCategory(this: void, category: OperatorCategory): readonly string[] {
		return names.filter(op => byName[op].category === category);
	}
} as const;
