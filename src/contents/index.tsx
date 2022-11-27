export default function FunctionPage() {
  // const [messageApi, contextHolder] = message.useMessage()
  function wip() {
    alert('开发中...')
  }
  chrome.runtime.onMessage.addListener((message, sender, res) => {
    const { type } = message
    switch (type) {
      case 'wip':
        wip()
        break
      case 'passTransNode':
        wip()
        break
      default:
        break
    }
  })
  return <></>
}
