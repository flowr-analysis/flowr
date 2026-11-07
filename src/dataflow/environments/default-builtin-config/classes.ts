import { sig } from './signatures';
import { fn, replacement, pkg, methods, Primitive } from './define';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { ClassSystem, MemberVisibility } from '../../fn/class-declaration';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of the class systems (methods/S4, S7, R6, R.oo). */
export const ClassesDefinitions = [
	/* `hasArg(x)` is `missing()` asked the other way round: it too only looks at whether an argument was supplied */
	fn(methods('hasArg'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ name: ArgProp.Presence }) }, Primitive),
	fn(methods('setValidity'), BuiltInProcName.ClassRelation,
		{
			tags:       [SemanticCallTag.Declares],
			assignment: { targetVariable: true, mayHaveMoreArgs: true, environmentArg: 'envir' },
			classDecl:  { system: ClassSystem.S4, nameArg: { idx: 0, name: 'Class' }, relation: 'validity' },
			props:      CallProp.Scope | CallProp.Invisible,
			sig:        sig({ Class: ArgProp.NoDefault, method: ArgProp.NoDefault, where: 0 })
		},
		Primitive
	),
	fn(methods('setIs'), BuiltInProcName.ClassRelation,
		{
			tags:      [SemanticCallTag.Declares],
			classDecl: { system: ClassSystem.S4, nameArg: { idx: 0, name: 'class1' }, containsArg: { idx: 1, name: 'class2' }, relation: 'is' },
			props:     CallProp.Scope | CallProp.Invisible,
			sig:       sig({
				class1:          ArgProp.NoDefault,
				class2:          ArgProp.NoDefault,
				test:            0,
				coerce:          0,
				replace:         0,
				by:              0,
				where:           0,
				classDef:        0,
				extensionObject: 0,
				doComplete:      0
			})
		},
		Primitive
	),
	fn(methods('setMethod'), BuiltInProcName.ClassRelation,
		{
			props:          CallProp.Invisible,
			tags:           [SemanticCallTag.Declares],
			/* a method joins the methods of its generic rather than replacing them */
			assignmentLike: { targetVariable: true, makeMaybe: true, canBeReplacement: false, target: { idx: 0, name: 'f' }, source: { idx: 2, name: 'definition' }, modesForFn: ['s4'] },
			genericArg:     { idx: 0, name: 'f' },
			classArgs:      [{ idx: 1, name: 'signature' }],
			sig:            sig({ f: ArgProp.NoDefault, signature: 0, definition: ArgProp.NoDefault, where: 0, valueClass: 0, sealed: 0 })
		},
		Primitive
	),
	/* reaches the method `setMethod` registered for a superclass, which receives the arguments given or else the formals of the calling method */
	fn(methods('callNextMethod'), BuiltInProcName.S3Dispatch, { props: CallProp.Generic, sig: sig({ '...': 0 }) }),
	fn(methods('setReplaceMethod'), BuiltInProcName.ClassRelation,
		{
			props:          CallProp.Invisible,
			tags:           [SemanticCallTag.Declares],
			assignmentLike: { targetVariable: true, makeMaybe: true, canBeReplacement: false, targetSuffix: '<-', target: { idx: 0, name: 'f' }, source: { idx: 2, name: 'definition' }, modesForFn: ['s4'] },
			genericArg:     { idx: 0, name: 'f' },
			genericSuffix:  '<-',
			classArgs:      [{ idx: 1, name: 'signature' }],
			sig:            sig({ f: ArgProp.NoDefault, signature: 0, definition: ArgProp.NoDefault, where: 0, valueClass: 0, sealed: 0 })
		},
		Primitive
	),
	fn(pkg(PkgName.R6, 'R6Class'), BuiltInProcName.ClassGenerator,
		{
			classDecl: {
				system:           ClassSystem.R6,
				nameArg:          { idx: 0, name: 'classname' },
				/* R6 inherits from the *generator object*, so the superclass arrives as a variable, not a string */
				containsArg:      { name: 'inherit' },
				instanceBindings: ['self', 'private'],
				memberArgs:       [
					{ idx: 1, name: 'public', visibility: MemberVisibility.Public },
					{ name: 'private', visibility: MemberVisibility.Private },
					{ name: 'active', visibility: MemberVisibility.Active }
				]
			}
		}
	),
	fn(methods('setRefClass'), BuiltInProcName.ClassGenerator,
		{
			props:     CallProp.Invisible,
			tags:      [SemanticCallTag.Declares],
			classDecl: { system: ClassSystem.RefClass, nameArg: { idx: 0, name: 'Class' }, containsArg: { idx: 2, name: 'contains' }, instanceBindings: ['.self'], memberArgs: [{ idx: 1, name: 'fields', typed: true }, { idx: 3, name: 'methods', methods: true }] },
			sig:       sig({ Class: ArgProp.NoDefault, fields: 0, contains: 0, methods: 0, where: 0, inheritPackage: 0, '...': 0 })
		}
	),
	fn(pkg(PkgName.S7, 'new_generic'), BuiltInProcName.S7NewGeneric, { args: { name: 'name', dispatchArg: 'dispatch_args', fun: 'fun' } }, Primitive),
	fn(methods('setGeneric'), BuiltInProcName.S7NewGeneric,
		{
			tags:  [SemanticCallTag.Declares],
			args:  { name: 'name', dispatchArg: undefined, fun: 'fun' },
			binds: true,
			sig:   sig({
				name:                  ArgProp.NoDefault,
				def:                   0,
				group:                 0,
				valueClass:            0,
				where:                 0,
				package:               0,
				signature:             0,
				useAsDefault:          0,
				genericFunction:       0,
				simpleInheritanceOnly: 0
			})
		},
		Primitive
	),
	fn(pkg(PkgName.S7, 'S7_dispatch'), BuiltInProcName.S7Dispatch, { libFn: true }, Primitive),
	/* S4 keeps its classes and generics in string-keyed registries, so a call naming one depends on whatever registered it */
	fn(methods('new'), BuiltInProcName.S4Use, { classArgs: [{ idx: 0, name: 'Class' }], sig: sig({ Class: ArgProp.NoDefault, '...': 0 }) }),
	fn(methods('getClass', 'getClassDef', 'getSlots', 'slotNames', 'isVirtualClass', 'removeClass', 'resetClass', 'getValidity'), BuiltInProcName.S4Use,
		{ classArgs: [{ idx: 0, name: 'Class' }] }
	),
	fn(methods('as'), BuiltInProcName.S4Use,
		{ classArgs: [{ idx: 1, name: 'Class' }], sig: sig({ object: ArgProp.NoDefault, Class: ArgProp.NoDefault, strict: 0, ext: 0 }) }
	),
	fn(methods('is'), BuiltInProcName.S4Use,
		{ classArgs: [{ idx: 1, name: 'class2' }], sig: sig({ object: ArgProp.NoDefault, class2: ArgProp.NoDefault }) }
	),
	fn(methods('setAs'), BuiltInProcName.S4Use,
		{
			props:        CallProp.Invisible,
			tags:         [SemanticCallTag.Declares],
			classArgs:    [{ idx: 0, name: 'from' }],
			registersArg: { idx: 1, name: 'to' },
			sig:          sig({ from: ArgProp.NoDefault, to: ArgProp.NoDefault, def: ArgProp.NoDefault, replace: 0, where: 0 })
		}
	),
	fn(methods('existsMethod', 'hasMethod', 'removeMethod'), BuiltInProcName.S4Use,
		{ genericArg: { idx: 0, name: 'f' }, classArgs: [{ idx: 1, name: 'signature' }], sig: sig({ f: ArgProp.NoDefault, signature: 0, '...': 0 }) }
	),
	fn(methods('getMethod', 'selectMethod'), BuiltInProcName.S4Use,
		{ genericArg: { idx: 0, name: 'f' }, classArgs: [{ idx: 1, name: 'signature' }], returnsMethod: true, sig: sig({ f: ArgProp.NoDefault, signature: 0, '...': 0 }) }
	),
	fn(methods('setClass'), BuiltInProcName.S7MakeConstructor,
		{
			props:     CallProp.Invisible,
			tags:      [SemanticCallTag.Declares],
			mode:      ['s4'],
			classDecl: {
				system:       ClassSystem.S4,
				nameArg:      { idx: 0, name: 'Class' },
				containsArg:  { name: 'contains' },
				/* the modern `slots=` and the historical `representation()` state the same thing */
				memberArgs:   [{ idx: 1, name: 'representation', typed: true }, { name: 'slots', typed: true }],
				prototypeArg: { idx: 2, name: 'prototype' }
			},
			sig: sig({ Class: ArgProp.NoDefault, representation: 0, prototype: 0, contains: 0, validity: 0, access: 0, where: 0, version: 0, sealed: 0, package: 0, S3methods: 0, slots: ArgProp.NoDefault })
		},
		Primitive
	),
	fn(methods('setClassUnion'), BuiltInProcName.S7MakeConstructor,
		{
			props:     CallProp.Invisible,
			tags:      [SemanticCallTag.Declares],
			mode:      ['s4'],
			classDecl: {
				system:   ClassSystem.S4,
				nameArg:  { idx: 0, name: 'name' },
				/* a union is a virtual class its members become subclasses of */
				unionArg: { idx: 1, name: 'members' }
			},
			sig: sig({ name: ArgProp.NoDefault, members: 0, where: 0 })
		},
		Primitive
	),
	replacement(pkg(PkgName.S7, 'method'), ['<-', '<<-'], { readIndices: true, constructName: 's7' }),
] as const satisfies AnyBuiltInDefinition[];
