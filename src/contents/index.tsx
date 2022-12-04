export default function FunctionPage() {
  // TODO 使用组件库的提示
  // const [messageApi, contextHolder] = message.useMessage()
  function tip(msg: string) {
    alert(msg)
  }

  chrome.runtime.onMessage.addListener((message, sender, res) => {
    console.log('🚀🚀🚀 / message', message)
    const { type } = message
    switch (type) {
      case 'tip':
        tip(message.msg)
        break
      default:
        break
    }
  })
  return <></>
}
