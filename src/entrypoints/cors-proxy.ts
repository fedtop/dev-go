const PAGE_SOURCE = 'devgo-cors-proxy-page'
const CONTENT_SOURCE = 'devgo-cors-proxy-content'
const PROXY_METHODS = new Set([
  'DELETE',
  'OPTIONS',
  'PATCH',
  'PROPFIND',
  'PROPPATCH',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
])

interface ProxyRequest {
  url: string
  method: string
  headers: [string, string][]
  body?: string
  credentials?: RequestCredentials
  redirect?: RequestRedirect
}

interface ProxyResponse {
  url: string
  status: number
  statusText: string
  headers: [string, string][]
  body: string
  redirected: boolean
  error?: string
}

interface PendingRequest {
  resolve: (response: ProxyResponse) => void
  reject: (error: Error) => void
}

export default defineUnlistedScript(() => {
  const nativeFetch = window.fetch.bind(window)
  const NativeXMLHttpRequest = window.XMLHttpRequest
  const pendingRequests = new Map<string, PendingRequest>()
  let enabled = false
  let nextRequestId = 1

  function isHttpCrossOrigin(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.href)
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.origin !== window.location.origin
      )
    } catch {
      return false
    }
  }

  function shouldProxy(url: string, method: string, credentials: RequestCredentials): boolean {
    if (!enabled || !isHttpCrossOrigin(url)) return false
    return credentials === 'include' || PROXY_METHODS.has(method.toUpperCase())
  }

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 0x8000

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }

    return btoa(binary)
  }

  function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const buffer = new ArrayBuffer(binary.length)
    const bytes = new Uint8Array(buffer)

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }

    return buffer
  }

  async function bodyToBase64(body: BodyInit | null | undefined): Promise<string | undefined> {
    if (body == null) return undefined

    const request = new Request(window.location.href, {
      method: 'POST',
      body,
    })

    return arrayBufferToBase64(await request.arrayBuffer())
  }

  function sendProxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
    const id = String(nextRequestId)
    nextRequestId += 1

    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject })
      window.postMessage(
        {
          source: PAGE_SOURCE,
          type: 'request',
          id,
          request,
        },
        '*',
      )
    })
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== CONTENT_SOURCE) return

    if (event.data.type === 'state') {
      enabled = Boolean(event.data.enabled)
      return
    }

    if (event.data.type !== 'response') return

    const pending = pendingRequests.get(event.data.id)
    if (!pending) return

    pendingRequests.delete(event.data.id)
    pending.resolve(event.data.response)
  })

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const method = request.method.toUpperCase()
    const credentials = init?.credentials ?? request.credentials

    if (!shouldProxy(request.url, method, credentials)) {
      return nativeFetch(input, init)
    }

    const response = await sendProxyRequest({
      url: request.url,
      method,
      headers: Array.from(request.headers.entries()),
      body:
        method === 'GET' || method === 'HEAD'
          ? undefined
          : arrayBufferToBase64(await request.clone().arrayBuffer()),
      credentials,
      redirect: request.redirect,
    })

    if (response.error) {
      throw new TypeError(response.error)
    }

    const body = base64ToArrayBuffer(response.body)
    const nullBodyStatus =
      response.status === 204 || response.status === 205 || response.status === 304

    return new Response(nullBodyStatus ? null : body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }

  class DevGoXMLHttpRequest extends EventTarget {
    static UNSENT = 0

    static OPENED = 1

    static HEADERS_RECEIVED = 2

    static LOADING = 3

    static DONE = 4

    UNSENT = 0

    OPENED = 1

    HEADERS_RECEIVED = 2

    LOADING = 3

    DONE = 4

    onreadystatechange: ((event: Event) => void) | null = null

    onloadstart: ((event: Event) => void) | null = null

    onprogress: ((event: Event) => void) | null = null

    onabort: ((event: Event) => void) | null = null

    onerror: ((event: Event) => void) | null = null

    onload: ((event: Event) => void) | null = null

    ontimeout: ((event: Event) => void) | null = null

    onloadend: ((event: Event) => void) | null = null

    upload: XMLHttpRequestUpload

    private native = new NativeXMLHttpRequest()

    private usingProxy = false

    private method = 'GET'

    private requestUrl = ''

    private requestHeaders: [string, string][] = []

    private proxyReadyState = 0

    private proxyStatus = 0

    private proxyStatusText = ''

    private proxyResponseHeaders: [string, string][] = []

    private proxyResponse: unknown = null

    private proxyResponseText = ''

    private proxyResponseUrl = ''

    private proxyResponseType: XMLHttpRequestResponseType = ''

    private proxyTimeout = 0

    private proxyWithCredentials = false

    constructor() {
      super()
      this.upload = this.native.upload

      const events = [
        'readystatechange',
        'loadstart',
        'progress',
        'abort',
        'error',
        'load',
        'timeout',
        'loadend',
      ]

      events.forEach((type) => {
        this.native.addEventListener(type, () => this.emit(type))
      })
    }

    get readyState() {
      return this.usingProxy ? this.proxyReadyState : this.native.readyState
    }

    get response() {
      return this.usingProxy ? this.proxyResponse : this.native.response
    }

    get responseText() {
      return this.usingProxy ? this.proxyResponseText : this.native.responseText
    }

    get responseType() {
      return this.usingProxy ? this.proxyResponseType : this.native.responseType
    }

    set responseType(value: XMLHttpRequestResponseType) {
      this.proxyResponseType = value
      this.native.responseType = value
    }

    get responseURL() {
      return this.usingProxy ? this.proxyResponseUrl : this.native.responseURL
    }

    get responseXML() {
      return this.usingProxy ? null : this.native.responseXML
    }

    get status() {
      return this.usingProxy ? this.proxyStatus : this.native.status
    }

    get statusText() {
      return this.usingProxy ? this.proxyStatusText : this.native.statusText
    }

    get timeout() {
      return this.usingProxy ? this.proxyTimeout : this.native.timeout
    }

    set timeout(value: number) {
      this.proxyTimeout = value
      this.native.timeout = value
    }

    get withCredentials() {
      return this.usingProxy ? this.proxyWithCredentials : this.native.withCredentials
    }

    set withCredentials(value: boolean) {
      this.proxyWithCredentials = value
      this.native.withCredentials = value
    }

    abort() {
      if (!this.usingProxy) {
        this.native.abort()
        return
      }

      this.proxyStatus = 0
      this.proxyReadyState = DevGoXMLHttpRequest.DONE
      this.emit('readystatechange')
      this.emit('abort')
      this.emit('loadend')
    }

    getAllResponseHeaders() {
      if (!this.usingProxy) return this.native.getAllResponseHeaders()
      return this.proxyResponseHeaders.map(([name, value]) => `${name}: ${value}`).join('\r\n')
    }

    getResponseHeader(name: string) {
      if (!this.usingProxy) return this.native.getResponseHeader(name)
      const header = this.proxyResponseHeaders.find(
        ([key]) => key.toLowerCase() === name.toLowerCase(),
      )
      return header?.[1] ?? null
    }

    open(
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      this.method = method.toUpperCase()
      this.requestUrl = new URL(String(url), window.location.href).href
      this.requestHeaders = []
      this.proxyReadyState = DevGoXMLHttpRequest.OPENED
      this.native.open(method, url, async ?? true, username, password)
    }

    overrideMimeType(mime: string) {
      this.native.overrideMimeType(mime)
    }

    setRequestHeader(name: string, value: string) {
      this.requestHeaders.push([name, value])
      this.native.setRequestHeader(name, value)
    }

    send(body?: Document | XMLHttpRequestBodyInit | null) {
      const credentials = this.proxyWithCredentials ? 'include' : 'same-origin'

      if (!shouldProxy(this.requestUrl, this.method, credentials)) {
        this.native.withCredentials = this.proxyWithCredentials
        this.native.timeout = this.proxyTimeout
        this.native.responseType = this.proxyResponseType
        this.native.send(body)
        return
      }

      this.sendViaProxy(body).catch(() => {
        this.proxyStatus = 0
        this.proxyStatusText = ''
        this.proxyReadyState = DevGoXMLHttpRequest.DONE
        this.emit('readystatechange')
        this.emit('error')
        this.emit('loadend')
      })
    }

    private async sendViaProxy(body?: Document | XMLHttpRequestBodyInit | null) {
      this.usingProxy = true
      this.proxyReadyState = DevGoXMLHttpRequest.OPENED
      this.emit('loadstart')

      const response = await sendProxyRequest({
        url: this.requestUrl,
        method: this.method,
        headers: this.requestHeaders,
        body:
          this.method === 'GET' || this.method === 'HEAD'
            ? undefined
            : await bodyToBase64(body as BodyInit | null),
        credentials: this.proxyWithCredentials ? 'include' : 'same-origin',
        redirect: 'follow',
      })

      if (response.error) {
        throw new Error(response.error)
      }

      const buffer = base64ToArrayBuffer(response.body)
      const bytes = new Uint8Array(buffer)
      const text = new TextDecoder().decode(bytes)
      this.proxyStatus = response.status
      this.proxyStatusText = response.statusText
      this.proxyResponseHeaders = response.headers
      this.proxyResponseUrl = response.url
      this.proxyResponseText =
        this.proxyResponseType === 'arraybuffer' || this.proxyResponseType === 'blob' ? '' : text

      if (this.proxyResponseType === 'arraybuffer') {
        this.proxyResponse = buffer
      } else if (this.proxyResponseType === 'blob') {
        this.proxyResponse = new Blob([buffer])
      } else if (this.proxyResponseType === 'json') {
        this.proxyResponse = text ? JSON.parse(text) : null
      } else {
        this.proxyResponse = text
      }

      this.proxyReadyState = DevGoXMLHttpRequest.DONE
      this.emit('readystatechange')
      this.emit('load')
      this.emit('loadend')
    }

    private emit(type: string) {
      const event = new Event(type)
      this.dispatchEvent(event)

      const handler = this[`on${type}` as keyof DevGoXMLHttpRequest]
      if (typeof handler === 'function') {
        handler.call(this, event)
      }
    }
  }

  window.XMLHttpRequest = DevGoXMLHttpRequest as unknown as typeof XMLHttpRequest
})
