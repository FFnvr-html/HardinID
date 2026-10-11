const themeBtn = document.getElementById('theme-toggle');

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
        themeBtn.textContent = "☾";
    }
}

let savedTheme = localStorage.getItem('hardinid_theme');
if (savedTheme === null) {
    savedTheme = "dark";
}
applyTheme(savedTheme);

themeBtn.addEventListener('click', function () {
    let next = "dark";
    if (document.body.classList.contains('dark')) {
        next = "light";
    }
    applyTheme(next);
    localStorage.setItem('hardinid_theme', next);
});
/*
javacode snippet for theme toggle, checks local storage for saved preference, defaults to dark if wala.
code first checks if the user has a saved theme preference in the local storage, then defaults to dark if none is found. (dont mind this, it's for the groupmates)
*/
let organ = "auto";
const organBtns = document.querySelectorAll('.organ');

organBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
        organ = btn.dataset.organ;

        organBtns.forEach(function (other) {
            other.setAttribute('aria-pressed', 'false');
        });
        btn.setAttribute('aria-pressed', 'true');

        console.log(organ);
    });
});
/*
organs, auto is default. u select, the forEach takes care of the rest.
*/
const video = document.getElementById("video");
const preview = document.getElementById("preview");
const placeholder = document.getElementById("placeholder");
const reticle = document.getElementById("reticle");
const controls = document.getElementById("controls");
const fileInput = document.getElementById("file");

function show(el) {
    el.classList.remove("hidden");
}

function hide(el) {
    el.classList.add("hidden");
}

function addButton(label, isPrimary, onClick) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = "btn";
    if (isPrimary) {
        btn.className = "btn primary";
    }
    btn.addEventListener("click", onClick);
    controls.appendChild(btn);
}

function showStartButtons() {
    controls.innerHTML = "";
    addButton("start camera", true, startCamera);
    addButton("Upload photo", false, openFile);
}

showStartButtons();

let photo = null;
let stream = null;

function showPhotoButtons() {
  controls.innerHTML = "";
  addButton("Identify", true, identify);
  addButton("Retake", false, resetStage);
}

function showCameraButtons() {
  controls.innerHTML = "";
  addButton("Capture", true, capturePhoto);
  addButton("Cancel", false, resetStage);
}

function openFile() {
  fileInput.click();
}

fileInput.addEventListener("change", function () {
  const file = fileInput.files[0];
  if (!file) {
    return;
  }

  const img = new Image();
  img.onload = function () {
    let scale = 1;
    if (img.width > 1280) {
      scale = 1280 / img.width;
    }

    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(function (blob) {
      photo = blob;
      showPhoto();
    }, "image/jpeg", 0.92);
  };
  img.src = URL.createObjectURL(file);
  fileInput.value = "";
});

function showPhoto() {
  preview.src = URL.createObjectURL(photo);
  show(preview);
  hide(placeholder);
  hide(video);
  hide(reticle);
  showPhotoButtons();
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
  } catch (error) {
    alert("Camera unavailable. Upload a photo instead.");
    return;
  }
  video.srcObject = stream;
  show(video);
  show(reticle);
  hide(placeholder);
  hide(preview);
  showCameraButtons();
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(function (track) {
      track.stop();
    });
    stream = null;
  }
}

function capturePhoto() {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  canvas.toBlob(function (blob) {
    photo = blob;
    stopCamera();
    showPhoto();
  }, "image/jpeg", 0.92);
}

function resetStage() {
  stopCamera();
  photo = null;
  hide(preview);
  hide(video);
  hide(reticle);
  show(placeholder);
  showStartButtons();
}


const PLANTNET_KEY = "2b104KXcGtid3GdtxNGlcOWme";
const PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all";

const readout = document.getElementById("readout");
const readoutBody = document.getElementById("readout-body");

function showMessage(text, isError) {
  show(readout);
  let className = "status";
  if (isError) {
    className = "status err";
  }
  readoutBody.innerHTML = '<div class="' + className + '">' + text + '</div>';
}

async function identify() {
  if (photo === null) {
    return;
  }
  showMessage("Identifying your plant...", false);

  const form = new FormData();
  form.append("images", photo, "plant.jpg");
  form.append("organs", organ);

  const url = PLANTNET_URL + "?api-key=" + PLANTNET_KEY + "&nb-results=3";

  let response;
  try {
    response = await fetch(url, { method: "POST", body: form });
  } catch (error) {
    showMessage("Could not reach Pl@ntNet. Check your connection, or this address is not authorized for the key.", true);
    return;
  }

  if (response.status === 404) {
    showMessage("No match found. Try a clearer photo or pick a specific organ.", true);
    return;
  }
  if (response.status === 401 || response.status === 403) {
    showMessage("This address is not authorized for the Pl@ntNet key.", true);
    return;
  }
  if (response.status === 429) {
    showMessage("Daily limit reached. Try again tomorrow.", true);
    return;
  }
  if (!response.ok) {
    showMessage("Something went wrong (error " + response.status + ").", true);
    return;
  }

  const data = await response.json();
    if (!data.results || data.results.length === 0) {
    showMessage("No match returned for this photo.", true);
    return;
  }
  showResult(data.results);
}

