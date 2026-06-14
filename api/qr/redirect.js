'use strict';

function decodeBase64Url(value) {
  let base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

function parsePayload(encoded) {
  if (!encoded) return null;
  try {
    const decoded = decodeBase64Url(encoded);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function isAppleStoreUrl(url) {
  return /apps\.apple\.com|itunes\.apple\.com|itms-apps:/i.test(url);
}

function isGooglePlayUrl(url) {
  return /play\.google\.com\/store|market:\/\//i.test(url);
}

function isAllowedRedirectUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'itms-apps:', 'market:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function pickTarget(payload, userAgent) {
  const ios = String(payload?.i || '').trim();
  const android = String(payload?.a || '').trim();
  const fallback = String(payload?.f || '').trim();

  const smartLinks = [ios, android].filter(Boolean);
  const appleStoreUrl = smartLinks.find((url) => isAppleStoreUrl(url)) || '';
  const playStoreUrl = smartLinks.find((url) => isGooglePlayUrl(url)) || '';
  const genericUrl = smartLinks.find((url) => !isAppleStoreUrl(url) && !isGooglePlayUrl(url)) || '';

  const ua = String(userAgent || '');
  const hasAndroidSignal = /android/i.test(ua);
  const hasAppleSignal = /iPhone|iPad|iPod|iOS|Macintosh/i.test(ua);
  const hasWindowsPhoneSignal = /Windows Phone/i.test(ua);
  const isStrictAndroid = hasAndroidSignal && !hasAppleSignal && !hasWindowsPhoneSignal;

  if (isStrictAndroid) {
    return playStoreUrl || genericUrl || fallback || android || ios;
  }

  return appleStoreUrl || genericUrl || fallback || ios || android;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const encoded = typeof req.query?.d === 'string'
    ? req.query.d
    : Array.isArray(req.query?.d)
      ? req.query.d[0]
      : '';

  const payload = parsePayload(encoded);
  if (!payload) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid dynamic payload' }));
    return;
  }

  const target = pickTarget(payload, req.headers['user-agent']);
  if (!target || !isAllowedRedirectUrl(target)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'No valid redirect URL found' }));
    return;
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.end();
};
