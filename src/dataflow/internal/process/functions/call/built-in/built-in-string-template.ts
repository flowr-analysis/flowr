import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { requestFromInput } from '../../../../../../r-bridge/retriever';
import { sourcedDeterministicCountingIdGenerator, type ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { Identifier } from '../../../../../environments/identifier';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { appendEnvironment } from '../../../../../environments/append';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { sourceRequest } from './built-in-source';
import { linkInputs } from '../../../../linker';

/** Arguments naming the scope the template runs against, which we cannot follow. */
const RedirectingParameters = ['.envir', '.con', '.x', '.data'];
/** cli markup: `{.cls text}` styles its content, so the class is no expression but the content may hold some. */
const Markup = /^\.[A-Za-z][\w.-]*[\s]/;

export interface StringTemplateConfiguration {
	/** what opens an interpolation, `{` unless given */
	readonly open?:   string
	/** what closes it, `}` unless given */
	readonly close?:  string
	/** whether `{.cls ...}` styles its content instead of evaluating it, as cli does */
	readonly markup?: boolean
}

/**
 * The R expressions a template interpolates. A doubled delimiter escapes it, delimiters nest, and one inside a
 * string is literal, so this walks the template. With `markup`, `{.cls ...}` contributes its content instead.
 */
export function interpolationsOf(template: string, open: string, close: string, markup = false): readonly string[] {
	const found: string[] = [];
	let at = 0;
	while(at < template.length) {
		if(template.startsWith(open + open, at)) {
			at += 2 * open.length;
			continue;
		} else if(!template.startsWith(open, at)) {
			at += 1;
			continue;
		}
		const from = at + open.length;
		let depth = 1, quote: string | undefined = undefined, i = from;
		for(; i < template.length && depth > 0; i++) {
			const c = template[i];
			if(quote !== undefined) {
				quote = c === '\\' ? (i++, quote) : c === quote ? undefined : quote;
			} else if(c === '"' || c === '\'' || c === '`') {
				quote = c;
			} else if(template.startsWith(open, i)) {
				depth++;
			} else if(template.startsWith(close, i)) {
				depth--;
			}
		}
		if(depth === 0) {
			const content = template.slice(from, i - close.length);
			if(markup && Markup.test(content)) {
				found.push(...interpolationsOf(content, open, close, markup));
			} else {
				found.push(content);
			}
		}
		at = i;
	}
	return found;
}

/** The delimiter a literal `.open`/`.close` argument asks for, the configured one when it is absent. */
function delimiterOf(bound: ReadonlyMap<string, { readonly value?: unknown }>, name: string, fallback: string): string {
	const value = bound.get(name)?.value as { type?: RType, content?: { str?: string } } | undefined;
	return value?.type === RType.String && value.content?.str !== undefined ? value.content.str : fallback;
}

/**
 * Processes a call whose string arguments are templates carrying R code, as `glue` and `cli` use them.
 * The code runs where the call is, reading and writing like anything written there, so that is how it is
 * analyzed. A template pointed at another scope is marked unknown instead.
 */
export function processStringTemplate<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: StringTemplateConfiguration
): DataflowInformation {
	const { information } = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.StringTemplate });
	/* these are only ever given by name, and matching them positionally would swallow the template itself */
	const named = new Map(args.filter(a => a !== EmptyArgument && a.name !== undefined)
		.map(a => [Identifier.getName((a as RArgument<OtherInfo & ParentInformation>).name?.content as Identifier), a as RArgument<OtherInfo & ParentInformation>]));
	if(RedirectingParameters.some(p => named.has(p))) {
		handleUnknownSideEffect(information.graph, information.environment, rootId);
		return information;
	}
	const open = delimiterOf(named, '.open', config.open ?? '{');
	const close = delimiterOf(named, '.close', config.close ?? '}');

	const results: DataflowInformation[] = [];
	for(const arg of args) {
		if(arg === EmptyArgument || arg.name !== undefined || arg.value?.type !== RType.String) {
			continue;
		}
		const template = arg.value;
		for(const code of interpolationsOf(template.content.str, open, close, config.markup)) {
			const generator = sourcedDeterministicCountingIdGenerator(`${name.lexeme}::${template.info.id}`, template.location);
			const result = sourceRequest(rootId, requestFromInput(code), data, information, false, generator);
			/* the template stands where the call does, so what it leaves open resolves against the bindings here */
			linkInputs([...result.in, ...result.unknownReferences], data.environment, [], result.graph, false);
			results.push(result);
		}
	}
	if(results.length === 0) {
		return information;
	}
	return {
		...information,
		graph:             results.reduce((acc, r) => acc.mergeWith(r.graph), information.graph),
		environment:       results.reduce((acc, r) => appendEnvironment(acc, r.environment), information.environment),
		in:                information.in.concat(results.flatMap(r => r.in)),
		out:               information.out.concat(results.flatMap(r => r.out)),
		unknownReferences: information.unknownReferences.concat(results.flatMap(r => r.unknownReferences)),
		hooks:             information.hooks.concat(results.flatMap(r => r.hooks))
	};
}
