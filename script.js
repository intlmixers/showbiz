const albumContainer = document.getElementById("album-container2");
const stickerBar = document.getElementById("sticker-bar");
const resetBtn = document.getElementById("reset-btn");
const saveBtn = document.getElementById("save-btn");

let originalStickers = [];
if (stickerBar) {
  originalStickers = [...stickerBar.querySelectorAll("img")].map(
    (img) => img.src
  );
  // Guardamos el lugar original de cada sticker en la barra
  stickerBar.querySelectorAll("img").forEach((img, i) => {
    img.dataset.index = i;
  });
}

let attachedSticker = null;
let selectedSticker = null;
let zCounter = 10; // el sticker seleccionado pasa al frente

// Deseleccionar al hacer click afuera (se registra una sola vez)
document.addEventListener("click", () => {
  if (selectedSticker) {
    selectedSticker.classList.remove("selected");
    selectedSticker = null;
  }
});

const HANDLES = ".resize-handle, .rotate-handle, .delete-handle";

// ¿El punto (x, y) de la pantalla cae sobre una parte visible (no transparente)
// del sticker? Tiene en cuenta el tamaño y la rotación actuales.
function isOpaqueAt(wrapper, img, rotation, clientX, clientY) {
  if (!img.naturalWidth || !img.offsetWidth) return true;
  try {
    if (!img._hitCtx) {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      img._hitCtx = ctx;
    }
    const r = wrapper.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const a = (-rotation * Math.PI) / 180;
    const x = dx * Math.cos(a) - dy * Math.sin(a);
    const y = dx * Math.sin(a) + dy * Math.cos(a);
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    const u = Math.floor(((x + w / 2) / w) * img.naturalWidth);
    const v = Math.floor(((y + h / 2) / h) * img.naturalHeight);
    if (u < 0 || v < 0 || u >= img.naturalWidth || v >= img.naturalHeight) {
      return false;
    }
    return img._hitCtx.getImageData(u, v, 1, 1).data[3] > 20;
  } catch (err) {
    return true; // si el navegador no deja leer la imagen, la tratamos como sólida
  }
}

// Devuelve el sticker de más arriba que tenga una parte visible bajo el cursor
function pickSticker(x, y) {
  const seen = new Set();
  for (const el of document.elementsFromPoint(x, y)) {
    const w = el.closest(".sticker-wrapper");
    if (!w || seen.has(w)) continue;
    seen.add(w);
    if (w._isOpaqueAt && w._isOpaqueAt(x, y)) return w;
  }
  return null;
}

