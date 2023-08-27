import { processCommandLineArgs } from './common'
import { stepAllowedSteps, stepOutputFormats } from './common/options'
import { retrieveXmlFromRCode, RParseRequest, RShell } from '../r-bridge'
import { guard } from '../util/assert'

export interface StepCliOptions {
	verbose:   boolean
	help:      boolean
	input:     string
	output:    string | undefined
	format:    typeof stepOutputFormats[number],
	step:      string, // for example typeof stepAllowedSteps[number];
	criterion: string | undefined
}


const options = processCommandLineArgs<StepCliOptions>('step', ['input', 'step'],{
	subtitle: 'Besides slicing, this returns the intermediate results of others steps',
	examples: [
		'{bold --step} {italic parse} {italic test/testfiles/example.R}',
		'{italic test/testfiles/example.R} {bold --format} {italic mermaid-url} {bold --step} {italic parse;normalize;reconstruct} ',
		'{bold --help}'
	]
})

// we decode what to read
const requestFromFile = options.input.startsWith('file:')
const request: RParseRequest = {
	request:                 requestFromFile ? 'file' : 'text',
	content:                 requestFromFile ? options.input.slice(5) : options.input,
	attachSourceInformation: true,
	ensurePackageInstalled:  true
}

const desiredSteps = new Set()
for(const potentialStep of options.step.split(';').map(s => s.trim().toLowerCase())) {
	guard((stepAllowedSteps as readonly string[]).includes(potentialStep), `Unknown step ${potentialStep}`)
	desiredSteps.add(potentialStep)
}

async function getSteps() {
	const shell = new RShell()
	shell.tryToInjectHomeLibPath()

	// we always have to parse the file
	const rAst = await retrieveXmlFromRCode(request, shell)


	shell.close()
}

void getSteps()

