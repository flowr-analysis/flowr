import fs from 'node:fs'
import path from 'node:path'
import { guard } from '../../../assert'

export function makeFileMigrator(): (source: string, target: string) => void {
	const writeHandles = new Map<string, fs.WriteStream>()
	return function migrateFiles(sourceFolder: string, targetFolder: string) {
		if(!fs.existsSync(targetFolder)) {
			fs.mkdirSync(targetFolder, { recursive: true })
		}

		const files = fs.readdirSync(sourceFolder, { recursive: true })

		for(const f of files) {
			const source = path.join(sourceFolder, String(f))
			const target = path.join(targetFolder, String(f))

			// TODO: parallelize append and copy with an async and await all?
			if(fs.statSync(source).isDirectory()) {
				migrateFiles(source, target)
			} else if(fs.existsSync(target)) {
				// TODO: is there a faster way ?
				const targetStream = writeHandles.get(target)
				guard(targetStream !== undefined, () => `expected to have a write handle for ${target}`)
				targetStream.write(fs.readFileSync(source))
			} else {
				fs.copyFileSync(source, target)
				writeHandles.set(target, fs.createWriteStream(target, { flags: 'a' }))
			}
		}
	}
}

