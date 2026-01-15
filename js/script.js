const hiddenInput = document.getElementById("hiddenInput");
const convertAllBtn = document.getElementById("convertAll");
const languageSelect = document.getElementById("languageSelect");

const VERSION = "1.0.1";
const versionEl = document.querySelector(".version");
versionEl.textContent = `v. ${VERSION}`;

const BASE_PATH = "/hytale-translation-converter";

const languages = [
  { name: "Português Brasileiro", code: "pt-BR", percent: 100 },
];
const container = document.getElementById("downloads");

languages.forEach(lang => {
  const block = document.createElement("div");
  block.className = "block";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = `${lang.name} (${lang.percent}%)`;
  const link = document.createElement("a");
  link.href = `${getBasePath()}/files/${lang.code}.zip`;
  link.download = `${lang.code}.zip`;
  link.textContent = `Download ${lang.name}`;
  link.style.display = "block";

  link.addEventListener("click", () => {
    gtag('event', 'file_download', {
      'file_extension': 'zip',
      'file_name': `${lang.code}.zip`,
      'language_name': lang.name,
      'link_url': link.href
    });
  });

  block.appendChild(title);
  block.appendChild(link);

  container.appendChild(block); 
});

const state = {
  client: { json: null, lang: null },
  server: { json: null, lang: null }
};

const REQUIRED_FILENAMES = {
  "client-json": "client.json",
  "client-lang": "client.lang",
  "server-json": "server.json",
  "server-lang": "server.lang"
};

function getBasePath() {
  if (window.location.hostname.includes("github.io")) {
    return BASE_PATH;
  }
  return "";
}

function readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsText(file);
  });
}

async function fetchFallbackLang(path) {
  // Prepend the correct base path automatically
  const fullPath = `${getBasePath()}${path.startsWith("/") ? "" : "/"}${path}`;
  
  const response = await fetch(fullPath);
  if (!response.ok) throw new Error(`Failed to load fallback lang: ${fullPath}`);
  
  return await response.text();
}

function updateConvertButton() {
  convertAllBtn.disabled = !(
    state.client.json || state.server.json
  );
}

function jsonToLangFromOriginal(originalLangText, translations) {
  const originalLines = originalLangText.split(/\r?\n/);
  const output = [];
  let i = 0;

  while (i < originalLines.length) {
    const line = originalLines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      output.push(line);
      i++;
      continue;
    }

    if (/^\S+\s*=/.test(line)) {
      const eq = line.indexOf("=");
      const key = line.slice(0, eq).trim();

      const block = [];
      let current = line;
      block.push(current);

      while (current.trim().endsWith("\\")) {
        i++;
        current = originalLines[i];
        block.push(current);
      }

      if (translations.hasOwnProperty(key)) {
        const valueLines = translations[key].split("\n");
        valueLines.forEach((v, idx) => {
          output.push(idx === 0 ? `${key} = ${v}` : v);
        });
      } else {
        output.push(...block);
      }

      i++;
      continue;
    }

    output.push(line);
    i++;
  }

  return output.join("\n");
}

document.querySelectorAll(".drop-box").forEach(box => {
  const type = box.dataset.type;

  box.addEventListener("click", () => {
    hiddenInput.accept = type.includes("json") ? ".json" : ".lang";
    hiddenInput.onchange = e => handleFile(type, e.target.files[0], box);
    hiddenInput.click();
  });

  box.addEventListener("dragover", e => {
    e.preventDefault();
    box.classList.add("dragover");
  });

  box.addEventListener("dragleave", () => box.classList.remove("dragover"));

  box.addEventListener("drop", e => {
    e.preventDefault();
    box.classList.remove("dragover");
    handleFile(type, e.dataTransfer.files[0], box);
  });
});

async function handleFile(type, file, box) {
  if (!file) return;

  const requiredName = REQUIRED_FILENAMES[type];

  if (file.name !== requiredName) {
    box.classList.add("error");
    setTimeout(() => box.classList.remove("error"), 800);

    alert(`Invalid file.\nExpected: ${requiredName}`);
    return;
  }

  const [scope, kind] = type.split("-");

  const content = await readFile(file);

  if (kind === "json") {
    try {
      state[scope].json = JSON.parse(content);
      updateConvertButton();
    } catch {
      alert("Invalid JSON file.");
      return;
    }
  } else {
    state[scope].lang = content;
  }

  box.textContent = file.name;
  box.classList.add("loaded");
}

async function convertScope(scope, fallbackPath, outputName) {
  const json = state[scope].json;
  let lang = state[scope].lang;

  if (!json) return;

  if (!lang) {
    lang = await fetchFallbackLang(fallbackPath);
  }

  const result = jsonToLangFromOriginal(lang, json);

  downloadFile(result, outputName);
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

convertAllBtn.addEventListener("click", async () => {
  gtag('event', 'convert_files', {
    'event_category': 'conversion',
    'event_label': 'Language Converter',
    'target_language': languageSelect.value // Optional: track which language was selected
  });
  // Client
  await convertScope(
    "client",
    "/source/client.lang",
    "client.translated.lang"
  );

  // Server
  await convertScope(
    "server",
    "/source/server.lang",
    "server.translated.lang"
  );

  // Meta.lang
  const language = languageSelect.value;
  if (language) {
    downloadFile(`name = ${language}`, "meta.lang");
  }
});

document.addEventListener("click", function (event) {
  const target = event.target.closest(".copy");
  if (!target) return;

  const textToCopy = target.innerText;

  navigator.clipboard.writeText(textToCopy).then(() => {
    showCopiedTooltip(target);
  }).catch(err => {
    console.error("Failed to copy text:", err);
  });
});

function showCopiedTooltip(element) {
  const tooltip = document.createElement("span");
  tooltip.className = "copy-tooltip";
  tooltip.textContent = "Copied";

  element.appendChild(tooltip);

  requestAnimationFrame(() => tooltip.classList.add("show"));

  setTimeout(() => {
    tooltip.classList.remove("show");
    tooltip.addEventListener("transitionend", () => tooltip.remove(), { once: true });
  }, 1200);
}


let hash = document.location.hash;
if (hash) {
  document.querySelectorAll('.tabs-content .tabs a[href="' + hash + '"]')[0].click();
}
function tabContent(element) {
  const tabbedContent = document.querySelector(element);
  const tabLinks = tabbedContent.querySelectorAll(".tabs a");
  if (tabLinks.length > 0) {
    tabLinks[0].classList.add("active");
  }

  tabLinks.forEach(tablink => tablink.addEventListener("click", e => {
    tabLinks.forEach(tab => tab.classList.remove("active"));
    tablink.classList.add("active");
    tabbedContent.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    tabbedContent.querySelector(tablink.getAttribute('href')).classList.add("active");
  }));
}
tabContent(".tabs-content");