import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';

const outputDir = resolve(process.argv[2] || process.env.JWT_KEY_DIR || './secrets/jwt');
const overwrite = process.argv.includes('--overwrite');

const files = [
  { name: 'access-current', private: 'access-current-private.pem', public: 'access-current-public.pem' },
  { name: 'refresh-current', private: 'refresh-current-private.pem', public: 'refresh-current-public.pem' },
  { name: 'action-current', private: 'action-current-private.pem', public: 'action-current-public.pem' }
];

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true, mode: 0o700 });
}

for (const file of files) {
  const privatePath = resolve(outputDir, file.private);
  const publicPath = resolve(outputDir, file.public);
  if (!overwrite && (existsSync(privatePath) || existsSync(publicPath))) {
    throw new Error(`Refusing to overwrite existing key material: ${privatePath}`);
  }
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicKeyEncoding: { format: 'pem', type: 'spki' },
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' }
  });
  writeFileSync(privatePath, privateKey, { mode: 0o600 });
  writeFileSync(publicPath, publicKey, { mode: 0o644 });
  console.log(`Wrote ${file.name} key pair to ${outputDir}`);
}

console.log('');
console.log('Suggested kids:');
console.log(`JWT_ACCESS_KID=access-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`);
console.log(`JWT_REFRESH_KID=refresh-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`);
console.log(`JWT_ACTION_KID=action-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`);
