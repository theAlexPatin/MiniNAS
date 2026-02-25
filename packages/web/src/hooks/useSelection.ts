import { useCallback, useState } from 'react'

export function useSelection() {
	const [selected, setSelected] = useState<Set<string>>(new Set())

	const toggle = useCallback((path: string) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(path)) {
				next.delete(path)
			} else {
				next.add(path)
			}
			return next
		})
	}, [])

	const selectAll = useCallback((paths: string[]) => {
		setSelected(new Set(paths))
	}, [])

	const clear = useCallback(() => {
		setSelected(new Set())
	}, [])

	const isSelected = useCallback((path: string) => selected.has(path), [selected])

	return { selected, toggle, selectAll, clear, isSelected, count: selected.size }
}
