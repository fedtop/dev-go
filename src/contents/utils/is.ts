export const isHasReadmeDom = () => {
  if (!document) {
    return false;
  }
  
  const readmeInstance = document.getElementById('readme');

  return Boolean(readmeInstance)
}