function createStickerWrapper(src, x, y, index) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("sticker-wrapper");
  if (index !== undefined) wrapper.dataset.index = index;
  wrapper.style.zIndex = ++zCounter;
  wrapper.style.left = x + "px";
  wrapper.style.top = y + "px";

  const img = document.createElement("img");
  img.classList.add("sticker");
  img.draggable = false; // evita el arrastre nativo del navegador
  wrapper.appendChild(img);

  const resizeHandle = document.createElement("div");
  resizeHandle.classList.add("resize-handle");

  const rotateHandle = document.createElement("div");
  rotateHandle.classList.add("rotate-handle");
  rotateHandle.innerHTML = "&#10227;";

  const deleteHandle = document.createElement("div");
  deleteHandle.classList.add("delete-handle");
  deleteHandle.innerHTML = "&#10006;";

  wrapper.append(resizeHandle, rotateHandle, deleteHandle);
  albumContainer.appendChild(wrapper);

  let ratio = 1;
  let currentWidth = 150;
  let rotation = 0;
  const minWidth = 50;
  const maxWidth = 300;
  wrapper._isOpaqueAt = (x, y) => isOpaqueAt(wrapper, img, rotation, x, y);

  // Esperar a que cargue la imagen para conocer sus medidas
  img.onload = () => {
    ratio = img.naturalHeight / img.naturalWidth;
    currentWidth = Math.min(150, img.naturalWidth);
    img.style.width = currentWidth + "px";
    img.style.height = currentWidth * ratio + "px";
  };
  img.src = src;

  // Selección: sólo cuenta la parte visible del sticker. Si haces click sobre
  // una zona transparente, el click pasa al sticker que está debajo.
  wrapper.addEventListener("click", (e) => {
    if (e.target.closest(HANDLES)) {
      e.stopPropagation();
      return;
    }
    const target = pickSticker(e.clientX, e.clientY);
    if (target !== wrapper) {
      if (target) {
        e.stopPropagation();
        target.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
          })
        );
      }
      return; // sin sticker debajo: el click sigue y deselecciona
    }
    e.stopPropagation();
    if (selectedSticker && selectedSticker !== wrapper) {
      selectedSticker.classList.remove("selected");
    }
    selectedSticker = wrapper;
    wrapper.classList.add("selected");
    wrapper.style.zIndex = ++zCounter; // al frente de los demás
  });

  // Mover
  wrapper.addEventListener("mousedown", (e) => {
    if (e.target.closest(HANDLES)) return;
    const target = pickSticker(e.clientX, e.clientY);
    if (target !== wrapper) {
      if (target) {
        e.stopPropagation();
        target.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
            button: 0,
          })
        );
      }
      return;
    }
    e.preventDefault();
    wrapper.style.zIndex = ++zCounter; // al frente mientras lo arrastras
    const rect = albumContainer.getBoundingClientRect();
    const shiftX = e.clientX - rect.left - wrapper.offsetLeft;
    const shiftY = e.clientY - rect.top - wrapper.offsetTop;

    function onMouseMove(ev) {
      wrapper.style.left = ev.clientX - rect.left - shiftX + "px";
      wrapper.style.top = ev.clientY - rect.top - shiftY + "px";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener(
      "mouseup",
      () => document.removeEventListener("mousemove", onMouseMove),
      { once: true }
    );
  });

  // Redimensionar
  resizeHandle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = currentWidth;

    function onMouseMove(ev) {
      currentWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startWidth + (ev.clientX - startX))
      );
      img.style.width = currentWidth + "px";
      img.style.height = currentWidth * ratio + "px";
    }
    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  // Rotar
  rotateHandle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const r = wrapper.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startRotation = rotation;

    function onMouseMove(ev) {
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      rotation = startRotation + (angle - startAngle) * (180 / Math.PI);
      wrapper.style.transform = `rotate(${rotation}deg)`;
    }
    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  // Borrar (vuelve a la barra)
  deleteHandle.addEventListener("click", (e) => {
    e.stopPropagation();
    removeSticker(wrapper);
    selectedSticker = null;
  });
}

function stickerEventsCreator(sticker) {
  sticker.addEventListener("mousedown", function (e) {
    e.preventDefault();
    attachedSticker = document.createElement("img");
    attachedSticker.src = sticker.src;
    attachedSticker.style.position = "absolute";
    attachedSticker.style.pointerEvents = "none";
    attachedSticker.style.width = sticker.width + "px";
    attachedSticker.style.height = sticker.height + "px";
    attachedSticker.dataset.src = sticker.src;
    document.body.appendChild(attachedSticker);

    function moveAttached(ev) {
      attachedSticker.style.left =
        ev.clientX - attachedSticker.width / 2 + "px";
      attachedSticker.style.top =
        ev.clientY - attachedSticker.height / 2 + "px";
    }
    moveAttached(e);

    document.addEventListener("mousemove", moveAttached);

    document.addEventListener("mouseup", function upHandler(ev) {
      document.removeEventListener("mousemove", moveAttached);
      document.removeEventListener("mouseup", upHandler);

      const rect = albumContainer.getBoundingClientRect();
      if (
        ev.clientX >= rect.left &&
        ev.clientX <= rect.right &&
        ev.clientY >= rect.top &&
        ev.clientY <= rect.bottom
      ) {
        createStickerWrapper(
          attachedSticker.dataset.src,
          ev.clientX - rect.left - attachedSticker.width / 2,
          ev.clientY - rect.top - attachedSticker.height / 2,
          sticker.dataset.index
        );
        sticker.remove();
      }
      attachedSticker.remove();
      attachedSticker = null;
    });
  });
}

// Inserta el sticker en la barra respetando su orden original
function insertInBar(img) {
  const idx = Number(img.dataset.index);
  if (!Number.isNaN(idx)) {
    const next = [...stickerBar.querySelectorAll("img")].find(
      (el) => Number(el.dataset.index) > idx
    );
    if (next) {
      stickerBar.insertBefore(img, next);
      return;
    }
  }
  stickerBar.appendChild(img);
}

