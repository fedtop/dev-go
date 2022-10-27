export function githubEditOnline() {
  // 获取当前页面的 url
  const url = window.location.href
  // 判断是否为 github 的 code 页面
  console.log(
    "🚀🚀🚀 / githubEditOnline",
    url.split("github.com")[1].split("/").length !== 3,
    !url.includes("blob")
  )
  if (
    url.split("github.com")[1].split("/").length !== 3 &&
    !url.includes("blob")
  ) {
    return
  }
  const btn = document.createElement("BUTTON")
  btn.innerText = "在线编辑"
  btn.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 100px;
    // position: relative;
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
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    `
  //   document.querySelector(".file-navigation").appendChild(btn);
  /*
    // insert into DOM //
    // locate file navigation
    let nav = document.getElementsByClassName("file-navigation")[0] || document.getElementsByClassName("gh-header-actions")[0];

    // insert element
    if (nav !== undefined) {
        nav.append(a_element);
    }
  */
  document.body.appendChild(btn)
  btn.onclick = toOnlineEditor
  function toOnlineEditor() {
    window.open(`${`https://github1s.com${window.location.pathname}`}`)
  }
}
