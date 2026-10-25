import assert from 'node:assert/strict'
import test from 'node:test'

const networkModule = globalThis.process.env.DEVGO_NETWORK_MODULE

if (!networkModule) {
  throw new Error('DEVGO_NETWORK_MODULE is required')
}

const { buildNetworkPacScript, normalizeBypassList } = await import(networkModule)

function evaluatePac(profile, ruleList, host) {
  const { data } = buildNetworkPacScript(profile, ruleList)
  const FindProxyForURL = new Function(
    'dnsDomainIs',
    'isPlainHostName',
    `${data}; return FindProxyForURL`,
  )(
    (value, domain) => value === domain || value.endsWith(domain),
    (value) => !value.includes('.'),
  )

  return FindProxyForURL(`https://${host}/`, host)
}

const profile = {
  scheme: 'http',
  host: '127.0.0.1',
  port: 7890,
  bypassList: ['*.guazi.com'],
}

test('normalizes wildcard bypass domains and discards invalid entries', () => {
  assert.deepEqual(normalizeBypassList([' *.GUAZI.com ', 'invalid host', '*.guazi.com']), [
    '*.guazi.com',
  ])
})

test('preserves wildcard syntax when the browser URL API escapes the asterisk', () => {
  const NativeURL = globalThis.URL
  globalThis.URL = class {
    constructor(value) {
      return { hostname: new NativeURL(value).hostname.replace('*', '%2a') }
    }
  }

  try {
    assert.deepEqual(normalizeBypassList('*.guazi.com'), ['*.guazi.com'])
  } finally {
    globalThis.URL = NativeURL
  }
})

test('restores wildcard syntax from previously encoded bypass rules', () => {
  const NativeURL = globalThis.URL
  globalThis.URL = class {
    constructor(value) {
      return { hostname: new NativeURL(value).hostname.replace('*', '%2a') }
    }
  }

  try {
    assert.deepEqual(normalizeBypassList('%2A.GUAZI.COM'), ['*.guazi.com'])
  } finally {
    globalThis.URL = NativeURL
  }
})

test('bypasses subdomains but not the wildcard root domain', () => {
  assert.equal(evaluatePac(profile, '||guazi.com^', 'www.guazi.com'), 'DIRECT')
  assert.equal(evaluatePac(profile, '||guazi.com^', 'guazi.com'), 'PROXY 127.0.0.1:7890')
})

test('uses bypass rules before automatic-mode proxy rules', () => {
  assert.equal(evaluatePac(profile, '||api.guazi.com^', 'api.guazi.com'), 'DIRECT')
})
