import { inferFunctions } from './function-props';
import { exceptionsOfFunction } from './exceptions-of-function';
import { strictnessOfEach } from './strict-function';
import { isHigherOrder } from './higher-order-function';
import { argumentRolesOfFunctions } from './argument-roles';
import { reflectiveRolesOf } from './frame-reflection';
import { argForImpl, classDeclarationOfImpl, declaredClassesImpl, superClassesOfImpl, toSigClassesImpl } from './class-declaration';
import { DfgVertex } from '../graph/vertex';
import { ArgProps, CallProps, FnSig } from '../environments/built-in-props';
import { MatchArgs } from '../graph/match-args';
import { Nse } from '../internal/process/functions/call/nse';
import { Quoted } from '../internal/process/functions/call/quoted';
import { Deferred } from '../internal/process/functions/call/deferred';
import { UnsupportedFunctions } from '../../abstract-interpretation/unsupported-functions';
import type { DataflowGraphVertexInfo } from '../graph/vertex';

/**
 * The one helper to ask what a function *does*: what it makes of its arguments, what it may raise, which
 * formals it forces, and what it declares as a class. It replaces the seven single-purpose helper objects
 * that used to sit one per file under `src/dataflow/fn/`.
 * @example
 * ```ts
 * FunctionSemantics.props(definitions, graph);            // what the definitions do with what they get
 * FunctionSemantics.exceptions(definition, callGraph);    // what they may raise
 * FunctionSemantics.strictness(definitions, graph);       // which formals they force
 * FunctionSemantics.isHigherOrder(definition, graph);     // whether they call what they are handed
 * FunctionSemantics.argumentRoles(definitions, graph);    // what each formal is used as
 * FunctionSemantics.classes.declared(graph);              // the classes the project declares
 * FunctionSemantics.call.props.hasAny(stated, CallProp.Scope);   // what flowR states one call does
 * FunctionSemantics.call.match(call, formals);            // how R binds its arguments
 * ```
 */
export const FunctionSemantics = {
	name:            'FunctionSemantics',
	/** What several definitions and their formals do. */
	props:           inferFunctions,
	/** The exceptions a definition may raise. */
	exceptions:      exceptionsOfFunction,
	/** The strictness of several definitions, sharing the work between them. */
	strictness:      strictnessOfEach,
	/** Whether one definition is higher-order, i.e. whether it calls what it is handed. */
	isHigherOrder:   isHigherOrder,
	/** The roles of several definitions' formals, sharing the built-in lookups. */
	argumentRoles:   argumentRolesOfFunctions,
	/** The reflective argument bits of one definition. */
	frameReflection: reflectiveRolesOf,
	/**
	 * What one *call* of a function means: what flowR states about it, how R binds its arguments, and which of
	 * them it does not simply evaluate.
	 */
	call:            {
		/** What flowR states a call does (it reads a file, it asks the user, ...). */
		props:       CallProps,
		/** The formals a built-in declares. */
		signature:   FnSig,
		/** The same as {@link FunctionSemantics.call.props}, for one argument. */
		argument:    ArgProps,
		/** R's argument matching -- exact, then partial, then positional. */
		match:       MatchArgs,
		/** The arguments a call does not evaluate. */
		nse:         Nse,
		/** The expressions it quotes instead. */
		quoted:      Quoted,
		/** The ones it evaluates at a time flowR cannot pin down. */
		deferred:    Deferred,
		/** The calls that change the environment in ways flowR cannot follow. */
		unsupported: UnsupportedFunctions
	},
	/** What the project declares as a class, and how those relate. */
	classes: {
		/** The declaration a call states. */
		of:       classDeclarationOfImpl,
		/** Every class the graph declares, keyed by name. */
		declared: declaredClassesImpl,
		/** The transitive superclasses of a declared class. */
		superOf:  superClassesOfImpl,
		/** The signature-database records for a set of declared classes. */
		toSig:    toSigClassesImpl,
		/** The argument a class-declaring built-in's config names. */
		argFor:   argForImpl,
		/** Whether the vertex is a call that declares a class; its `classDecl` is then set. */
		isDeclaring(this: void, vertex: DataflowGraphVertexInfo | undefined): boolean {
			return DfgVertex.isFunctionCall(vertex) && vertex.classDecl !== undefined;
		}
	}
} as const;
