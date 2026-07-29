import { Identifier, PkgName } from '../../../dataflow/environments/identifier';
import type { LinkedInputDeclaration, LinkedInputEntryPoint, LinkedInputObject, NarrowingFunction } from './simple-input-classifier';
import { InputType } from './simple-input-classifier';

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

export const NarrowingFunctions: readonly NarrowingFunction[] = [
	/* bounded by an argument: the result is one element of that argument */
	{ call: Identifier.from(['match.arg', PkgName.Base]), argName: 'choices', argIdx: 1 },
	/* bounded content-independent results (counts, indices, logicals): the subject's taint cannot flow through */
	...Identifier.fromAll(PkgName.Base, [
		'nchar', 'length', 'lengths', 'nrow', 'ncol', 'NROW', 'NCOL',
		'which', 'which.max', 'which.min', 'match', 'pmatch', 'charmatch',
		'seq_along', 'seq_len',
		'is.na', 'is.null', 'is.numeric', 'is.character', 'is.logical', 'is.function', 'is.list', 'is.element',
		'nzchar', 'grepl', 'startsWith', 'endsWith'
	]).map(call => ({ call }))
];

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

/*
 * The former `PureFunctions`, `SystemFunctions`, `FfiFunctions`, `LangFunctions`, `OptionsFunctions`,
 * `UserFunctions`, and `TempFileFunctions` lists now live with the functions themselves, as the `props` of
 * their entries in the `DefaultBuiltinConfig`. `DefaultInputClassifierConfig` reads them back from there
 * with `builtInsWith`.
 */
