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
			} else {
				// TODO: is there a faster way ?
				let targetStream = this.writeHandles.get(target)
				if(targetStream === undefined) {
					targetStream = fs.createWriteStream(target, { flags: 'a' })
					this.writeHandles.set(target, targetStream)
				}
				return new Promise((resolve, reject) => {
					const read = fs.createReadStream(source)
					read.on('close', resolve)
					read.on('error', reject)
					read.pipe(targetStream as fs.WriteStream, { end: false })
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

