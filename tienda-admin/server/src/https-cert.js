import fs from 'node:fs';
import path from 'node:path';
import selfsigned from 'selfsigned';
import { dataDir } from './db.js';
import { localNetworkIps } from './network.js';

const certPath = path.join(dataDir, 'local-cert.pem');
const keyPath = path.join(dataDir, 'local-key.pem');
const metaPath = path.join(dataDir, 'local-cert.json');

function currentHosts() {
  return ['127.0.0.1', ...localNetworkIps()];
}

function cachedCertCoversHosts(hosts) {
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(metaPath)) return false;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return hosts.every((ip) => meta.ips.includes(ip));
  } catch {
    return false;
  }
}

// Se genera una sola vez por conjunto de IPs y se reutiliza entre arranques:
// si cambiara en cada inicio, el teléfono tendría que volver a aceptar la
// advertencia de seguridad del navegador cada vez que se abre el programa.
// Si la computadora recibe una IP de red nueva (otro router, otra red Wi-Fi),
// se regenera para incluirla en el certificado.
export async function getOrCreateHttpsCert() {
  const hosts = currentHosts();
  if (cachedCertCoversHosts(hosts)) {
    return { cert: fs.readFileSync(certPath, 'utf8'), key: fs.readFileSync(keyPath, 'utf8') };
  }

  const altNames = [{ type: 2, value: 'localhost' }, ...hosts.map((ip) => ({ type: 7, ip }))];
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'panel-de-la-tienda.local' }], {
    days: 3650,
    keySize: 2048,
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'subjectAltName', altNames },
    ],
  });

  fs.writeFileSync(certPath, pems.cert, { mode: 0o600 });
  fs.writeFileSync(keyPath, pems.private, { mode: 0o600 });
  fs.writeFileSync(metaPath, JSON.stringify({ ips: hosts }), { mode: 0o600 });
  return { cert: pems.cert, key: pems.private };
}
