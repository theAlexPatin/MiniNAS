import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { getIdentity } from '../security/index.js'
import { canAccessVolume, getAccessibleVolumeIds } from '../services/access.js'
import { searchFiles, searchFilesInVolumes } from '../services/indexer.js'
import { SearchQuerySchema } from '../types/api.js'

const search = new Hono()

search.get('/', zValidator('query', SearchQuerySchema), async (c) => {
	const { userId } = getIdentity(c)
	const { q, volume } = c.req.valid('query')

	if (volume) {
		if (!canAccessVolume(userId, volume)) {
			return c.json({ results: [] })
		}
		const results = searchFiles(q, volume)
		return c.json({ results })
	}

	const accessibleIds = getAccessibleVolumeIds(userId)
	const results = searchFilesInVolumes(q, accessibleIds)
	return c.json({ results })
})

export default search
