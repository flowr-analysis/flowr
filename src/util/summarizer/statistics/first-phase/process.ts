import fs from 'fs'
import path from 'path'

export function migrateFiles(sourceFolder: string, targetFolder: string) {
	if(!fs.existsSync(targetFolder)) {
		fs.mkdirSync(targetFolder, { recursive: true })
	}

	const files = fs.readdirSync(sourceFolder, { recursive: true })

	for(const f of files) {
		const source = path.join(sourceFolder, String(f))
		// TODO: better skips
		if(source.includes('output-json')) {
			continue
		}
		const target = path.join(targetFolder, String(f))

		if(fs.statSync(source).isDirectory()) {
			migrateFiles(source, target)
		} else if(fs.existsSync(source)) {
			// TODO: is there a faster way ?
			const content = String(fs.readFileSync(source))
			// TODO: should have compacted paths...
			fs.appendFileSync(target, content)
		} else {
			fs.copyFileSync(source, target)
		}
	}
}
