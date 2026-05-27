const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const projectRail = document.querySelector(".project-rail");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navLinks.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("nav-open", !isOpen);
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navToggle.setAttribute("aria-expanded", "false");
      navLinks.classList.remove("is-open");
      document.body.classList.remove("nav-open");
    }
  });
}

document.querySelectorAll(".faq-item").forEach((item, index) => {
  const button = item.querySelector("button");
  if (!button) return;

  item.classList.toggle("is-open", index === 0);
  button.setAttribute("aria-expanded", String(index === 0));

  button.addEventListener("click", () => {
    const isOpen = item.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(isOpen));
  });
});

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!projectRail) return;

    const direction = button.getAttribute("data-scroll") === "right" ? 1 : -1;
    projectRail.scrollBy({
      left: direction * Math.min(430, projectRail.clientWidth * 0.82),
      behavior: "smooth",
    });
  });
});

if (projectRail) {
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;

  projectRail.addEventListener("pointerdown", (event) => {
    isDown = true;
    startX = event.clientX;
    scrollLeft = projectRail.scrollLeft;
    projectRail.setPointerCapture(event.pointerId);
  });

  projectRail.addEventListener("pointermove", (event) => {
    if (!isDown) return;
    projectRail.scrollLeft = scrollLeft - (event.clientX - startX);
  });

  projectRail.addEventListener("pointerup", () => {
    isDown = false;
  });

  projectRail.addEventListener("pointercancel", () => {
    isDown = false;
  });
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
}
