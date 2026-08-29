import { inferFunctions } from './function-props';
import { exceptionsOfFunction } from './exceptions-of-function';
import { strictnessOfEach } from './strict-function';
import { isHigherOrder } from './higher-order-function';
import { argumentRolesOfFunctions } from './argument-roles';
import { reflectiveRolesOf } from './frame-reflection';
import { argForImpl, classDeclarationOfImpl, declaredClassesImpl, superClassesOfImpl, toSigClassesImpl } from './class-declaration';
import { Vertex } from '../graph/vertex';
import type { DataflowGraphVertexInfo } from '../graph/vertex';

/**
 * The one helper to ask what a function *does*: what it makes of its arguments, what it may raise, which
 * formals it forces, and what it declares as a class. It replaces the seven single-purpose helper objects
 * that used to sit one per file under `src/dataflow/fn/`.
 * @example
 * ```ts
 * Fn.props(definitions, graph);            // what the definitions do with what they get
 * Fn.exceptions(definition, callGraph);    // what they may raise
 * Fn.strictness(definitions, graph);       // which formals they force
 * Fn.isHigherOrder(definition, graph);     // whether they call what they are handed
 * Fn.argumentRoles(definitions, graph);    // what each formal is used as
 * Fn.classes.declared(graph);              // the classes the project declares
 * ```
 */
export const Fn = {
	name:            'Fn',
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
	/** What the project declares as a class, and how those relate. */
	classes:         {
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
			return Vertex.isFunctionCall(vertex) && vertex.classDecl !== undefined;
		}
	}
} as const;
