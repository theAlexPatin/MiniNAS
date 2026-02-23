import { Hono } from 'hono'
import { getIdentity } from '../security/index.js'
import { getAccessibleVolumeIds } from '../services/access.js'
import { getVolumeStats } from '../services/filesystem.js'
import { getVolumes } from '../services/volumes.js'

const volumes = new Hono()

volumes.get('/', async (c) => {
	const { userId } = getIdentity(c)
	const accessibleIds = new Set(getAccessibleVolumeIds(userId))

	const results = await Promise.allSettled(
		getVolumes()
			.filter((v) => accessibleIds.has(v.id))
			.map((v) => getVolumeStats(v)),
	)

	const volumeInfos = results
		.filter(
			(r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getVolumeStats>>> =>
				r.status === 'fulfilled',
		)
		.map((r) => r.value)

	return c.json({ volumes: volumeInfos })
})

export default volumes
