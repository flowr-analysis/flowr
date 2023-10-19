import fs from 'node:fs'
import path from 'node:path'
import { guard } from '../../../assert'

export class FileMigrator {
	private readonly writeHandles = new Map<string, fs.WriteStream>()
	private finished = false

	public migrate(sourceFolder: string, targetFolder: string): void {
		guard(!this.finished, () => 'migrator is already marked as finished!')
		if(!fs.existsSync(targetFolder)) {
			fs.mkdirSync(targetFolder, { recursive: true })
		}

		const files = fs.readdirSync(sourceFolder, { recursive: true })
		for(const f of files) {
			const source = path.join(sourceFolder, String(f))
			const target = path.join(targetFolder, String(f))

			// TODO: parallelize append and copy with an async and await all?
			if(fs.statSync(source).isDirectory()) {
				this.migrate(source, target)
			} else if(fs.existsSync(target)) {
				// TODO: is there a faster way ?
				const targetStream = this.writeHandles.get(target)
				guard(targetStream !== undefined, () => `expected to have a write handle for ${target}`)
				targetStream.write(fs.readFileSync(source))
			} else {
				fs.copyFileSync(source, target)
				this.writeHandles.set(target, fs.createWriteStream(target, { flags: 'a' }))
			}
		}
	}

	public finish() {
		for(const handle of this.writeHandles.values()) {
			handle.close()
		}
		this.finished = true
	}
}

