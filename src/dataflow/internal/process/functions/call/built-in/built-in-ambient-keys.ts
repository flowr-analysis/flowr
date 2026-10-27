import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ParentInformation, RNodeWithParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { Identifier } from '../../../../../environments/identifier';
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
	readonly ignore?: readonly string[]
} | {
	/** the call always sets this entry, like `Sys.setLanguage` sets `LANGUAGE` */
	readonly from: 'constant'
	readonly key:  string
} | {
	/** the entries a parameter names, like `Sys.setlocale(category = "LC_ALL")` or `detach(package:dplyr)` */
	readonly from:      'parameter'
	/** the formals of the function, for matching the arguments */
	readonly signature: readonly string[]
	/** the parameters to take the entries from, the first one given wins (`attach(what, name = "x")` is `x`) */
	readonly names:     readonly string[]
	/** the entry set if none of the parameters is given */
	readonly fallback?: string
	/**
	 * The parameter is quoted, so a symbol or string is the name itself (`library(dplyr)`) instead of a variable to look up.
	 * A parameter name states the flag that switches to looking up its value (`library(pkg, character.only = TRUE)`).
	 */
	readonly quoted?:   boolean | string
};

/** The strings the value at `value` may have, `undefined` if we do not know. */
export function stringValuesOf<OtherInfo>(value: RNodeWithParent<OtherInfo> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] | undefined {
	if(value === undefined) {
		return undefined;
	} else if(RString.is(value)) {
		return [value.content.str];
	}
	const strings = NodeValue.stringsOf(value.info.id, data);
	return strings === undefined || strings.length === 0 ? undefined : strings;
}

/** What a quoted argument names: `dplyr`, `"dplyr"`, and `package:dplyr`. */
function quotedName<OtherInfo>(node: RNodeWithParent<OtherInfo>): string | undefined {
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

/** Whether the value at `node` is `TRUE`: `'yes'`, `'no'` (also if there is no flag), or `'maybe'`. */
function flagValue<OtherInfo>(node: RNodeWithParent<OtherInfo> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): 'yes' | 'no' | 'maybe' {
	const values = node === undefined ? [] : NodeValue.setOf(node.info.id, data)?.elements;
	if(node === undefined) {
		return 'no';
	} else if(values === undefined || values.length === 0 || values.some(v => v.type !== 'logical' || typeof v.value !== 'boolean')) {
		return 'maybe';
	}
	const isTrue = values.map(v => v.type === 'logical' && v.value === true);
	return isTrue.every(Boolean) ? 'yes' : isTrue.some(Boolean) ? 'maybe' : 'no';
}

function parameterKeys<OtherInfo>(keys: AmbientKeys & { readonly from: 'parameter' }, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] {
	const bound = MatchArgs.toNames(args, keys.signature);
	const value = keys.names.map(n => bound.get(n)?.value).find(v => v !== undefined);
	if(value === undefined) {
		return keys.fallback === undefined ? [] : [keys.fallback];
	}
	/* whether the argument is looked up as a value, which the flag switches on for a quoted one */
	const looksUp = typeof keys.quoted === 'string' ? flagValue(bound.get(keys.quoted)?.value, data) : keys.quoted ? 'no' : 'yes';
	const name = looksUp === 'yes' ? undefined : quotedName(value);
	const values = looksUp === 'no' && name !== undefined ? [] : stringValuesOf(value, data) ?? [UnknownKey];
	return name === undefined ? values : [name, ...values];
}

/** The entries the call with the arguments `args` names, see {@link AmbientKeys}. */
export function keysOf<OtherInfo>(keys: AmbientKeys, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] {
	switch(keys.from) {
		case 'constant':
			return [keys.key];
		case 'argument-names':
			return args.flatMap(a => {
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
	}
}

/** The pseudo variables a write to the given entries of `state` defines: the entries and what every write to the state adds to. */
export function keyedWrites(state: KeyedState, keys: readonly string[]): string[] {
	return keys.length === 0 ? [] : [...new Set([...keys.map(k => AmbientStateName.keyed(state, k)), AmbientStateName.allOf(state)])];
}
