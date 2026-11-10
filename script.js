// Photos per filter folder come from photos.js (run update_photos.py to refresh)
let folder = "FOTOS";
let photos = [];
let passes = 0;

const container = document.getElementById("images");
const sentinel = document.getElementById("sentinel");

// Appear animation: photos slide up from below while fading in and sharpening
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animateIn(imgs, stagger = 0) {
  if (!imgs.length) return;
  if (reduceMotion) {
    gsap.fromTo(imgs, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger });
    return;
  }
  gsap.fromTo(imgs,
    { opacity: 0, yPercent: 12, filter: "blur(14px)" },
    { opacity: 1, yPercent: 0, filter: "blur(0px)", duration: 1.2, ease: "power3.out", stagger, overwrite: true }
  );
}

// Endless scroll: append another full pass of the photos whenever
// the bottom of the image column comes near the viewport.
function appendPass() {
  if (!photos.length) return;
  const fragment = document.createDocumentFragment();
  for (const file of photos) {
    const frame = document.createElement("div");
    frame.className = passes > 0 ? "photo repeat" : "photo"; // repeats are hidden in grid view
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    // Once loaded, give the frame the photo's real ratio, then fade it in
    const reveal = () => {
      frame.style.aspectRatio = img.naturalWidth + " / " + img.naturalHeight;
      frame.classList.add("loaded");
      animateIn([img]);
    };
    img.addEventListener("load", reveal, { once: true });
    img.src = encodeURIComponent(folder) + "/" + encodeURIComponent(file);
    if (img.complete && img.naturalWidth) reveal();
    frame.appendChild(img);
    fragment.appendChild(frame);
  }
  container.appendChild(fragment);
  passes++;
}

// Filters: show the photos in the folder named by the link
const filterLinks = [...document.querySelectorAll("[data-filter]")];

function showFolder(name) {
  folder = name;
  photos = PHOTOS[name] || [];
  passes = 0;
  container.replaceChildren();
  filterLinks.forEach((link) => link.classList.toggle("active", link.dataset.filter === name));
  window.scrollTo(0, 0);
  if (photos.length) {
    appendPass();
  } else {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No images yet.";
    container.appendChild(empty);
  }
}

filterLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showFolder(link.dataset.filter);
  });
});

// Start on the first filter that has photos, or FOTOS while they're all empty
const firstFilled = filterLinks.find((link) => (PHOTOS[link.dataset.filter] || []).length);
showFolder(firstFilled ? firstFilled.dataset.filter : "FOTOS");

new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !document.body.classList.contains("grid-view")) appendPass();
}, { rootMargin: "200% 0px" }).observe(sentinel);

// Grid view: toggle between the large stacked images and a thumbnail grid
const viewToggle = document.getElementById("view-toggle");
viewToggle.addEventListener("click", (e) => {
  e.preventDefault();
  const grid = document.body.classList.toggle("grid-view");
  viewToggle.textContent = grid ? "List view" : "Grid view";
  window.scrollTo(0, 0);

  // Replay the appear animation on the photos now on screen
  const onScreen = [...container.querySelectorAll(".photo.loaded")].filter((frame) => {
    const r = frame.getBoundingClientRect();
    return r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
  });
  animateIn(onScreen.map((frame) => frame.querySelector("img")), grid ? 0.015 : 0.08);
});

// Hover sound: noisy kick on clickable items (Tone.js)
// Soft saturation glues the layers and adds an electronic edge
const kickBus = new Tone.Distortion({ distortion: 0.25, wet: 0.4 }).toDestination();

// Bouncy sine sub: slower pitch drop gives a rounder, "boop"-like bass
const kickBody = new Tone.MembraneSynth({
  pitchDecay: 0.08,
  octaves: 4,
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.2 },
  volume: -16,
}).connect(kickBus);

// Tiny bright tick on top instead of a big noise burst
const kickNoise = new Tone.NoiseSynth({
  noise: { type: "pink" },
  envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  volume: -34,
}).connect(new Tone.Filter(3000, "bandpass").connect(kickBus));

// Pick from a few notes so repeated hovers sound playful, not identical
const kickNotes = ["E1", "G1", "A1", "B1"];

function playKick() {
  if (Tone.context.state !== "running") return;
  const now = Tone.now();
  const note = kickNotes[Math.floor(Math.random() * kickNotes.length)];
  kickBody.triggerAttackRelease(note, "8n", now);
  kickNoise.triggerAttackRelease("32n", now);
}

// Browsers only allow audio after a user gesture: unlock on first click/key
const unlockAudio = () => Tone.start();
document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });

const clickable = "a, button, [role='button']";
document.addEventListener("mouseover", (e) => {
  const el = e.target.closest(clickable);
  if (el && !el.contains(e.relatedTarget)) playKick();
});

// Click sound: cute synth note in C#
const chime = new Tone.PolySynth(Tone.FMSynth, {
  harmonicity: 2,
  modulationIndex: 3,
  oscillator: { type: "sine" },
  modulation: { type: "triangle" },
  envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.3 },
  modulationEnvelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.1 },
  volume: -12,
}).connect(new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.2, wet: 0.2 }).toDestination());

document.addEventListener("click", async (e) => {
  if (!e.target.closest(clickable)) return;
  await Tone.start();
  chime.triggerAttackRelease("C#6", "16n");
});
