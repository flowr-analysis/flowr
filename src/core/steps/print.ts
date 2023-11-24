import { IStepPrinter, StepOutputFormat } from '../print/print'
import { guard } from '../../util/assert'
import { TailOfArray } from '../../util/arrays'
import { IStep } from './step'


/**
 * For a `step` of the given name, which returned the given `data`. Convert that data into the given `format`.
 * Depending on your step and the format this may require `additional` inputs.
 */
export function printStepResult<
	Step extends IStep,
	Processor extends Step['processor'],
	Format extends Exclude<keyof Step['printer'], StepOutputFormat.Internal> & number,
	Printer extends Step['printer'][Format],
	AdditionalInput extends TailOfArray<Parameters<Printer>>,
>(step: Step, data: Awaited<ReturnType<Processor>>, format: Format, ...additional: AdditionalInput): Promise<string> {
	const printer = step.printer[format] as IStepPrinter<Processor, Format, AdditionalInput> | undefined
	guard(printer !== undefined, `printer for ${step.name} does not support ${String(format)}`)
	return printer(data, ...additional) as Promise<string>
}
