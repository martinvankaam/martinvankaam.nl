/* martinvankaam.nl: filters voor de tijdlijn, mailknoppen en kopieerknop. Geen afhankelijkheden. */
(function () {
  "use strict";

  /* Tijdlijnfilters. Zonder JavaScript blijft de volledige tijdlijn zichtbaar. */
  var filters = document.getElementById("filters");
  var list = document.getElementById("timeline-list");
  if (filters && list) {
    var items = Array.prototype.slice.call(list.querySelectorAll(".tl-item"));
    var chips = Array.prototype.slice.call(filters.querySelectorAll(".chip"));
    var allChip = filters.querySelector('[data-cat="all"]');
    var countEl = document.getElementById("tl-count");
    var template = filters.getAttribute("data-count") || "{shown} / {total}";
    var selected = [];

    var render = function () {
      var shown = 0;
      items.forEach(function (li) {
        var cats = li.getAttribute("data-categories").split(" ");
        var match = selected.length === 0 || selected.some(function (c) { return cats.indexOf(c) !== -1; });
        li.hidden = !match;
        if (match) shown++;
      });
      chips.forEach(function (chip) {
        var cat = chip.getAttribute("data-cat");
        var on = cat === "all" ? selected.length === 0 : selected.indexOf(cat) !== -1;
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
      countEl.textContent = template.replace("{shown}", shown).replace("{total}", items.length);
    };

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var cat = chip.getAttribute("data-cat");
        if (cat === "all") {
          selected = [];
        } else {
          var i = selected.indexOf(cat);
          if (i === -1) selected.push(cat); else selected.splice(i, 1);
        }
        render();
      });
    });

    filters.hidden = false;
    render();
  }

  /* Mailknoppen: probeer de app, val terug op de webversie. */
  var box = document.querySelector("[data-mail]");
  if (box) {
    var ADDR = box.getAttribute("data-mail");
    var ua = navigator.userAgent;
    var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var android = /Android/.test(ua);

    var apps = {
      gmail: {
        web: "https://mail.google.com/mail/?view=cm&fs=1&to=" + ADDR,
        ios: "googlegmail:///co?to=" + ADDR,
        pkg: "com.google.android.gm"
      },
      outlook: {
        web: "https://outlook.office.com/mail/deeplink/compose?to=" + ADDR,
        ios: "ms-outlook://compose?to=" + ADDR,
        pkg: "com.microsoft.office.outlook"
      }
    };

    var openApp = function (name) {
      var a = apps[name];
      if (ios) {
        var left = false;
        var onVis = function () { if (document.hidden) left = true; };
        document.addEventListener("visibilitychange", onVis);
        var f = document.createElement("iframe");
        f.style.display = "none";
        f.src = a.ios;
        document.body.appendChild(f);
        setTimeout(function () {
          document.removeEventListener("visibilitychange", onVis);
          if (f.parentNode) f.parentNode.removeChild(f);
          if (!left) window.location.href = a.web;
        }, 1300);
      } else if (android) {
        window.location.href = "intent:#Intent;action=android.intent.action.SENDTO;data=mailto:" + ADDR +
          ";package=" + a.pkg + ";S.browser_fallback_url=" + encodeURIComponent(a.web) + ";end";
      } else {
        window.open(a.web, "_blank", "noopener");
      }
    };

    Array.prototype.forEach.call(box.querySelectorAll("[data-app]"), function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        openApp(el.getAttribute("data-app"));
      });
    });

    var copy = document.getElementById("copy");
    if (copy) {
      var label = box.getAttribute("data-copy-label");
      var done = box.getAttribute("data-copied");
      var prompt = box.getAttribute("data-copy-prompt");
      var ok = function () {
        copy.textContent = done;
        setTimeout(function () { copy.textContent = label; }, 2000);
      };
      copy.addEventListener("click", function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ADDR).then(ok, function () { window.prompt(prompt, ADDR); });
        } else {
          window.prompt(prompt, ADDR);
        }
      });
    }
  }
})();
