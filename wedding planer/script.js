const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const reviewCards = Array.from(document.querySelectorAll(".review-card"));
const prevButton = document.querySelector("[data-review-prev]");
const nextButton = document.querySelector("[data-review-next]");
let activeReview = 0;

function showReview(index) {
  if (!reviewCards.length) return;
  activeReview = (index + reviewCards.length) % reviewCards.length;
  reviewCards.forEach((card, cardIndex) => {
    card.classList.toggle("is-active", cardIndex === activeReview);
  });
}

if (prevButton && nextButton) {
  prevButton.addEventListener("click", () => showReview(activeReview - 1));
  nextButton.addEventListener("click", () => showReview(activeReview + 1));
}

window.setInterval(() => {
  showReview(activeReview + 1);
}, 6500);

const enquiryForm = document.querySelector("#enquiry-form");
const formStatus = document.querySelector(".form-status");

if (enquiryForm && formStatus) {
  enquiryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    formStatus.textContent = "Thank you. Khokan Studio will contact you shortly.";
    enquiryForm.reset();
  });
}
