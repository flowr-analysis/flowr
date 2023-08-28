import { StepFunction } from '../steps'

/**
 * Defines the output format of a step that you are interested in.
 */
export const enum StepOutputFormat {
	/**
	 * [Internal]
	 * This output format is special as it corresponds to whatever the step would normally produce - unchanged - as a typescript object.
	 * There is no special way to influence this output format, and it is not to be serialized.
	 */
	internal,
	/**
	 * A human-readable textual representation of the result. Depending on the step this may be of lesser use as the results
	 * of the dataflow analysis are not easily readable in text form.
	 */
	text,
	/**
	 * This is usually a one-to-one serialization of the internal format, although it is possible that some recursive references are broken.
	 */
	json,
	/**
	 * If possible, this will produce a mermaid graph of the result and contain the mermaid code.
	 * This is only really possible for some of the step (e.g., the dataflow analysis).
	 */
	mermaid,
	/**
	 * This is an extension of the {@link mermaid} format. Instead of returning
	 * the mermaid code, it will return an url to mermaid live.
	 */
	mermaidUrl
}

/**
 * Helper function to support the {@link internal} format, as it is simply returning the input.
 *
 * @see IStepPrinter
 */
export function internalPrinter<Input>(input: Input): Input {
	return input
}

/**
 * A mapping function that maps the result of a step (i.e., the dataflow graph)
 * to another representation (linked by {@link StepOutputFormat} in an {@link ISubStep}).
 */
export type IStepPrinter<StepInput extends StepFunction, Format extends StepOutputFormat, AdditionalInput extends unknown[]> =
	Format extends StepOutputFormat.internal ? (input: Awaited<ReturnType<StepInput>>) => Awaited<ReturnType<StepInput>> :
		(input: Awaited<ReturnType<StepInput>>, ...additional: AdditionalInput) => Promise<string>
