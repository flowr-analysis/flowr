import { Ternary } from '../../../../../../util/logic';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ParentInformation, RNodeWithParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { type BrandedIdentifier, Identifier } from '../../../../../environments/identifier';
import { MatchArgs } from '../../../../../graph/match-args';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { AmbientStateName, type KeyedState, UnknownKey } from '../../../../../environments/ambient-state-name';

/**
 * Where a call names the entries of a {@link KeyedState} it sets, declared in the built-in configuration.
 * An entry we cannot name is the {@link UnknownKey}.
 */
export type AmbientKeys = {
	/**
	 * The names of the named arguments, like `Sys.setenv(A = "1")` sets `A`. An unnamed argument stands for entries
	 * we cannot name (`par(op)`) unless it is a string, which only queries (`par("mar")`).
	 */
	readonly from:    'argument-names'
	/** arguments to leave out, like `par(no.readonly = TRUE)` */
	readonly ignore?: readonly BrandedIdentifier[]
} | {
	/** every unnamed argument names an entry, like `pacman::p_load(a, b)`; quoted ones are names themselves, others are looked up */
	readonly from:   'unnamed'
	readonly quoted: boolean
} | {
	/** the call always names these entries, like `Sys.setLanguage` sets `LANGUAGE` */
	readonly from: 'constant'
	readonly keys: readonly string[]
} | {
	/** the entries a parameter names, like `Sys.setlocale(category = "LC_ALL")` or `detach(package:dplyr)` */
	readonly from:      'parameter'
	/** the formals of the function, for matching the arguments */
	readonly signature: readonly string[]
	/** the parameters to take the entries from, the first one given wins (`attach(what, name = "x")` is `x`) */
	readonly names:     readonly BrandedIdentifier[]
	/** the entry set if none of the parameters is given */
	readonly fallback?: string
	/**
	 * The parameter is quoted, so a symbol or string is the name itself (`library(dplyr)`) instead of a variable to look up.
	 * A parameter name states the flag that switches to looking up its value (`library(pkg, character.only = TRUE)`).
	 */
	readonly quoted?:   boolean | string
};

/** The strings the value at `value` may have, `undefined` if we do not know. */
export function stringValuesOf<OtherInfo>(value: RNodeWithParent<OtherInfo> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): BrandedIdentifier[] | undefined {
	if(value === undefined) {
		return undefined;
	} else if(RString.is(value)) {
		return [value.content.str];
	}
	const strings = NodeValue.stringsOf(value.info.id, data);
	return strings === undefined || strings.length === 0 ? undefined : strings;
}

/** What a quoted argument names: `dplyr`, `"dplyr"`, and `package:dplyr`. */
function quotedName<OtherInfo>(node: RNodeWithParent<OtherInfo>): BrandedIdentifier | undefined {
	if(RSymbol.is(node)) {
		return Identifier.getName(node.content);
	} else if(RString.is(node)) {
		return node.content.str;
	} else if(RBinaryOp.is(node) && node.operator === ':') {
		const [namespace, name] = [quotedName(node.lhs), quotedName(node.rhs)];
		return namespace === undefined || name === undefined ? undefined : `${namespace}:${name}`;
	}
	return undefined;
}

/** Whether the value at `node` is `TRUE`, {@link Ternary.Never} if there is no flag. */
export function flagValue<OtherInfo>(node: RNodeWithParent<OtherInfo> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): Ternary {
	const values = node === undefined ? [] : NodeValue.setOf(node.info.id, data)?.elements;
	if(node === undefined) {
		return Ternary.Never;
	} else if(values === undefined || values.length === 0 || values.some(v => v.type !== 'logical' || typeof v.value !== 'boolean')) {
		return Ternary.Maybe;
	}
	const isTrue = values.map(v => v.type === 'logical' && v.value === true);
	return isTrue.every(Boolean) ? Ternary.Always : isTrue.some(Boolean) ? Ternary.Maybe : Ternary.Never;
}

function parameterKeys<OtherInfo>(keys: AmbientKeys & { readonly from: 'parameter' }, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): readonly BrandedIdentifier[] {
	const bound = MatchArgs.toNames(args, keys.signature);
	const value = keys.names.map(n => bound.get(n)?.value).find(v => v !== undefined);
	if(value === undefined) {
		return keys.fallback === undefined ? [] : [keys.fallback];
	}
	/* whether the argument is looked up as a value, which the flag switches on for a quoted one */
	const looksUp = typeof keys.quoted === 'string' ? flagValue(bound.get(keys.quoted)?.value, data) : keys.quoted ? Ternary.Never : Ternary.Always;
	const name = looksUp === Ternary.Always ? undefined : quotedName(value);
	const values = looksUp === Ternary.Never && name !== undefined ? [] : stringValuesOf(value, data) ?? [UnknownKey];
	return name === undefined ? values : [name, ...values];
}

/** The entries the call with the arguments `args` names, see {@link AmbientKeys}. */
export function keysOf<OtherInfo>(keys: AmbientKeys, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): readonly BrandedIdentifier[] {
	switch(keys.from) {
		case 'constant':
			return keys.keys;
		case 'argument-names':
			return args.flatMap((a): readonly BrandedIdentifier[] => {
				if(a === EmptyArgument) {
					return [];
				} else if(a.name !== undefined) {
					const name = Identifier.getName(a.name.content);
					return keys.ignore?.includes(name) ? [] : [name];
				}
				return RString.is(a.value) ? [] : [UnknownKey];
			});
		case 'parameter':
			return parameterKeys(keys, args, data);
		case 'unnamed':
			return args.flatMap((a): BrandedIdentifier | readonly BrandedIdentifier[] => a === EmptyArgument || a.name !== undefined || a.value === undefined ? []
				: (keys.quoted ? quotedName(a.value) : undefined) ?? stringValuesOf(a.value, data) ?? [UnknownKey]);
	}
}

/** The pseudo variables a write to the given entries of `state` defines: the entries and what every write to the state adds to. No entry has an empty name. */
export function keyedWrites(state: KeyedState, given: readonly BrandedIdentifier[]): AmbientStateName[] {
	const keys = given.filter(k => k !== '');
	return keys.length === 0 ? [] : [...new Set([...keys.map(k => AmbientStateName.keyed(state, k)), AmbientStateName.allOf(state)])];
}
