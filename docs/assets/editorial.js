const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

if (!reducedMotion.matches && "IntersectionObserver" in window) {
  const reveal = new IntersectionObserver((entries, observer) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      if (reducedMotion.matches) continue;
      target.animate(
        [{ opacity: .45, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }],
        { duration: 510, easing: "cubic-bezier(.2,.75,.3,1)" },
      );
    }
  }, { threshold: .13 });

  document.querySelectorAll("[data-reveal]").forEach((element) => reveal.observe(element));
  const title = document.querySelector(".masthead h1, .collection-head h1");
  title?.animate(
    [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }],
    { duration: 850, easing: "cubic-bezier(.2,.7,.2,1)" },
  );
  document.querySelector(".hero-image")?.animate(
    [{ clipPath: "inset(0 0 13% 0)", opacity: .12 }, { clipPath: "inset(0)", opacity: 1 }],
    { duration: 1050, easing: "cubic-bezier(.18,.7,.22,1)" },
  );
}

if (location.protocol === "file:") {
  document.querySelector(".file-preview-note")?.removeAttribute("hidden");
} else {
  for (const frame of document.querySelectorAll("iframe[data-preview-src]")) {
    let observer;
    if (frame.dataset.fit) {
      frame.addEventListener("load", () => {
        observer?.disconnect();
        const surface = frame.contentDocument?.querySelector(frame.dataset.fit);
        if (!surface) return;
        observer = new ResizeObserver(() => {
          frame.style.height = `${Math.ceil(surface.getBoundingClientRect().height + 18)}px`;
        });
        observer.observe(surface);
      });
    }
    frame.hidden = false;
    frame.src = frame.dataset.previewSrc;
  }
}
