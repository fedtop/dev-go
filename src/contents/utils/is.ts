export const isGithubCodePage = (): boolean => {
  const url = window.location.href
  const fileNavigationInstance = document.querySelectorAll('.file-navigation')
  const isHasReadme = Boolean(document.getElementById('readme'))
  const isHasBlob = url.includes('/blob/')
  const isHasTree = url.includes('/tree/')
  const res = fileNavigationInstance.length > 0 || isHasBlob || isHasTree || isHasReadme

  return res
}

export const isHasWindow = (): boolean => {
  return Boolean(window)
}