// El sticker "vuela" de vuelta a su lugar en la barra
function removeSticker(wrapper) {
  const wrapperImg = wrapper.querySelector("img");
  const src = wrapperImg.src;

  // Posición y tamaño actuales (el centro no cambia con la rotación)
  const r = wrapper.getBoundingClientRect();
  const startW = wrapperImg.offsetWidth;
  const startH = wrapperImg.offsetHeight;
  const startLeft = r.left + r.width / 2 - startW / 2;
  const startTop = r.top + r.height / 2 - startH / 2;
  const startTransform = wrapper.style.transform || "rotate(0deg)";

  // Lo devolvemos a la barra, invisible hasta que termine el vuelo
  const barImg = document.createElement("img");
  barImg.src = src;
  if (wrapper.dataset.index !== undefined) {
    barImg.dataset.index = wrapper.dataset.index;
  }
  barImg.style.visibility = "hidden";
  insertInBar(barImg);
  stickerEventsCreator(barImg);

  wrapper.remove();

  function fly() {
    const t = barImg.getBoundingClientRect();
    const clone = document.createElement("img");
    clone.src = src;
    Object.assign(clone.style, {
      position: "fixed",
      left: startLeft + "px",
      top: startTop + "px",
      width: startW + "px",
      height: startH + "px",
      transform: startTransform,
      pointerEvents: "none",
      zIndex: "99999",
    });
    document.body.appendChild(clone);

    const anim = clone.animate(
      [
        {
          left: startLeft + "px",
          top: startTop + "px",
          width: startW + "px",
          height: startH + "px",
          transform: startTransform,
        },
        {
          left: t.left + "px",
          top: t.top + "px",
          width: t.width + "px",
          height: t.height + "px",
          transform: "rotate(0deg)",
        },
      ],
      { duration: 550, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    );
    const done = () => {
      clone.remove();
      barImg.style.visibility = "";
    };
    anim.onfinish = done;
    anim.oncancel = done;
  }

  if (barImg.complete && barImg.naturalWidth) fly();
  else barImg.onload = fly;
}

// Stickers "attached" al cursor
if (stickerBar) {
  stickerBar.querySelectorAll("img").forEach((sticker) => {
    stickerEventsCreator(sticker);
  });
}

// Reset
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    const placedStickers = albumContainer.querySelectorAll(".sticker-wrapper");
    placedStickers.forEach((s) => s.remove());
    selectedSticker = null;

    stickerBar.innerHTML = "";
    originalStickers.forEach((src, i) => {
      const img = document.createElement("img");
      img.src = src;
      img.dataset.index = i;
      stickerBar.appendChild(img);
      stickerEventsCreator(img);
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  if (typeof M !== "undefined") {
    var elems = document.querySelectorAll(".modal");
    M.Modal.init(elems);
  }
});

// Save
if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    // Quitar los controles de la imagen final
    if (selectedSticker) {
      selectedSticker.classList.remove("selected");
      selectedSticker = null;
    }

    html2canvas(document.querySelector("#album-container2"), {
      backgroundColor: null, // fondo transparente en PNG
      useCORS: true,
      scale: 2, // mayor calidad
    })
      .then((canvas) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            alert("No se pudo generar la imagen.");
            return;
          }
          const link = document.createElement("a");
          link.download = "my-showbiz.png";
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }, "image/png");
        // Para JPG: reemplaza "image/png" por "image/jpeg", 0.95 y
        // usa backgroundColor: "#ffffff" arriba (JPG no admite transparencia).
      })
      .catch(() => {
        alert(
          "No se pudo guardar. Si abriste el archivo haciendo doble click, " +
            "ábrelo con un servidor local (por ejemplo Live Server de VS Code)."
        );
      });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const images = document.querySelectorAll(".selectable");

  images.forEach((img) => {
    img.addEventListener("click", () => {
      const bgImage = img.dataset.bg;
      // Redirige a la nueva página con parámetro
      window.location.href = `canvas.html?bg=${encodeURIComponent(bgImage)}`;
    });
  });
});
