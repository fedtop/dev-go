/**
 * 后台存储迁移：整个 Service Worker 生命周期只跑一次。
 */

import { migrateStorage } from '@/utils/settings'

let storageMigration: Promise<void> | null = null

/** 存储迁移只跑一次；失败后允许下次重试 */
export function ensureStorageMigrated(): Promise<void> {
  storageMigration ??= migrateStorage().catch((error: unknown) => {
    storageMigration = null
    throw error
  })
  return storageMigration
}
