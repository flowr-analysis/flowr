import fs from 'node:fs'
import path from 'node:path'
import { guard } from '../../../assert'

export class FileMigrator {
	private readonly writeHandles = new Map<string, fs.WriteStream>()
	private finished = false

	public async migrate(sourceFolder: string, targetFolder: string): Promise<void> {
		guard(!this.finished, () => 'migrator is already marked as finished!')
		if(!fs.existsSync(targetFolder)) {
			fs.mkdirSync(targetFolder, { recursive: true })
		}

		const files = fs.readdirSync(sourceFolder, { recursive: true })
		await Promise.all<Promise<void>[]>(files.map(f => {
			const source = path.join(sourceFolder, String(f))
			const target = path.join(targetFolder, String(f))

			// TODO: parallelize append and copy with an async and await all?
			if(fs.statSync(source).isDirectory()) {
				return this.migrate(source, target)
			} else if(fs.existsSync(target)) {
				// TODO: is there a faster way ?
				const targetStream = this.writeHandles.get(target)
				guard(targetStream !== undefined, () => `expected to have a write handle for ${target}`)
				return new Promise((resolve, reject) => {
					const read = fs.createReadStream(source)
					read.on('close', resolve)
					read.on('error', reject)
					read.pipe(targetStream, { end: false })
				})
			} else {
				return new Promise(resolve => {
					fs.copyFile(source, target, () => {
						this.writeHandles.set(target, fs.createWriteStream(target, { flags: 'a' }))
						resolve()
					})
				})
			}
		}))
	}

	public finish() {
		for(const handle of this.writeHandles.values()) {
			handle.close()
		}
		this.finished = true
	}
}