function confidenceColor(percent) {
  if (percent >= 55) {
    return "var(--signal-strong)";
  }
  if (percent >= 25) {
    return "var(--signal-mid)";
  }
  return "var(--signal-weak)";
}

function confidenceLabel(percent) {
  if (percent >= 55) {
    return "High confidence";
  }
  if (percent >= 25) {
    return "Moderate";
  }
  return "Low, verify manually";
}

let current = null;

function showResult(results) {
  const top = results[0];
  const percent = Math.round(top.score * 1000) / 10;
  const name = top.species.scientificNameWithoutAuthor;
  const family = top.species.family.scientificNameWithoutAuthor;
  const color = confidenceColor(percent);

  let common = "No common name listed";
  if (top.species.commonNames && top.species.commonNames.length > 0) {
    common = top.species.commonNames[0];
  }

  current = {
    name: name,
    common: common,
    family: family,
    percent: percent,
    verdict: null,
    time: Date.now()
  };

  let others = "";
  for (let i = 1; i < results.length; i++) {
    const otherPercent = Math.round(results[i].score * 1000) / 10;
    const otherName = results[i].species.scientificNameWithoutAuthor;
    others += `
      <div class="cand">
        <div class="cand-name">${otherName}</div>
        <div class="cand-bar"><span style="width:${otherPercent}%"></span></div>
        <div class="cand-pct">${otherPercent}%</div>
      </div>`;
  }

  readoutBody.innerHTML = `
    <div class="conf-block">
      <div class="conf-top">
        <div class="conf-num" style="color:${color}">${percent}<span class="pct">%</span></div>
        <div class="conf-verdict">confidence<b style="color:${color}">${confidenceLabel(percent)}</b></div>
      </div>
      <div class="signal"><div class="fill" style="width:${percent}%;background:${color}"></div></div>
      <div class="binomial">${name}</div>
      <div class="common">${common}</div>
      <div class="family-tag">${family}</div>
    </div>
    <div class="stack">
      <div class="stack-lbl">Other candidates</div>
      ${others}
    </div>
    <div class="verify">
      <div class="q">Field check: is <b>${name}</b> the correct species?</div>
      <div class="verify-btns">
        <button class="vbtn yes" data-verdict="correct">✓ correct</button>
        <button class="vbtn no" data-verdict="incorrect">✗ wrong</button>
        <button class="vbtn maybe" data-verdict="uncertain">? unsure</button>
      </div>
      <button class="btn primary next-btn hidden" id="next-btn">Identify another plant</button>
    </div>`;

  const verdictBtns = readoutBody.querySelectorAll(".vbtn");
  verdictBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      verdictBtns.forEach(function (other) {
        other.classList.remove("on");
      });
      btn.classList.add("on");
      current.verdict = btn.dataset.verdict;
      saveToLog();
      show(document.getElementById("next-btn"));
    });
  });

  document.getElementById("next-btn").addEventListener("click", startOver);

  showCampusRecord(name);
}

function startOver() {
  hide(readout);
  hide(document.getElementById("campus"));
  current = null;
  resetStage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let campusPlants = [];

async function loadCampusPlants() {
  try {
    const response = await fetch("plants.json");
    campusPlants = await response.json();
  } catch (error) {
    console.log("Could not load plants.json");
  }
}

function cleanName(name) {
  return name.trim().toLowerCase();
}

function findCampusPlant(name) {
  for (let i = 0; i < campusPlants.length; i++) {
    if (cleanName(campusPlants[i].scientificName) === cleanName(name)) {
      return campusPlants[i];
    }
  }
  return null;
}

function showCampusRecord(name) {
  const campus = document.getElementById("campus");
  const plant = findCampusPlant(name);

  if (plant === null) {
    hide(campus);
    return;
  }

  let photoHtml = '<div class="campus-photo empty">Campus photo to follow</div>';
  if (plant.photo !== "") {
    photoHtml = `<img class="campus-photo" src="${plant.photo}" alt="${plant.commonName} on campus">`;
  }

  document.getElementById("campus-body").innerHTML = `
    ${photoHtml}
    <div class="campus-info">
      <div class="binomial">${plant.scientificName}</div>
      <div class="common">${plant.commonName}</div>
      <div class="origin origin-${plant.origin}">${plant.origin}</div>
      <p class="campus-desc">${plant.description}</p>
    </div>`;

  show(campus);
}

loadCampusPlants();
// STILL INCOMPLETE, PROGRESS AS OF 2026-10-12
const logBox = document.getElementById("log");
let specimens = [];

function loadLog() {
  const saved = localStorage.getItem("hardinid_log");