const albumContainer = document.getElementById("album-container2");
const stickerBar = document.getElementById("sticker-bar");
const resetBtn = document.getElementById("reset-btn");
const saveBtn = document.getElementById("save-btn");

let originalStickers = [];
if (stickerBar) {
  originalStickers = [...stickerBar.querySelectorAll("img")].map(
    (img) => img.src
  );
}

let attachedSticker = null;
let selectedSticker = null;

// Deseleccionar al hacer click afuera (se registra una sola vez)
document.addEventListener("click", () => {
  if (selectedSticker) {
    selectedSticker.classList.remove("selected");
    selectedSticker = null;
  }
});

function createStickerWrapper(src, x, y) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("sticker-wrapper");
  wrapper.style.left = x + "px";
  wrapper.style.top = y + "px";

  const img = document.createElement("img");
  img.classList.add("sticker");
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

  // Esperar a que cargue la imagen para conocer sus medidas
  img.onload = () => {
    ratio = img.naturalHeight / img.naturalWidth;
    currentWidth = Math.min(150, img.naturalWidth);
    img.style.width = currentWidth + "px";
    img.style.height = currentWidth * ratio + "px";
  };
  img.src = src;

  // Selección
  wrapper.addEventListener("click", (e) => {
    e.stopPropagation();
    if (selectedSticker && selectedSticker !== wrapper) {
      selectedSticker.classList.remove("selected");
    }
    selectedSticker = wrapper;
    wrapper.classList.add("selected");
  });

  // Mover
  wrapper.addEventListener("mousedown", (e) => {
    if (e.target.closest(".resize-handle, .rotate-handle, .delete-handle"))
      return;
    e.preventDefault();
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
          ev.clientY - rect.top - attachedSticker.height / 2
        );
        sticker.remove();
      }
      attachedSticker.remove();
      attachedSticker = null;
    });
  });
}

function removeSticker(sticker) {
  const img = document.createElement("img");
  img.src = sticker.querySelector("img").src;
  stickerBar.appendChild(img);
  stickerEventsCreator(img);

  sticker.remove();
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
    originalStickers.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
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
          link.download = "mi-album.png";
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
