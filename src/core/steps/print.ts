import { IStepPrinter, StepOutputFormat } from '../print/print'
import { guard } from '../../util/assert'
import { StepName, StepProcessor, STEPS } from './steps'
import { TailOfArray } from '../../util/arrays'


/**
 * For a `step` of the given name, which returned the given `data`. Convert that data into the given `format`.
 * Depending on your step and the format this may require `additional` inputs.
 */
export function printStepResult<
	Name extends StepName,
	Processor extends StepProcessor<Name>,
	Format extends Exclude<keyof(typeof STEPS)[Name]['printer'], StepOutputFormat.Internal> & number,
	Printer extends (typeof STEPS)[Name]['printer'][Format],
	AdditionalInput extends TailOfArray<Parameters<Printer>>,
>(step: Name, data: Awaited<ReturnType<Processor>>, format: Format, ...additional: AdditionalInput): Promise<string> {
	const base = STEPS[step].printer
	const printer = base[format as keyof typeof base] as IStepPrinter<StepProcessor<Name>, Format, AdditionalInput> | undefined
	guard(printer !== undefined, `printer for ${step} does not support ${String(format)}`)
	return printer(data, ...additional) as Promise<string>
}
