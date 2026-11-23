const dialog = document.querySelector(".lightbox");
const frames = Array.from(document.querySelectorAll(".photo-link"));

if (dialog && typeof dialog.showModal === "function" && frames.length) {
  const image = dialog.querySelector("img");
  const count = dialog.querySelector(".lightbox-count");
  const close = dialog.querySelector(".lightbox-close");
  const body = dialog.querySelector(".lightbox-body");
  const note = dialog.querySelector(".lightbox-note");
  let index = 0;
  let opener;

  function showPhoto(newIndex) {
    index = (newIndex + frames.length) % frames.length;
    const link = frames[index];
    const isTall = link.hasAttribute("data-long-vertical");
    dialog.toggleAttribute("data-long-vertical", isTall);
    note.hidden = !isTall;
    body.tabIndex = isTall ? 0 : -1;
    if (isTall) body.setAttribute("aria-describedby", note.id);
    else body.removeAttribute("aria-describedby");
    image.alt = link.querySelector("img").alt || `摄影作品，第 ${index + 1} 张`;
    image.src = link.href;
    body.scrollTop = 0;
    count.textContent = `${String(index + 1).padStart(2, "0")} / ${frames.length}`;
  }

  frames.forEach((frame, position) => {
    frame.addEventListener("click", (event) => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = frame;
      showPhoto(position);
      dialog.showModal();
      document.documentElement.classList.add("lightbox-open");
      (dialog.hasAttribute("data-long-vertical") ? body : close).focus();
    });
  });

  dialog.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => showPhoto(index + Number(button.dataset.step)));
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showPhoto(index + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target === body) dialog.close();
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    document.documentElement.classList.remove("lightbox-open");
    opener?.focus({ preventScroll: true });
    image.removeAttribute("src");
  });
}
