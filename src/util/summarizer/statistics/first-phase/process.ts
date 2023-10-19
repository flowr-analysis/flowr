import fs from 'node:fs'
import path from 'node:path'

export function migrateFiles(sourceFolder: string, targetFolder: string) {
	if(!fs.existsSync(targetFolder)) {
		fs.mkdirSync(targetFolder, { recursive: true })
	}

	const files = fs.readdirSync(sourceFolder, { recursive: true })

	for(const f of files) {
		const source = path.join(sourceFolder, String(f))
		const target = path.join(targetFolder, String(f))

		if(fs.statSync(source).isDirectory()) {
			migrateFiles(source, target)
		} else if(fs.existsSync(source)) {
			// TODO: is there a faster way ?
			fs.appendFileSync(target, fs.readFileSync(source))
		} else {
			fs.copyFileSync(source, target)
		}
	}
}
