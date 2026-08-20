import { Identifier, PkgName } from '../../../dataflow/environments/identifier';
import type { LinkedInputDeclaration, LinkedInputEntryPoint, LinkedInputObject, NarrowingFunction } from './simple-input-classifier';
import { InputType } from './simple-input-classifier';
import { ArgProp, CallProp } from '../../../dataflow/environments/built-in-props';
import { BuiltInIndex } from '../../../dataflow/environments/query-fn-props';

/** shiny's ui-side control widgets, all taking the id of the `input` entry they feed as their first argument */
const ShinyInputWidgets: LinkedInputDeclaration = {
	argName: 'inputId',
	argIdx:  0,
	calls:   Identifier.fromAll(PkgName.Shiny, [
		'actionButton', 'actionLink', 'checkboxInput', 'checkboxGroupInput', 'dateInput', 'dateRangeInput',
		'fileInput', 'numericInput', 'passwordInput', 'radioButtons', 'selectInput', 'selectizeInput',
		'sliderInput', 'submitButton', 'textAreaInput', 'textInput', 'varSelectInput', 'varSelectizeInput'
	])
};

/**
 * Objects that a framework binds for its users, without a definition visible in the code.
 * The `withParams` and `requires` guards keep ordinary functions that happen to have a parameter of the same
 * name out of this; where the framework is handed the function, {@link LinkedInputEntryPoints} is exact instead.
 * @see {@link LinkedInputObject}
 */
export const LinkedInputObjects: readonly LinkedInputObject[] = [
	/* shiny hands the server function its reactive `input` and `session` objects */
	{ name: 'input', type: InputType.User, withParams: ['output'], requires: 'shiny', declaredBy: ShinyInputWidgets },
	/* of the session only what the browser sends is user input, `userData` and `token` are the app's own */
	{ name: 'session', type: InputType.User, withParams: ['input', 'output'], requires: 'shiny', fields: ['clientData', 'request'] }
];

/**
 * The functions whose result is bounded no matter what flows in, read back from the {@link CallProp.Narrows}
 * built-ins: with an {@link ArgProp.Bounds} parameter the result is one of that argument's values (`match.arg`
 * and its `choices`), without one it is a count, an index, or a logical of the call's own making. Label a
 * built-in `Narrows` (in the {@link DefaultBuiltinConfig} or your own definitions) and it shows up here.
 */
export function narrowingFunctions(index: BuiltInIndex = BuiltInIndex.default()): readonly NarrowingFunction[] {
	const bounds = new Map(index.params(ArgProp.Bounds).map(p => [Identifier.getName(p.call), p]));
	return index.with(CallProp.Narrows).map(call => {
		const bound = bounds.get(Identifier.getName(call));
		return bound === undefined ? { call } : { call, argName: bound.name, argIdx: bound.index };
	});
}

/** shiny binds `input`, `output`, and `session` positionally, so their names are up to whoever writes the server */
const ShinyServerParams = ['input', undefined, 'session'];

/**
 * Calls that hand a function to a framework which binds its parameters by position.
 * @see {@link LinkedInputEntryPoint}
 */
export const LinkedInputEntryPoints: readonly LinkedInputEntryPoint[] = [
	{ call: Identifier.from(['shinyApp', PkgName.Shiny]),     argName: 'server', argIdx: 1, params: ShinyServerParams },
	{ call: Identifier.from(['shinyServer', PkgName.Shiny]),  argName: 'func',   argIdx: 0, params: ShinyServerParams },
	{ call: Identifier.from(['moduleServer', PkgName.Shiny]), argName: 'module', argIdx: 1, params: ShinyServerParams },
	{ call: Identifier.from(['callModule', PkgName.Shiny]),   argName: 'module', argIdx: 0, params: ShinyServerParams }
];
