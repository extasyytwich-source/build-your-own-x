import os from 'node:os';

// IPs de red local del equipo (Wi-Fi/Ethernet), para que el dueño pueda
// abrir el panel desde su teléfono conectado a la misma red. Se excluyen
// loopback y direcciones internas de Docker/VPN poco útiles para esto.
export function localNetworkIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}
