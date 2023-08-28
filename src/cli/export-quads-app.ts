import { decorateAst, getStoredTokenMap, retrieveNormalizedAstFromRCode, RParseRequestFromFile, RShell } from '../r-bridge'
import { log } from '../util/log'
import { serialize2quads } from '../util/quads'
import fs from 'fs'
import { allRFilesFrom } from '../util/files'
import { processCommandLineArgs } from './common'

export interface QuadsCliOptions {
	verbose: boolean
	help:    boolean
	input:   string[]
	limit:   number
	output:  string | undefined
}

const options = processCommandLineArgs<QuadsCliOptions>('export-quads', [],{
	subtitle: 'Generate RDF N-Quads from the AST of a given R script',
	examples: [
		'{bold -i} {italic example.R} {bold --output} {italic "example.quads"}',
		'{bold --help}'
	]
})

const shell = new RShell()
shell.tryToInjectHomeLibPath()

async function writeQuadForSingleFile(request: RParseRequestFromFile, tokens: Record<string, string>, output: string) {
	const normalized = await retrieveNormalizedAstFromRCode({
		...request,
		attachSourceInformation: true,
		ensurePackageInstalled:  true
	}, tokens, shell)
	const serialized = serialize2quads(normalized.ast, { context: request.content })
	log.info(`Appending quads to ${output}`)
	fs.appendFileSync(output, serialized)
}

async function getQuads() {
	const tokens = await getStoredTokenMap(shell)
	const output = options.output ?? `out.quads`
	let skipped = 0
	for await (const request of allRFilesFrom(options.input, options.limit)) {
		try {
			await writeQuadForSingleFile(request, tokens, output)
		} catch(e: unknown) {
			log.error(`[Skipped] Error while processing ${request.content}: ${(e as Error).message} (${(e as Error).stack ?? ''})`)
			skipped++
		}
	}
	console.log(`Skipped ${skipped} files`)
	shell.close()
}

void getQuads()

