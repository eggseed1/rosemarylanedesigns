/* Reliable mobile media: visible posters, lazy-image recovery, and tap-to-play on Safari. */
(() => {
  "use strict";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 800px)").matches;

  document.querySelectorAll("img[loading='lazy']").forEach(img => {
    img.loading = "eager";
    if (!img.complete) {
      const source = img.getAttribute("src");
      if (source) img.src = source;
    }
  });

  document.querySelectorAll("img[src]").forEach(img => {
    img.addEventListener("error", () => {
      if (img.dataset.retryMedia === "1") {
        if (img.dataset.failedMedia === "1" || img.closest(".mobile-video")) return;
        img.dataset.failedMedia = "1";
        const link = document.createElement("a");
        link.className = "mobile-photo-link";
        link.href = img.getAttribute("src");
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "View photo";
        img.insertAdjacentElement("afterend", link);
        return;
      }
      const source = img.getAttribute("src");
      if (!source || !/^(?:photos|assets)\//.test(source)) return;
      img.dataset.retryMedia = "1";
      img.loading = "eager";
      img.removeAttribute("srcset");
      const url = new URL(source, document.baseURI);
      url.searchParams.set("retry", "1");
      img.src = url.href;
    });
  });

  const videos = [...document.querySelectorAll("video")];
  const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const frame = entry.target;
      const video = frame.querySelector("video");
      if (entry.isIntersecting) {
        video.preload = "metadata";
        if (!reduced && !frame.classList.contains("video-error")) {
          const p = video.play();
          if (p && p.catch) p.catch(() => frame.classList.add("tap-to-play"));
        }
      } else video.pause();
    });
  }, { threshold: 0.05, rootMargin: "100px 0px" }) : null;

  videos.forEach(video => {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload = "metadata";

    if (video.classList.contains("flipbook-slide")) {
      if (video.poster) {
        video.style.backgroundImage = 'url("' + video.getAttribute("poster") + '")';
        video.style.backgroundSize = "cover";
        video.style.backgroundPosition = video.style.objectPosition || "center";
      }
      return;
    }

    const frame = document.createElement("span");
    frame.className = "mobile-video";
    video.parentNode.insertBefore(frame, video);

    if (video.poster) {
      const image = document.createElement("img");
      image.className = "mobile-video-poster";
      image.src = video.getAttribute("poster");
      image.alt = video.getAttribute("aria-label") || "Needlepoint video preview";
      image.decoding = "async";
      image.loading = "eager";
      image.style.objectPosition = video.style.objectPosition || "center";
      frame.appendChild(image);
    }

    frame.appendChild(video);
    video.controls = false;
    if (!reduced) {
      video.autoplay = true;
      video.setAttribute("autoplay", "");
    }

    const button = document.createElement("button");
    button.className = "mobile-video-button";
    button.type = "button";
    button.textContent = "Play video";
    button.setAttribute("aria-label", "Play " + (video.getAttribute("aria-label") || "video"));
    frame.appendChild(button);

    if (reduced) frame.classList.add("tap-to-play");
    video.addEventListener("playing", () => {
      frame.classList.add("video-playing");
      frame.classList.remove("tap-to-play", "video-error");
    });
    video.addEventListener("error", () => {
      frame.classList.remove("video-playing");
      frame.classList.add("tap-to-play", "video-error");
      button.textContent = "Open video";
    });
    button.addEventListener("click", () => {
      if (frame.classList.contains("video-error")) {
        window.open(video.getAttribute("src"), "_blank", "noopener");
        return;
      }
      video.preload = "auto";
      const p = video.play();
      if (p && p.catch) p.catch(() => {
        frame.classList.add("tap-to-play", "video-error");
        button.textContent = "Open video";
      });
    });

    if (observer) observer.observe(frame);
    else if (!reduced) {
      const p = video.play();
      if (p && p.catch) p.catch(() => frame.classList.add("tap-to-play"));
    }
  });
})();
