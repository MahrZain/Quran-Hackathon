import { apiClient } from './apiClient'
import type { VerseBookmarkOut } from './apiTypes'

export async function fetchBookmarks(): Promise<VerseBookmarkOut[]> {
  const { data } = await apiClient.get<VerseBookmarkOut[]>('/bookmarks')
  return data
}

export async function createBookmarkApi(payload: {
  surah_id: number
  ayah_number: number
  note?: string | null
}): Promise<VerseBookmarkOut> {
  const { data } = await apiClient.post<VerseBookmarkOut>('/bookmarks', payload)
  return data
}

export async function deleteBookmarkApi(surah_id: number, ayah_number: number): Promise<void> {
  await apiClient.delete(`/bookmarks/${surah_id}/${ayah_number}`)
}
