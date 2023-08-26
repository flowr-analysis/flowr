import { processCommandLineArgs } from './common'
import { stepAllowedSteps, stepOutputFormats } from './common/options'

export interface StepCliOptions {
	verbose:   boolean
	help:      boolean
	input:     string
	output:    string | undefined
	format:    typeof stepOutputFormats[number],
	step:      typeof stepAllowedSteps[number],
	criterion: string | undefined
}


const options = processCommandLineArgs<StepCliOptions>('step', ['input', 'step'],{
	subtitle: 'Return the parsed AST of the given R file',
	examples: [
		'{italic test/testfiles/example.R}',
		'{italic test/testfiles/example.R} {bold --format} {italic mermaid-url}',
		'{bold --help}'
	]
})

async function gerParse() {
	// TODO: do :D
}

void gerParse()

