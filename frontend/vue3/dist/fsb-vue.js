import { shallowRef as he, onBeforeUnmount as X, defineComponent as Y, computed as w, openBlock as r, createElementBlock as u, normalizeStyle as R, Fragment as c, createElementVNode as o, createCommentVNode as m, inject as we, onMounted as H, ref as C, watch as ye, toDisplayString as d, unref as t, withModifiers as B, renderList as F, createTextVNode as T, normalizeClass as L, createVNode as j, nextTick as V } from "vue";
import { createBrowserStore as ge, createTranslator as Ce, themeToCssVars as xe, resolveTheme as Me, toDisplayPath as M, formatErrorText as Se, baseName as $e, isDirectoryLike as O, isBrokenLink as De, effectiveKind as U, fromDisplayPath as Be, formatSize as Le, formatDateTime as Ne, isSelectableAs as Ee } from "@nexgus/fsb-core";
const Fe = Symbol("fsbClient");
function Re(v) {
  const b = ge(v), f = he(b.getSnapshot()), k = b.subscribe(() => {
    f.value = b.getSnapshot();
  });
  return X(k), { store: b, snapshot: f };
}
const Pe = ["stroke"], Ie = {
  key: 1,
  d: "M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z"
}, ze = {
  key: 0,
  class: "fsb-icon-badge",
  width: "9",
  height: "9",
  viewBox: "0 0 9 9",
  fill: "none",
  stroke: "var(--fsb-panel-bg)",
  "stroke-width": "1.3",
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
}, Ke = /* @__PURE__ */ Y({
  __name: "EntryIcon",
  props: {
    kind: {},
    isLink: { type: Boolean },
    broken: { type: Boolean }
  },
  setup(v) {
    const b = v, f = {
      socket: "#8a63d2",
      fifo: "#3f9c9c",
      device: "#b8860b"
    }, k = w(() => b.broken ? "var(--fsb-error-text)" : b.kind === "dir" ? "var(--fsb-folder-icon)" : f[b.kind] !== void 0 ? f[b.kind] : "var(--fsb-file-icon)"), x = w(() => b.broken ? 0.55 : 1);
    return (N, n) => (r(), u("span", {
      class: "fsb-icon",
      style: R({ opacity: x.value })
    }, [
      (r(), u("svg", {
        width: "16",
        height: "16",
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: k.value,
        "stroke-width": "1.5",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      }, [
        v.broken ? (r(), u(c, { key: 0 }, [
          n[0] || (n[0] = o("path", { d: "M6 10 L4 12 a2 2 0 1 1 -2.8 -2.8 L3 7.4" }, null, -1)),
          n[1] || (n[1] = o("path", { d: "M10 6 L12 4 a2 2 0 1 1 2.8 2.8 L14 8.6" }, null, -1)),
          n[2] || (n[2] = o("path", {
            d: "M6.5 9.5 L9.5 6.5",
            "stroke-dasharray": "1.4 1.4"
          }, null, -1))
        ], 64)) : v.kind === "dir" ? (r(), u("path", Ie)) : v.kind === "socket" ? (r(), u(c, { key: 2 }, [
          n[3] || (n[3] = o("path", { d: "M5 2.5 v3 M11 2.5 v3 M4 5.5 h8 v3 a4 4 0 0 1 -8 0 z" }, null, -1)),
          n[4] || (n[4] = o("path", { d: "M8 12.5 v2" }, null, -1))
        ], 64)) : v.kind === "fifo" ? (r(), u(c, { key: 3 }, [
          n[5] || (n[5] = o("path", { d: "M2 6 h5 a2 2 0 0 1 2 2 a2 2 0 0 0 2 2 h3" }, null, -1)),
          n[6] || (n[6] = o("circle", {
            cx: "2",
            cy: "6",
            r: "1"
          }, null, -1)),
          n[7] || (n[7] = o("circle", {
            cx: "14",
            cy: "10",
            r: "1"
          }, null, -1))
        ], 64)) : v.kind === "device" ? (r(), u(c, { key: 4 }, [
          n[8] || (n[8] = o("rect", {
            x: "4",
            y: "4",
            width: "8",
            height: "8",
            rx: "1"
          }, null, -1)),
          n[9] || (n[9] = o("path", { d: "M6.5 4 v-1.5 M9.5 4 v-1.5 M6.5 12 v1.5 M9.5 12 v1.5 M4 6.5 h-1.5 M4 9.5 h-1.5 M12 6.5 h1.5 M12 9.5 h1.5" }, null, -1))
        ], 64)) : v.kind === "unknown" ? (r(), u(c, { key: 5 }, [
          n[10] || (n[10] = o("circle", {
            cx: "8",
            cy: "8",
            r: "6"
          }, null, -1)),
          n[11] || (n[11] = o("path", { d: "M6.3 6.3 a1.8 1.8 0 1 1 2.6 1.6 c-.6 .4 -.9 .8 -.9 1.5" }, null, -1)),
          n[12] || (n[12] = o("circle", {
            cx: "8",
            cy: "11.2",
            r: ".4",
            fill: "currentColor",
            stroke: "none"
          }, null, -1))
        ], 64)) : (r(), u(c, { key: 6 }, [
          n[13] || (n[13] = o("path", { d: "M4.5 1.5 h4.6 l2.4 2.4 v9.6 a1 1 0 0 1 -1 1 h-6 a1 1 0 0 1 -1 -1 v-11 a1 1 0 0 1 1 -1 z" }, null, -1)),
          n[14] || (n[14] = o("path", { d: "M9.1 1.5 v2.4 h2.4" }, null, -1))
        ], 64))
      ], 8, Pe)),
      v.isLink && !v.broken ? (r(), u("svg", ze, [...n[15] || (n[15] = [
        o("rect", {
          x: "0.5",
          y: "0.5",
          width: "8",
          height: "8",
          rx: "1.5",
          fill: "var(--fsb-text-secondary)",
          stroke: "none"
        }, null, -1),
        o("path", { d: "M3.2 5.8 L5.8 3.2 M4 3.2 h1.8 v1.8" }, null, -1)
      ])])) : m("", !0)
    ], 4));
  }
}), q = (v, b) => {
  const f = v.__vccOpts || v;
  for (const [k, x] of b)
    f[k] = x;
  return f;
}, A = /* @__PURE__ */ q(Ke, [["__scopeId", "data-v-d916bc55"]]), He = { class: "fsb-titlebar" }, Te = { class: "fsb-title" }, je = { class: "fsb-mode-hint" }, Ve = { class: "fsb-toolbar" }, Oe = ["disabled", "title"], Ue = ["title"], Ae = {
  key: 0,
  class: "fsb-root-switcher"
}, Xe = ["title"], Ye = { class: "fsb-mono" }, qe = ["onClick"], We = { class: "fsb-menu-check" }, Ze = ["value", "placeholder"], Ge = ["title"], Je = ["title"], Qe = {
  width: "16",
  height: "16",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.5",
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
}, _e = {
  key: 0,
  d: "M2.5 2.5 L13.5 13.5"
}, et = { class: "fsb-columns" }, tt = { class: "fsb-col-name" }, nt = { class: "fsb-col-size" }, ot = { class: "fsb-col-modified" }, st = {
  key: 1,
  class: "fsb-empty"
}, it = { class: "fsb-empty-title" }, lt = { class: "fsb-empty-hint" }, rt = {
  key: 0,
  class: "fsb-row fsb-row-editing"
}, ut = ["value", "placeholder"], at = { class: "fsb-edit-hint" }, dt = ["onClick", "onDblclick", "onContextmenu"], ft = ["value"], ct = { class: "fsb-edit-hint" }, vt = { class: "fsb-name" }, bt = { class: "fsb-size fsb-mono" }, mt = { class: "fsb-modified fsb-mono" }, kt = {
  key: 0,
  class: "fsb-save-row"
}, pt = ["value", "placeholder"], ht = {
  key: 0,
  class: "fsb-save-issue"
}, wt = {
  key: 1,
  class: "fsb-save-issue"
}, yt = { class: "fsb-menu-check" }, gt = { class: "fsb-status-text" }, Ct = {
  key: 0,
  class: "fsb-spinner",
  width: "12",
  height: "12",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round"
}, xt = {
  key: 1,
  width: "12",
  height: "12",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.5",
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
}, Mt = { class: "fsb-actions" }, St = ["disabled"], $t = /* @__PURE__ */ Y({
  __name: "FsBrowser",
  props: {
    client: { default: void 0 },
    locale: { default: void 0 },
    theme: { default: void 0 },
    sizeUnit: { default: "si" },
    selectionMode: { default: "file" },
    returnMode: { default: "single" },
    initialDir: { default: void 0 },
    defaultName: { default: void 0 },
    extensions: { default: void 0 }
  },
  emits: ["select", "cancel", "error"],
  setup(v, { emit: b }) {
    const f = v, k = b, x = we(Fe, void 0), N = f.client ?? x;
    if (N === void 0)
      throw new Error(
        "FsBrowser: 需要 client, 請以 prop 傳入或以 provide(fsbClientKey, client) 注入 (計劃書第 5.3 節)."
      );
    const n = Ce(f.locale), W = w(() => xe(Me(f.theme))), { store: a, snapshot: l } = Re({
      client: N,
      selectionMode: f.selectionMode,
      returnMode: f.returnMode,
      initialDir: f.initialDir,
      defaultName: f.defaultName,
      extensions: f.extensions,
      onSelect: (s) => k("select", s),
      onCancel: () => k("cancel"),
      onError: (s) => k("error", s)
    });
    H(() => {
      a.init();
    });
    const Z = w(() => f.selectionMode === "dir" ? n("mode.dir") : f.selectionMode === "save" ? n("mode.save") : n("mode.file")), g = C(""), E = C(!1);
    ye(
      () => l.value.currentDir,
      (s) => {
        E.value || (g.value = M(s, l.value.pathStyle));
      },
      { immediate: !0 }
    );
    function G() {
      E.value = !0;
    }
    function J() {
      E.value = !1, g.value = M(l.value.currentDir, l.value.pathStyle);
    }
    function Q(s) {
      s.key === "Enter" ? (a.navigateTo(Be(g.value)), s.target.blur()) : s.key === "Escape" && (g.value = M(l.value.currentDir, l.value.pathStyle), s.target.blur());
    }
    const S = C(!1);
    function _() {
      S.value = !S.value;
    }
    function ee(s) {
      S.value = !1, a.switchRoot(s);
    }
    function te(s, e) {
      s.shiftKey ? a.selectRange(e.Path) : s.ctrlKey || s.metaKey ? a.toggleSelection(e.Path) : a.selectOnly(e.Path);
    }
    function ne(s) {
      O(s) && a.openEntry(s.Path);
    }
    const p = C(null);
    function oe(s, e) {
      s.preventDefault(), l.value.selection.includes(e.Path) || a.selectOnly(e.Path), p.value = { x: s.clientX, y: s.clientY, kind: "row" };
    }
    function se(s) {
      s.preventDefault(), p.value = { x: s.clientX, y: s.clientY, kind: "blank" };
    }
    function y() {
      p.value = null;
    }
    function $() {
      p.value !== null && y();
    }
    H(() => {
      window.addEventListener("click", $), window.addEventListener("contextmenu", $, !0);
    }), X(() => {
      window.removeEventListener("click", $), window.removeEventListener("contextmenu", $, !0);
    });
    const P = w(() => l.value.selection.length === 1);
    function ie() {
      P.value && (y(), a.beginRename(), V(() => {
        var s;
        return (s = z.value) == null ? void 0 : s.focus();
      }));
    }
    function le() {
      y(), a.requestDelete();
    }
    function re() {
      var e;
      y();
      const s = a.copyPathText();
      (e = navigator.clipboard) == null || e.writeText(s);
    }
    function I() {
      y(), a.beginNewFolder(), V(() => {
        var s;
        return (s = K.value) == null ? void 0 : s.focus();
      });
    }
    function ue() {
      y(), a.refresh();
    }
    function ae() {
      y(), a.toggleHidden();
    }
    const z = C(null), K = C(null);
    function de(s) {
      s.key === "Enter" ? a.commitRename() : s.key === "Escape" && a.cancelRename();
    }
    function fe(s) {
      s.key === "Enter" ? a.commitNewFolder() : s.key === "Escape" && a.cancelNewFolder();
    }
    function ce(s) {
      return U(s) === "dir" ? "" : Le(s.Size, f.sizeUnit);
    }
    function ve(s) {
      return Ne(s.ModTime);
    }
    function be(s) {
      return Ee(s, f.selectionMode);
    }
    function me(s) {
      s.key === "Enter" && a.confirmSelection();
    }
    const ke = w(() => f.selectionMode === "save" ? n("button.save") : n("button.select")), pe = w(() => {
      const s = l.value;
      return s.error !== null ? Se(n, s.error) : s.overwriteConfirm !== null ? n("save.overwriteConfirm", { name: s.overwriteConfirm.name }) : s.deleteConfirm !== null ? n("status.deleteConfirm", { count: s.deleteConfirm.paths.length }) : s.deleting ? n("status.deleting", { count: s.selectedCount }) : s.rename !== null ? n("status.renaming", { name: s.rename.draft || s.rename.originalName }) : s.newFolder !== null ? n("status.creating", { name: s.newFolder.draft || n("newFolder.defaultName") }) : s.loading ? n("status.loading", { path: M(s.currentDir, s.pathStyle) }) : s.selectedCount > 0 ? n("status.itemsSelected", { count: s.itemCount, selected: s.selectedCount }) : n("status.items", { count: s.itemCount });
    }), D = w(() => l.value.error !== null ? "error" : l.value.overwriteConfirm !== null || l.value.deleteConfirm !== null ? "confirm" : "neutral");
    return (s, e) => (r(), u("div", {
      class: "fsb-root",
      style: R(W.value)
    }, [
      o("div", He, [
        o("span", Te, d(t(n)("title")), 1),
        o("span", je, d(Z.value), 1)
      ]),
      o("div", Ve, [
        o("button", {
          type: "button",
          class: "fsb-btn fsb-btn-icon",
          disabled: t(l).atRoot,
          title: t(n)("toolbar.up"),
          onClick: e[0] || (e[0] = (i) => t(a).goUp())
        }, [...e[27] || (e[27] = [
          o("svg", {
            width: "16",
            height: "16",
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "1.5",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }, [
            o("path", { d: "M8 12.5 V3.5 M4 7.5 L8 3.5 L12 7.5" })
          ], -1)
        ])], 8, Oe),
        o("button", {
          type: "button",
          class: "fsb-btn fsb-btn-icon",
          title: t(n)("toolbar.home"),
          onClick: e[1] || (e[1] = (i) => t(a).goHome())
        }, [...e[28] || (e[28] = [
          o("svg", {
            width: "16",
            height: "16",
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "1.5",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }, [
            o("path", { d: "M2 8 L8 2.5 L14 8 M4 6.5 V13 h8 V6.5" })
          ], -1)
        ])], 8, Ue),
        t(l).roots.length > 1 ? (r(), u("div", Ae, [
          o("button", {
            type: "button",
            class: "fsb-btn fsb-root-btn",
            title: t(n)("toolbar.root"),
            onClick: e[2] || (e[2] = B((i) => _(), ["stop"]))
          }, [
            o("span", Ye, d(t($e)(t(l).currentRoot) || t(l).currentRoot), 1),
            e[29] || (e[29] = o("svg", {
              width: "10",
              height: "10",
              viewBox: "0 0 16 16",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "1.5",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            }, [
              o("path", { d: "M4 6 L8 10 L12 6" })
            ], -1))
          ], 8, Xe),
          S.value ? (r(), u("ul", {
            key: 0,
            class: "fsb-menu fsb-root-menu",
            onClick: e[3] || (e[3] = B(() => {
            }, ["stop"]))
          }, [
            (r(!0), u(c, null, F(t(l).roots, (i) => (r(), u("li", {
              key: i,
              class: "fsb-menu-item fsb-mono",
              onClick: (h) => ee(i)
            }, [
              o("span", We, d(i === t(l).currentRoot ? "✓" : ""), 1),
              T(" " + d(t(M)(i, t(l).pathStyle)), 1)
            ], 8, qe))), 128))
          ])) : m("", !0)
        ])) : m("", !0),
        o("input", {
          class: "fsb-path-input fsb-mono",
          type: "text",
          value: g.value,
          placeholder: t(n)("toolbar.pathPlaceholder"),
          onInput: e[4] || (e[4] = (i) => g.value = i.target.value),
          onFocus: G,
          onBlur: J,
          onKeydown: Q
        }, null, 40, Ze),
        o("button", {
          type: "button",
          class: "fsb-btn fsb-btn-icon",
          title: t(n)("toolbar.newFolder"),
          onClick: e[5] || (e[5] = (i) => I())
        }, [...e[30] || (e[30] = [
          o("svg", {
            width: "16",
            height: "16",
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "1.5",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }, [
            o("path", { d: "M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z" }),
            o("path", { d: "M8 7.5 v3.5 M6.25 9.25 h3.5" })
          ], -1)
        ])], 8, Ge),
        o("button", {
          type: "button",
          class: L(["fsb-btn fsb-btn-icon", { "fsb-btn-active": t(l).showHidden }]),
          title: t(l).showHidden ? t(n)("toolbar.hideHidden") : t(n)("toolbar.showHidden"),
          onClick: e[6] || (e[6] = (i) => t(a).toggleHidden())
        }, [
          (r(), u("svg", Qe, [
            e[31] || (e[31] = o("path", { d: "M1.5 8 C3 4.8 5.3 3.2 8 3.2 S13 4.8 14.5 8 C13 11.2 10.7 12.8 8 12.8 S3 11.2 1.5 8 Z" }, null, -1)),
            e[32] || (e[32] = o("circle", {
              cx: "8",
              cy: "8",
              r: "2"
            }, null, -1)),
            t(l).showHidden ? m("", !0) : (r(), u("path", _e))
          ]))
        ], 10, Je)
      ]),
      o("div", et, [
        o("span", tt, d(t(n)("column.name")), 1),
        o("span", nt, d(t(n)("column.size")), 1),
        o("span", ot, d(t(n)("column.modified")), 1)
      ]),
      o("div", {
        class: "fsb-list",
        onContextmenu: se
      }, [
        t(l).loading && !t(l).ready ? (r(), u(c, { key: 0 }, F(6, (i) => o("div", {
          key: i,
          class: "fsb-row fsb-skeleton-row"
        }, [...e[33] || (e[33] = [
          o("span", { class: "fsb-skeleton fsb-skeleton-icon" }, null, -1),
          o("span", { class: "fsb-skeleton fsb-skeleton-text" }, null, -1)
        ])])), 64)) : t(l).ready && t(l).entries.length === 0 && t(l).newFolder === null ? (r(), u("div", st, [
          e[34] || (e[34] = o("svg", {
            width: "48",
            height: "48",
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "var(--fsb-text-muted)",
            "stroke-width": "1",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }, [
            o("path", { d: "M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z" })
          ], -1)),
          o("p", it, d(t(n)("empty.title")), 1),
          o("p", lt, d(t(n)("empty.hint")), 1)
        ])) : (r(), u(c, { key: 2 }, [
          t(l).newFolder !== null ? (r(), u("div", rt, [
            j(A, { kind: "dir" }),
            o("input", {
              ref_key: "newFolderInput",
              ref: K,
              class: "fsb-inline-input",
              type: "text",
              value: t(l).newFolder.draft,
              placeholder: t(n)("newFolder.defaultName"),
              onInput: e[7] || (e[7] = (i) => t(a).setNewFolderDraft(i.target.value)),
              onKeydown: fe,
              onBlur: e[8] || (e[8] = (i) => t(a).commitNewFolder())
            }, null, 40, ut),
            o("span", at, d(t(n)("edit.hint")), 1)
          ])) : m("", !0),
          (r(!0), u(c, null, F(t(l).entries, (i) => (r(), u("div", {
            key: i.Path,
            class: L(["fsb-row", {
              "fsb-row-selected": t(l).selection.includes(i.Path),
              "fsb-row-hidden-item": i.Hidden,
              "fsb-row-disabled": !be(i) && !t(O)(i),
              "fsb-row-dimmed": t(a).isEntryDimmed(i)
            }]),
            onClick: (h) => te(h, i),
            onDblclick: (h) => ne(i),
            onContextmenu: (h) => oe(h, i)
          }, [
            j(A, {
              kind: t(U)(i),
              "is-link": i.IsLink,
              broken: t(De)(i)
            }, null, 8, ["kind", "is-link", "broken"]),
            t(l).rename !== null && t(l).rename.path === i.Path ? (r(), u(c, { key: 0 }, [
              o("input", {
                ref_for: !0,
                ref_key: "renameInput",
                ref: z,
                class: "fsb-inline-input",
                type: "text",
                value: t(l).rename.draft,
                onInput: e[9] || (e[9] = (h) => t(a).setRenameDraft(h.target.value)),
                onKeydown: de,
                onBlur: e[10] || (e[10] = (h) => t(a).commitRename()),
                onClick: e[11] || (e[11] = B(() => {
                }, ["stop"]))
              }, null, 40, ft),
              o("span", ct, d(t(n)("edit.hint")), 1)
            ], 64)) : (r(), u(c, { key: 1 }, [
              o("span", vt, d(i.Name), 1),
              o("span", bt, d(ce(i)), 1),
              o("span", mt, d(ve(i)), 1)
            ], 64))
          ], 42, dt))), 128))
        ], 64))
      ], 32),
      f.selectionMode === "save" ? (r(), u("div", kt, [
        o("input", {
          class: "fsb-save-input",
          type: "text",
          value: t(l).saveName,
          placeholder: t(n)("save.namePlaceholder"),
          onInput: e[12] || (e[12] = (i) => t(a).setSaveName(i.target.value)),
          onKeydown: me
        }, null, 40, pt),
        t(l).saveNameIssue === "invalid" ? (r(), u("span", ht, d(t(n)("save.invalidName")), 1)) : t(l).saveNameIssue === "isDirectory" ? (r(), u("span", wt, d(t(n)("save.isDirectory", { name: t(l).saveName })), 1)) : m("", !0)
      ])) : m("", !0),
      p.value !== null ? (r(), u("ul", {
        key: 1,
        class: "fsb-menu fsb-context-menu",
        style: R({ left: `${p.value.x}px`, top: `${p.value.y}px` }),
        onClick: e[19] || (e[19] = B(() => {
        }, ["stop"]))
      }, [
        p.value.kind === "row" ? (r(), u(c, { key: 0 }, [
          o("li", {
            class: L(["fsb-menu-item", { "fsb-menu-item-disabled": !P.value }]),
            onClick: e[13] || (e[13] = (i) => ie())
          }, d(t(n)("menu.rename")), 3),
          o("li", {
            class: "fsb-menu-item fsb-menu-item-danger",
            onClick: e[14] || (e[14] = (i) => le())
          }, d(t(l).selection.length > 1 ? t(n)("menu.deleteCount", { count: t(l).selection.length }) : t(n)("menu.delete")), 1),
          o("li", {
            class: "fsb-menu-item",
            onClick: e[15] || (e[15] = (i) => re())
          }, d(t(n)("menu.copyPath")), 1)
        ], 64)) : (r(), u(c, { key: 1 }, [
          o("li", {
            class: "fsb-menu-item",
            onClick: e[16] || (e[16] = (i) => I())
          }, d(t(n)("menu.newFolder")), 1),
          o("li", {
            class: "fsb-menu-item",
            onClick: e[17] || (e[17] = (i) => ue())
          }, d(t(n)("menu.refresh")), 1),
          o("li", {
            class: "fsb-menu-item",
            onClick: e[18] || (e[18] = (i) => ae())
          }, [
            o("span", yt, d(t(l).showHidden ? "✓" : ""), 1),
            T(" " + d(t(n)("menu.showHidden")), 1)
          ])
        ], 64))
      ], 4)) : m("", !0),
      o("div", {
        class: L(["fsb-statusbar", `fsb-statusbar-${D.value}`])
      }, [
        o("div", gt, [
          t(l).loading ? (r(), u("svg", Ct, [...e[35] || (e[35] = [
            o("path", { d: "M8 1.5 a6.5 6.5 0 1 1 -6.5 6.5" }, null, -1)
          ])])) : D.value === "error" ? (r(), u("svg", xt, [...e[36] || (e[36] = [
            o("circle", {
              cx: "8",
              cy: "8",
              r: "6.5"
            }, null, -1),
            o("path", { d: "M8 5 v4 M8 11 v.1" }, null, -1)
          ])])) : m("", !0),
          o("span", null, d(pe.value), 1),
          D.value === "error" ? (r(), u("button", {
            key: 2,
            type: "button",
            class: "fsb-status-dismiss",
            onClick: e[20] || (e[20] = (i) => t(a).dismissError())
          }, d(t(n)("button.dismissError")), 1)) : m("", !0)
        ]),
        o("div", Mt, [
          t(l).overwriteConfirm !== null ? (r(), u(c, { key: 0 }, [
            o("button", {
              type: "button",
              class: "fsb-btn",
              onClick: e[21] || (e[21] = (i) => t(a).cancelOverwrite())
            }, d(t(n)("button.cancel")), 1),
            o("button", {
              type: "button",
              class: "fsb-btn fsb-btn-danger",
              onClick: e[22] || (e[22] = (i) => t(a).confirmOverwrite())
            }, d(t(n)("button.overwrite")), 1)
          ], 64)) : D.value === "confirm" ? (r(), u(c, { key: 1 }, [
            o("button", {
              type: "button",
              class: "fsb-btn",
              onClick: e[23] || (e[23] = (i) => t(a).cancelDelete())
            }, d(t(n)("button.cancel")), 1),
            o("button", {
              type: "button",
              class: "fsb-btn fsb-btn-danger",
              onClick: e[24] || (e[24] = (i) => t(a).confirmDelete())
            }, d(t(n)("button.delete")), 1)
          ], 64)) : (r(), u(c, { key: 2 }, [
            o("button", {
              type: "button",
              class: "fsb-btn",
              onClick: e[25] || (e[25] = (i) => t(a).cancel())
            }, d(t(n)("button.cancel")), 1),
            o("button", {
              type: "button",
              class: "fsb-btn fsb-btn-primary",
              disabled: !t(l).canConfirmSelection,
              onClick: e[26] || (e[26] = (i) => t(a).confirmSelection())
            }, d(ke.value), 9, St)
          ], 64))
        ])
      ], 2)
    ], 4));
  }
}), Lt = /* @__PURE__ */ q($t, [["__scopeId", "data-v-6eefb8b0"]]);
export {
  Lt as FsBrowser,
  Fe as fsbClientKey,
  Re as useBrowserStore
};
