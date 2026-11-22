const dialog = document.querySelector(".lightbox");
const frames = Array.from(document.querySelectorAll(".photo-link"));

if (dialog && typeof dialog.showModal === "function" && frames.length) {
  const image = dialog.querySelector("img");
  const count = dialog.querySelector(".lightbox-count");
  const close = dialog.querySelector(".lightbox-close");
  let index = 0;
  let opener;

  function showPhoto(newIndex) {
    index = (newIndex + frames.length) % frames.length;
    const link = frames[index];
    image.alt = link.querySelector("img").alt || `摄影作品，第 ${index + 1} 张`;
    image.src = link.href;
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
      close.focus();
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
    if (event.target === dialog || event.target === dialog.querySelector(".lightbox-body")) dialog.close();
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("lightbox-open");
    opener?.focus({ preventScroll: true });
    image.removeAttribute("src");
  });
}
