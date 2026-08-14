const STORAGE_KEY = "tiktok-live-stream-profiles";

const form = document.getElementById("profile-form");
const nameInput = document.getElementById("profile-name");
const serverInput = document.getElementById("server-url");
const keyInput = document.getElementById("stream-key");
const toggleKeyBtn = document.getElementById("toggle-key");
const generateTestKeyBtn = document.getElementById("generate-test-key");
const profileList = document.getElementById("profile-list");
const emptyState = document.getElementById("empty-state");
const profileTemplate = document.getElementById("profile-template");

function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 4) return "•".repeat(key.length);
  return "•".repeat(key.length - 4) + key.slice(-4);
}

// Generates a random, clearly-fake stream key for local testing.
// This is NOT a valid TikTok stream key — TikTok only issues real
// keys through TikTok Live Center.
function generateTestKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `TEST-${hex}`;
}

function buildObsConfig(profile) {
  return [
    `# Configuración OBS para "${profile.name}"`,
    `# Generado por TikTok Live Stream Key Manager`,
    "",
    "Servicio: Personalizado (Custom)",
    `Servidor: ${profile.server}`,
    `Clave de transmisión: ${profile.key}`,
    "",
    profile.key.startsWith("TEST-")
      ? "NOTA: esta es una clave de PRUEBA, no válida para transmitir en TikTok."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = "¡Copiado!";
    setTimeout(() => (button.textContent = original), 1200);
  } catch {
    alert("No se pudo copiar automáticamente. Copia el valor manualmente.");
  }
}

function renderProfiles() {
  const profiles = loadProfiles();
  profileList.innerHTML = "";
  emptyState.style.display = profiles.length ? "none" : "block";

  profiles.forEach((profile) => {
    const node = profileTemplate.content.cloneNode(true);
    const card = node.querySelector(".profile-card");
    card.dataset.id = profile.id;

    node.querySelector(".profile-name").textContent = profile.name;
    node.querySelector(".profile-server").textContent = profile.server;

    const keyEl = node.querySelector(".profile-key");
    keyEl.textContent = maskKey(profile.key);
    keyEl.dataset.revealed = "false";

    node.querySelector(".reveal-btn").addEventListener("click", (e) => {
      const revealed = keyEl.dataset.revealed === "true";
      keyEl.textContent = revealed ? maskKey(profile.key) : profile.key;
      keyEl.dataset.revealed = String(!revealed);
    });

    node.querySelectorAll(".btn-copy").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.copy === "server" ? profile.server : profile.key;
        copyToClipboard(value, btn);
      });
    });

    node.querySelector(".download-btn").addEventListener("click", () => {
      const safeName = profile.name.replace(/[^a-z0-9-_]+/gi, "_");
      downloadTextFile(`obs-config-${safeName}.txt`, buildObsConfig(profile));
    });

    node.querySelector(".delete-btn").addEventListener("click", () => {
      if (!confirm(`¿Eliminar el perfil "${profile.name}"?`)) return;
      const updated = loadProfiles().filter((p) => p.id !== profile.id);
      saveProfiles(updated);
      renderProfiles();
    });

    profileList.appendChild(node);
  });
}

toggleKeyBtn.addEventListener("click", () => {
  keyInput.type = keyInput.type === "password" ? "text" : "password";
});

generateTestKeyBtn.addEventListener("click", () => {
  keyInput.value = generateTestKey();
  keyInput.type = "text";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const server = serverInput.value.trim();
  const key = keyInput.value.trim();

  if (!name || !server) return;

  const profiles = loadProfiles();
  profiles.push({
    id: crypto.randomUUID(),
    name,
    server,
    key: key || generateTestKey(),
    createdAt: new Date().toISOString(),
  });
  saveProfiles(profiles);

  form.reset();
  serverInput.value = "rtmp://push-rtmp.tiktokcdn.com/live/";
  keyInput.type = "password";
  renderProfiles();
});

renderProfiles();
