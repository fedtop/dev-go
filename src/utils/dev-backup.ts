import { restoreBackup } from '@/utils/backup'

const DEV_BACKUP_MARKER_KEY = 'local:devBackupFingerprint'

function fingerprint(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33 + text.charCodeAt(i)) % 4294967291
  }
  return `${text.length}:${hash.toString(36)}`
}

function getDevBackupJson(): string | null {
  if (!import.meta.env.DEV) return null
  if (typeof DEVGO_BACKUP_JSON !== 'string') return null

  const text = DEVGO_BACKUP_JSON.trim()
  return text || null
}

export async function restoreDevBackupIfNeeded(): Promise<void> {
  const text = getDevBackupJson()
  if (!text) return

  const nextFingerprint = fingerprint(text)
  if ((await storage.getItem<string>(DEV_BACKUP_MARKER_KEY)) === nextFingerprint) return

  const { imported, skipped } = await restoreBackup(text)
  await storage.setItem(DEV_BACKUP_MARKER_KEY, nextFingerprint)

  console.info(
    `[DevGo] devgo-backup.json imported: ${imported} items${
      skipped.length > 0 ? `, skipped ${skipped.length}` : ''
    }`,
  )
}
