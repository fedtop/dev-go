/**
 * Content-script safe settings helpers.
 *
 * WXT storage initializes eagerly and throws when a script accidentally runs
 * outside an extension context. Content scripts use the native Chrome storage
 * API here so they can fail closed instead of crashing on startup.
 */

export function hasExtensionRuntime(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

export async function getLocalBooleanSetting(key: string, fallback: boolean): Promise<boolean> {
  if (!hasExtensionRuntime() || !chrome.storage?.local) return fallback

  return new Promise((resolve) => {
    chrome.storage.local.get({ [key]: fallback }, (items) => {
      if (chrome.runtime.lastError) {
        resolve(fallback)
        return
      }
      const value = items[key]
      resolve(typeof value === 'boolean' ? value : fallback)
    })
  })
}

export function watchLocalBooleanSetting(
  key: string,
  fallback: boolean,
  onChange: (value: boolean) => void,
): () => void {
  if (!hasExtensionRuntime() || !chrome.storage?.onChanged) return () => undefined

  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local') return
    const change = changes[key]
    if (!change) return
    onChange(typeof change.newValue === 'boolean' ? change.newValue : fallback)
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
