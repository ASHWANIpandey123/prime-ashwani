// script.js — behavior: lazy embeds, YouTube fetch (optional), modal player, contact fallback.
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  setupHeader();
  wireHero();
  renderPlaceholders();
  applyConfigLinks();
  setupContactForm();
  if (CONFIG.YOUTUBE_API_KEY && CONFIG.YOUTUBE_CHANNEL_ID) {
    fetchYouTubeVideos().then(populateVideos).catch(() => populateVideos([]));
  }
});

// Header mobile toggle
function setupHeader() {
  const toggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("mobile-menu");
  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    if (menu) {
      menu.hidden = !menu.hidden;
    }
  });
}

// Wire hero play & button
function wireHero() {
  const hero = document.getElementById("hero-thumb");
  const watchBtn = document.getElementById("watch-latest");
  hero?.addEventListener("click", openLatestVideoModal);
  hero?.addEventListener("keydown", (e) => { if (e.key === "Enter") openLatestVideoModal(); });
  watchBtn?.addEventListener("click", openLatestVideoModal);

  // Modal close handling
  document.getElementById("modal-close")?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

// Render placeholder tiles
function renderPlaceholders() {
  const grid = document.getElementById("videos-grid");
  grid.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const div = document.createElement("div");
    div.className = "tile";
    div.innerHTML = `
      <img src="assets/thumbnail-placeholder.jpg" alt="Video placeholder" loading="lazy">
      <div class="body">
        <div class="title">Video Title ${i+1}</div>
        <div class="meta">Placeholder</div>
      </div>
    `;
    grid.appendChild(div);
  }
}

// Apply links from config
function applyConfigLinks() {
  document.title = CONFIG.SITE_TITLE;
  document.getElementById("subscribe-btn").href = CONFIG.YOUTUBE_CHANNEL_URL || "#";
  document.getElementById("youtube-channel").href = CONFIG.YOUTUBE_CHANNEL_URL || "#";
  document.getElementById("yt-link").href = CONFIG.YOUTUBE_CHANNEL_URL || "#";
  document.getElementById("tw-link").href = `https://twitch.tv/${CONFIG.TWITCH_CHANNEL}` || "#";
  document.getElementById("dc-link").href = "#";
  document.getElementById("merch-link").href = CONFIG.MERCH_URL || "#";
  const mailBtn = document.getElementById("mailto-btn");
  if (mailBtn) mailBtn.addEventListener("click", () => { window.location.href = `mailto:${CONFIG.CONTACT_EMAIL}`; });
}

// Fetch YouTube uploads (requires API key + channel ID)
async function fetchYouTubeVideos() {
  const key = CONFIG.YOUTUBE_API_KEY;
  const channelId = CONFIG.YOUTUBE_CHANNEL_ID;
  const chUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${key}`;
  const chRes = await fetch(chUrl);
  if (!chRes.ok) throw new Error("Channel fetch failed");
  const chData = await chRes.json();
  const uploads = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("Uploads playlist not found");
  const listUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${uploads}&key=${key}`;
  const listRes = await fetch(listUrl);
  if (!listRes.ok) throw new Error("Playlist fetch failed");
  const listData = await listRes.json();
  return listData.items || [];
}

// Populate videos grid
function populateVideos(items) {
  const grid = document.getElementById("videos-grid");
  grid.innerHTML = "";
  if (!items || items.length === 0) {
    renderPlaceholders();
    return;
  }
  items.forEach(it => {
    const s = it.snippet;
    const vid = s.resourceId?.videoId || (s?.thumbnails ? s.thumbnails.default.url : "");
    const thumb = s.thumbnails?.high?.url || s.thumbnails?.default?.url || "assets/thumbnail-placeholder.jpg";
    const title = s.title;
    const date = new Date(s.publishedAt).toLocaleDateString();
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `
      <img src="${thumb}" alt="${title}" loading="lazy" data-vid="${vid}">
      <div class="body">
        <div class="title">${title}</div>
        <div class="meta">${date}</div>
      </div>
    `;
    tile.querySelector("img")?.addEventListener("click", () => openVideoModal(vid));
    grid.appendChild(tile);
  });

  // Set hero thumbnail from first video
  const first = items[0];
  if (first) {
    const t = first.snippet.thumbnails?.maxres?.url || first.snippet.thumbnails?.high?.url || first.snippet.thumbnails?.default?.url;
    const heroImg = document.querySelector("#hero-thumb img");
    if (heroImg && t) heroImg.src = t;
  }
}

// Open modal for the latest video (attempts API then fallback)
async function openLatestVideoModal() {
  let vid = null;
  if (CONFIG.YOUTUBE_API_KEY && CONFIG.YOUTUBE_CHANNEL_ID) {
    try {
      const items = await fetchYouTubeVideos();
      vid = items?.[0]?.snippet?.resourceId?.videoId || null;
    } catch (e) {
      console.warn("YT latest fetch failed", e);
    }
  }
  if (!vid) {
    // try to find from grid thumbnail data attribute
    const thumb = document.querySelector("#videos-grid img[data-vid]");
    vid = thumb?.getAttribute("data-vid") || null;
  }
  if (!vid) {
    alert("Latest video not available. Visit the YouTube channel.");
    window.open(CONFIG.YOUTUBE_CHANNEL_URL || "#", "_blank", "noopener");
    return;
  }
  openVideoModal(vid);
}

// Open video modal by id (lazy-load iframe)
function openVideoModal(vidId) {
  const modal = document.getElementById("video-modal");
  const player = document.getElementById("player");
  if (!modal || !player) return;
  player.innerHTML = `<iframe width="100%" height="520" src="https://www.youtube.com/embed/${vidId}?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen title="YouTube video player"></iframe>`;
  modal.setAttribute("aria-hidden", "false");
}

// Close modal and remove iframe
function closeModal() {
  const modal = document.getElementById("video-modal");
  const player = document.getElementById("player");
  if (!modal || !player) return;
  player.innerHTML = "";
  modal.setAttribute("aria-hidden", "true");
}

// Contact form: prefer Formspree if set, else use mailto fallback
function setupContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  if (CONFIG.FORMSPREE_ENDPOINT) {
    form.action = CONFIG.FORMSPREE_ENDPOINT;
    form.method = "POST";
  } else {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = data.get("name") || "";
      const email = data.get("email") || "";
      const message = data.get("message") || "";
      const subject = encodeURIComponent(`Contact from ${name}`);
      const body = encodeURIComponent(`From: ${name} <${email}>\n\n${message}`);
      window.location.href = `mailto:${CONFIG.CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    });
  }
}