import type { PlasmoContentScript } from "plasmo"

import { githubEditOnline } from "~script/github-edit-online"

export const config: PlasmoContentScript = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

// 仅当DOM加载完成时
window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed")
  githubEditOnline()
})
