export function githubEditOnline() {
  // 获取当前页面的 url
  const url = window.location.href
  const nav =
    document.querySelector(".file-navigation") ||
    document.querySelector(".gh-header-actions")
  console.log("🚀🚀🚀 / nav", nav)

  // 判断是否为 github 的 code 页面
  if (!url.includes("github.com") || (url.includes("github.com") && !nav)) {
    return
  }
  const btn = document.createElement("BUTTON")
  btn.innerText = "在线编辑"
  btn.style.cssText = `
    color:white;
    color-scheme:dark;
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
    font-weight: bolder;
    font-size: 14px;
    margin-left: 8px !important;
    display: inline-block;
    padding: 5px 16px;
    line-height: 20px;
    white-space: nowrap;
    vertical-align: middle;
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
    border: 1px solid rgba(205, 217, 229, 0.1);
    border-radius: 6px;
    background: rgb(52, 125, 57);
    appearance: none;
    `
  btn.onclick = () => {
    window.open(`${`https://github1s.com${window.location.pathname}`}`)
  }
  nav.appendChild(btn)
}
