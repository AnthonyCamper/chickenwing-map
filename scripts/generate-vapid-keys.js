#!/usr/bin/env node

// ============================================================================
// Generate VAPID keys for web push notifications
//
// Usage:
//   node scripts/generate-vapid-keys.js
//
// Output:
//   VAPID public and private keys in base64url format.
//   Add these to your environment:
//     - VITE_VAPID_PUBLIC_KEY in .env.local (frontend)
//     - VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY as Supabase Edge Function secrets
// ============================================================================

import crypto from 'node:crypto'

// Generate an ECDSA P-256 key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-256',
})

// Export public key as uncompressed point (65 bytes)
const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' })
// The last 65 bytes of SPKI DER are the uncompressed public key point
const publicKeyRaw = publicKeyDer.slice(-65)

// Export private key as raw 32-byte scalar
const privateKeyDer = privateKey.export({ type: 'pkcs8', format: 'der' })
// Extract the 32-byte private key from PKCS8 DER
// The raw key starts after the ASN.1 header (byte at offset 36, length 32)
let rawPrivateKey
const keyData = privateKey.export({ type: 'sec1', format: 'der' })
// SEC1 format: 0x30 <len> 0x02 0x01 0x01 0x04 0x20 <32 bytes of private key> ...
const idx = keyData.indexOf(Buffer.from([0x04, 0x20]))
if (idx !== -1) {
  rawPrivateKey = keyData.slice(idx + 2, idx + 2 + 32)
} else {
  // Fallback: use PKCS8 format for the edge function
  rawPrivateKey = privateKeyDer
}

function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const publicKeyB64 = base64UrlEncode(publicKeyRaw)
const privateKeyB64 = base64UrlEncode(rawPrivateKey)

console.log('\n=== VAPID Keys Generated ===\n')
console.log('Public Key (base64url):')
console.log(publicKeyB64)
console.log('\nPrivate Key (base64url):')
console.log(privateKeyB64)
console.log('\n=== Setup Instructions ===\n')
console.log('1. Add to your .env.local file:')
console.log(`   VITE_VAPID_PUBLIC_KEY=${publicKeyB64}`)
console.log('\n2. Add as Supabase Edge Function secrets:')
console.log(`   supabase secrets set VAPID_PUBLIC_KEY=${publicKeyB64}`)
console.log(`   supabase secrets set VAPID_PRIVATE_KEY=${privateKeyB64}`)
console.log(`   supabase secrets set VAPID_SUBJECT=mailto:admin@wingmap.app`)
console.log('\n3. Add VITE_VAPID_PUBLIC_KEY to your GitHub Actions secrets')
console.log('\n4. Deploy the edge function:')
console.log('   supabase functions deploy send-push')
console.log('')
