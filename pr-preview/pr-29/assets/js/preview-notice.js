(function initPullRequestPreviewNotice() {
  var pathMatch = window.location.pathname.match(
    /^(.*)\/pr-preview\/(pr-\d+)(\/.*)?$/i
  );
  if (!pathMatch) {
    return;
  }

  var basePath = pathMatch[1] || "";
  var previewRef = pathMatch[2] || "";
  var previewSuffixPath = pathMatch[3] || "/";
  var livePath = (basePath + previewSuffixPath).replace(/\/+/g, "/");
  var liveUrl = window.location.origin + livePath;
  var prNumber = previewRef.replace(/^pr-/i, "");

  function upsertMeta(name, content) {
    var node = document.querySelector('meta[name="' + name + '"]');
    if (!node) {
      node = document.createElement("meta");
      node.setAttribute("name", name);
      document.head.appendChild(node);
    }
    node.setAttribute("content", content);
  }

  function upsertCanonical(url) {
    var node = document.querySelector('link[rel="canonical"]');
    if (!node) {
      node = document.createElement("link");
      node.setAttribute("rel", "canonical");
      document.head.appendChild(node);
    }
    node.setAttribute("href", url);
  }

  var robotsDirectives =
    "noindex, nofollow, noarchive, nosnippet, noimageindex";
  upsertMeta("robots", robotsDirectives);
  upsertMeta("googlebot", robotsDirectives);
  upsertCanonical(liveUrl);

  var notice = document.createElement("section");
  notice.className = "preview-notice";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");

  var inner = document.createElement("div");
  inner.className = "preview-notice__inner shell";

  var copy = document.createElement("p");
  copy.className = "preview-notice__text";

  var title = document.createElement("strong");
  title.textContent =
    "Pull Request Preview" + (prNumber ? " (PR #" + prNumber + ")" : "");

  copy.appendChild(title);
  copy.appendChild(
    document.createTextNode(
      " This is not the live site. Information here may be incomplete or incorrect."
    )
  );

  var cta = document.createElement("a");
  cta.className = "preview-notice__link";
  cta.href = liveUrl;
  cta.textContent = "Go To Live Site";

  inner.appendChild(copy);
  inner.appendChild(cta);
  notice.appendChild(inner);

  document.body.insertBefore(notice, document.body.firstChild || null);
})();
