import fs from 'node:fs'
import path from 'node:path'
import { guard } from '../../../assert'

export class FileMigrator {
	private readonly writeHandles = new Map<string, fs.WriteStream>()
	private finished = false

	public async migrate(sourceFolderContent: Map<string,string>, targetFolder: string): Promise<void> {
		guard(!this.finished, () => 'migrator is already marked as finished!')
		if(!fs.existsSync(targetFolder)) {
			fs.mkdirSync(targetFolder, { recursive: true })
		}

		await Promise.all<Promise<void>[]>([...sourceFolderContent.entries()].map(([filepath, content]) => {
			const target = path.join(targetFolder, filepath)

			// TODO: is there a faster way ?
			let targetStream = this.writeHandles.get(target)
			if(targetStream === undefined) {
				targetStream = fs.createWriteStream(target, { flags: 'a' })
				this.writeHandles.set(target, targetStream)
			}
			return new Promise((resolve, reject) => {
				(targetStream as fs.WriteStream).write(content + '\n', 'utf-8', err => {
					if(err) {
						reject(err)
					} else {
						resolve()
					}
				})
			})
		}))
	}

	public finish() {
		for(const handle of this.writeHandles.values()) {
			handle.close()
		}
		this.finished = true
	}
}

