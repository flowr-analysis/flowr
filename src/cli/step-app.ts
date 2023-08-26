import { processCommandLineArgs } from './common'
import { stepOutputFormats } from './common/options'
import { retrieveXmlFromRCode, RParseRequest, RShell } from '../r-bridge'

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
	subtitle: 'Return the parsed AST of the given R file',
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

async function getSteps() {
	const shell = new RShell()
	shell.tryToInjectHomeLibPath()

	// we always have to parse the file
	const rAst = await retrieveXmlFromRCode(request, shell)

	console.log(rAst)

	shell.close()
}

void getSteps()

