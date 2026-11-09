import type { GeneralDocContext } from '../../wiki-mk/doc-context';
import type { KnownParser } from '../../../r-bridge/parser';
import { printDfGraphForCode } from '../../doc-util/doc-dfg';
import { codeBlock } from '../../doc-util/doc-code';
import { AmbientFamilyInfo, AmbientVerbInfo, type AmbientFamilyName, type AmbientVerb } from '../../../dataflow/environments/ambient-effect';
import { statedSignatureOf, statedSignatures } from '../../../dataflow/environments/default-builtin-config';
import type { BrandedIdentifier } from '../../../dataflow/environments/identifier';

/** a function's ambient accesses as a list, generated from its declaration */
function summaryOf(stated: ReturnType<typeof statedSignatures>, name: BrandedIdentifier): string {
	const families = statedSignatureOf(stated, name)?.ambient ?? [];
	return families.map(f => `${f.label}: ${f.accesses.map(a => `${a.label}${a.members.length > 0 ? ` (${a.members.join(', ')})` : ''}${a.when.length > 0 ? ` ${a.when.join(', ')}` : ''}`).join('; ')}`).join(' / ');
}

/** The wiki section on how ambient state is declared in the built-in configuration and tracked in the dataflow graph. */
export async function ambientStateSection(parser: KnownParser, ctx: GeneralDocContext): Promise<string> {
	const stated = statedSignatures();
	const families = Object.entries(AmbientFamilyInfo) as [AmbientFamilyName, typeof AmbientFamilyInfo[AmbientFamilyName]][];
	const verbs = Object.entries(AmbientVerbInfo) as [AmbientVerb, typeof AmbientVerbInfo[AmbientVerb]][];
	const examples: readonly BrandedIdentifier[] = ['png', 'plot', 'points', 'curve', 'dev.off', 'par', 'palette', 'sink', 'print', 'paste', 'options', 'getOption', 'Sys.setenv', 'set.seed', 'runif', 'setwd'];
	return `
#### Declaring Ambient State

Every built-in states what it does to the global state in the default built-in configuration (${ctx.link('DefaultBuiltinConfig')}) as a list of ${ctx.link('AmbientEffect')}s.
An effect names a part of the state (its family), what the call does to it (its verb), and optionally the entries it is about (its member) and the arguments it depends on (\`when\` and \`unless\`).
The shorthands in ${ctx.link('Ambient')} keep each declaration to one line, so \`points\` adds to the plot and reads the graphics parameters and the palette, and \`sink\` opens a diversion unless it has no file and closes one otherwise:

${codeBlock('ts', `/* shared-configs.ts */
const BasePlot = [Ambient.par.reads, Ambient.palette.reads] as const;
export const AddsToPlot = [Ambient.plot.adds, ...BasePlot] as const;
export const MayAddToPlot = [{ ...Ambient.plot.adds, when: { flag: 'add' } }, { ...Ambient.plot.resets, unless: { flag: 'add' } }, ...BasePlot] as const;
/* graphics-devices.ts */
fn(pkg(PkgName.GrDevices, 'dev.off'), BuiltInProcName.Default, { ambient: Ambient.device.closes, ... })
/* base-functions.ts */
fn(base('getOption'), BuiltInProcName.Default, { ambient: { ...Ambient.option.reads, member: { from: 'parameter', signature: ['x', 'default'], names: ['x'] } }, ... })`)}

The families and verbs, with the words the signature browser shows for them (both come from ${ctx.link('AmbientFamilyInfo')} and ${ctx.link('AmbientVerbInfo')}):

| Family | Label | What it is |
|---|---|---|
${families.map(([family, words]) => `| \`${family}\` | ${words.label} | ${words.description} |`).join('\n')}

| Verb | Label | What it means |
|---|---|---|
${verbs.map(([verb, words]) => `| \`${verb}\` | ${words.label} | ${words.description} |`).join('\n')}

A member says which entries of a keyed family the call is about: a constant list (\`print\` reads \`digits\`, \`scipen\`, and others), the names of the arguments (\`Sys.setenv(A = "1")\`), the unnamed arguments, or the argument of a parameter (\`Sys.getenv("HOME")\`).
For an instance family, the member \`every\` stands for every open instance, as \`dev.cur()\` reports.
A condition is \`no-arguments\`, \`query\` (only unnamed strings, as in \`par("mar")\`), a logical flag (\`add = TRUE\`), an argument for a formal with given values (\`type = "message"\`), or arguments beyond the leading formals (a kind for \`set.seed\`).
What the arguments do not decide, as a flag held in a variable, makes the effect a maybe one.
Tags imply more effects (see ${ctx.link('withImpliedAmbient')}): a call tagged as reading or writing a file accesses the files its resource arguments name, an appending write (an \`append\` formal set to \`TRUE\`) reads them first, and a printing call adds to the output sink.

To declare a new function, add its effects to its \`ambient\` field. To add a family, give it an ${ctx.link('AmbientPart')}, a row in ${ctx.link('AmbientFamilyInfo')}, and the pseudo variable it lives in, in the table of families of ${ctx.linkFile('applyAmbientEffects')}.
${ctx.link('ambientSummaryOf')} turns the declaration back into words, which is how these declarations read:

${examples.map(name => `- \`${name}\`: ${summaryOf(stated, name)}`).join('\n')}

#### Tracking Ambient State

Each part lives in global pseudo variables whose names start with \`#\` (${ctx.link('AmbientStateName')}), so a read links to the calls that may have set it like any variable read does.
Writes to accumulating parts (the plot, the output of a sink, the files, all options at once) are maybe definitions, so merging branches and loops keeps every one of them, while a reset (a new plot) or a write of a single entry (\`options(digits = 3)\` writes \`#option:digits\`) replaces what came before.
The graphics devices, the output sinks, and the message sink are instance families (${ctx.link('GraphicsDevices')}, ${ctx.link('OutputSinks')}, ${ctx.link('MessageSinks')}): every open instance has its own copy of the states, opening one moves the current copy to \`:other\`, and closing it brings another one back.
A close reads everything the closed instance holds, its opener and every drawing or printing in between, and it records the states it ends as \`kills\`.
The opener in turn reads the close, so a slice keeping the call that names the file also keeps the call that finishes it:

${await printDfGraphForCode(parser, 'png("a.png")\nplot(1)\npoints(2)\ndev.off()', { ctx })}

A call through a parameter, \`do.call\`, or an apply function runs with arguments flowR cannot see. Then every condition may hold, a reset only adds, nothing is known to be removed, and a close may close any instance.
A call to a function flowR knows nothing about reads all options, the environment variables, the random number generator (which it may advance), and with a graphics tag the graphics state.
A built-in generic that dispatches to a method of the program (\`print(x)\` running \`print.foo\`) changes the state as the calls within that method do, which slicing follows.
\`getOption("k")\` hands back the value the option was surely set to before, so value resolution sees \`3\` after \`options(k = 3)\`.

The rules come from comparing slices with the original programs in R, among them: printing a value of a class with a method of the program prints what the method prints, messages and warnings go to a sink of their own, \`sink(type = "output")\` closes like \`sink()\`, an appending write keeps what was written before, and \`invisible(...)\` stays around a kept call so a slice prints no more than the program.
`;
}
