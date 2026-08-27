import { shallowRef as Ce, onBeforeUnmount as P, defineComponent as Z, computed as y, openBlock as r, createElementBlock as u, normalizeStyle as I, Fragment as c, createElementVNode as o, createCommentVNode as m, inject as xe, ref as C, watch as V, onMounted as O, toDisplayString as d, unref as t, withModifiers as L, renderList as R, createTextVNode as U, normalizeClass as N, createVNode as A, nextTick as X } from "vue";
import { createBrowserStore as Me, createTranslator as Se, themeToCssVars as $e, resolveTheme as De, toDisplayPath as S, formatErrorText as Be, baseName as Le, isDirectoryLike as Y, isBrokenLink as Ne, effectiveKind as q, subscribeSystemTheme as Ee, fromDisplayPath as Fe, formatSize as Re, formatDateTime as Pe, isSelectableAs as Ie } from "@nexgus/fsb-core";
const ze = Symbol("fsbClient");
function Ke(v) {
  const b = Me(v), f = Ce(b.getSnapshot()), k = b.subscribe(() => {
    f.value = b.getSnapshot();
  });
  return P(k), { store: b, snapshot: f };
}
const Te = ["stroke"], He = {
  key: 1,
  d: "M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z"
}, je = {
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
}, Ve = /* @__PURE__ */ Z({
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
    }, k = y(() => b.broken ? "var(--fsb-error-text)" : b.kind === "dir" ? "var(--fsb-folder-icon)" : f[b.kind] !== void 0 ? f[b.kind] : "var(--fsb-file-icon)"), M = y(() => b.broken ? 0.55 : 1);
    return (E, n) => (r(), u("span", {
      class: "fsb-icon",
      style: I({ opacity: M.value })
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
        ], 64)) : v.kind === "dir" ? (r(), u("path", He)) : v.kind === "socket" ? (r(), u(c, { key: 2 }, [
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
      ], 8, Te)),
      v.isLink && !v.broken ? (r(), u("svg", je, [...n[15] || (n[15] = [
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
}), G = (v, b) => {
  const f = v.__vccOpts || v;
  for (const [k, M] of b)
    f[k] = M;
  return f;
}, W = /* @__PURE__ */ G(Ve, [["__scopeId", "data-v-d916bc55"]]), Oe = { class: "fsb-titlebar" }, Ue = { class: "fsb-title" }, Ae = { class: "fsb-mode-hint" }, Xe = { class: "fsb-toolbar" }, Ye = ["disabled", "title"], qe = ["title"], We = {
  key: 0,
  class: "fsb-root-switcher"
}, Ze = ["title"], Ge = { class: "fsb-mono" }, Je = ["onClick"], Qe = { class: "fsb-menu-check" }, _e = ["value", "placeholder"], et = ["title"], tt = ["title"], nt = {
  width: "16",
  height: "16",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.5",
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
}, ot = {
  key: 0,
  d: "M2.5 2.5 L13.5 13.5"
}, st = { class: "fsb-columns" }, lt = { class: "fsb-col-name" }, it = { class: "fsb-col-size" }, rt = { class: "fsb-col-modified" }, ut = {
  key: 1,
  class: "fsb-empty"
}, at = { class: "fsb-empty-title" }, dt = { class: "fsb-empty-hint" }, ft = {
  key: 0,
  class: "fsb-row fsb-row-editing"
}, ct = ["value", "placeholder"], vt = { class: "fsb-edit-hint" }, bt = ["onClick", "onDblclick", "onContextmenu"], mt = ["value"], kt = { class: "fsb-edit-hint" }, pt = { class: "fsb-name" }, ht = { class: "fsb-size fsb-mono" }, wt = { class: "fsb-modified fsb-mono" }, yt = {
  key: 0,
  class: "fsb-save-row"
}, gt = ["value", "placeholder"], Ct = {
  key: 0,
  class: "fsb-save-issue"
}, xt = {
  key: 1,
  class: "fsb-save-issue"
}, Mt = { class: "fsb-menu-check" }, St = { class: "fsb-status-text" }, $t = {
  key: 0,
  class: "fsb-spinner",
  width: "12",
  height: "12",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round"
}, Dt = {
  key: 1,
  width: "12",
  height: "12",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.5",
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
}, Bt = { class: "fsb-actions" }, Lt = ["disabled"], Nt = /* @__PURE__ */ Z({
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
    const f = v, k = b, M = xe(ze, void 0), E = f.client ?? M;
    if (E === void 0)
      throw new Error(
        "FsBrowser: 需要 client, 請以 prop 傳入或以 provide(fsbClientKey, client) 注入 (計劃書第 5.3 節)."
      );
    const n = Se(f.locale), z = C(0);
    let p = null;
    function J() {
      p == null || p(), p = null, f.theme === "auto" && (p = Ee(() => {
        z.value += 1;
      }));
    }
    V(() => f.theme, J, { immediate: !0 }), P(() => {
      p == null || p(), p = null;
    });
    const Q = y(() => (z.value, $e(De(f.theme)))), { store: a, snapshot: i } = Ke({
      client: E,
      selectionMode: f.selectionMode,
      returnMode: f.returnMode,
      initialDir: f.initialDir,
      defaultName: f.defaultName,
      extensions: f.extensions,
      onSelect: (s) => k("select", s),
      onCancel: () => k("cancel"),
      onError: (s) => k("error", s)
    });
    O(() => {
      a.init();
    });
    const _ = y(() => f.selectionMode === "dir" ? n("mode.dir") : f.selectionMode === "save" ? n("mode.save") : n("mode.file")), x = C(""), F = C(!1);
    V(
      () => i.value.currentDir,
      (s) => {
        F.value || (x.value = S(s, i.value.pathStyle));
      },
      { immediate: !0 }
    );
    function ee() {
      F.value = !0;
    }
    function te() {
      F.value = !1, x.value = S(i.value.currentDir, i.value.pathStyle);
    }
    function ne(s) {
      s.key === "Enter" ? (a.navigateTo(Fe(x.value)), s.target.blur()) : s.key === "Escape" && (x.value = S(i.value.currentDir, i.value.pathStyle), s.target.blur());
    }
    const $ = C(!1);
    function oe() {
      $.value = !$.value;
    }
    function se(s) {
      $.value = !1, a.switchRoot(s);
    }
    function le(s, e) {
      s.shiftKey ? a.selectRange(e.Path) : s.ctrlKey || s.metaKey ? a.toggleSelection(e.Path) : a.selectOnly(e.Path);
    }
    function ie(s) {
      Y(s) && a.openEntry(s.Path);
    }
    const h = C(null);
    function re(s, e) {
      s.preventDefault(), i.value.selection.includes(e.Path) || a.selectOnly(e.Path), h.value = { x: s.clientX, y: s.clientY, kind: "row" };
    }
    function ue(s) {
      s.preventDefault(), h.value = { x: s.clientX, y: s.clientY, kind: "blank" };
    }
    function g() {
      h.value = null;
    }
    function D() {
      h.value !== null && g();
    }
    O(() => {
      window.addEventListener("click", D), window.addEventListener("contextmenu", D, !0);
    }), P(() => {
      window.removeEventListener("click", D), window.removeEventListener("contextmenu", D, !0);
    });
    const K = y(() => i.value.selection.length === 1);
    function ae() {
      K.value && (g(), a.beginRename(), X(() => {
        var s;
        return (s = H.value) == null ? void 0 : s.focus();
      }));
    }
    function de() {
      g(), a.requestDelete();
    }
    function fe() {
      var e;
      g();
      const s = a.copyPathText();
      (e = navigator.clipboard) == null || e.writeText(s);
    }
    function T() {
      g(), a.beginNewFolder(), X(() => {
        var s;
        return (s = j.value) == null ? void 0 : s.focus();
      });
    }
    function ce() {
      g(), a.refresh();
    }
    function ve() {
      g(), a.toggleHidden();
    }
    const H = C(null), j = C(null);
    function be(s) {
      s.key === "Enter" ? a.commitRename() : s.key === "Escape" && a.cancelRename();
    }
    function me(s) {
      s.key === "Enter" ? a.commitNewFolder() : s.key === "Escape" && a.cancelNewFolder();
    }
    function ke(s) {
      return q(s) === "dir" ? "" : Re(s.Size, f.sizeUnit);
    }
    function pe(s) {
      return Pe(s.ModTime);
    }
    function he(s) {
      return Ie(s, f.selectionMode);
    }
    function we(s) {
      s.key === "Enter" && a.confirmSelection();
    }
    const ye = y(() => f.selectionMode === "save" ? n("button.save") : n("button.select")), ge = y(() => {
      const s = i.value;
      return s.error !== null ? Be(n, s.error) : s.overwriteConfirm !== null ? n("save.overwriteConfirm", { name: s.overwriteConfirm.name }) : s.deleteConfirm !== null ? n("status.deleteConfirm", { count: s.deleteConfirm.paths.length }) : s.deleting ? n("status.deleting", { count: s.selectedCount }) : s.rename !== null ? n("status.renaming", { name: s.rename.draft || s.rename.originalName }) : s.newFolder !== null ? n("status.creating", { name: s.newFolder.draft || n("newFolder.defaultName") }) : s.loading ? n("status.loading", { path: S(s.currentDir, s.pathStyle) }) : s.selectedCount > 0 ? n("status.itemsSelected", { count: s.itemCount, selected: s.selectedCount }) : n("status.items", { count: s.itemCount });
    }), B = y(() => i.value.error !== null ? "error" : i.value.overwriteConfirm !== null || i.value.deleteConfirm !== null ? "confirm" : "neutral");
    return (s, e) => (r(), u("div", {
      class: "fsb-root",
      style: I(Q.value)
    }, [
      o("div", Oe, [
        o("span", Ue, d(t(n)("title")), 1),
        o("span", Ae, d(_.value), 1)
      ]),
      o("div", Xe, [
        o("button", {
          type: "button",
          class: "fsb-btn fsb-btn-icon",
          disabled: t(i).atRoot,
          title: t(n)("toolbar.up"),
          onClick: e[0] || (e[0] = (l) => t(a).goUp())
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
        ])], 8, Ye),
        o("button", {
          type: "button",
          class: "fsb-btn fsb-btn-icon",
          title: t(n)("toolbar.home"),
          onClick: e[1] || (e[1] = (l) => t(a).goHome())
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
        ])], 8, qe),
        t(i).roots.length > 1 ? (r(), u("div", We, [
          o("button", {
            type: "button",
            class: "fsb-btn fsb-root-btn",
            title: t(n)("toolbar.root"),
            onClick: e[2] || (e[2] = L((l) => oe(), ["stop"]))
          }, [
            o("span", Ge, d(t(Le)(t(i).currentRoot) || t(i).currentRoot), 1),
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
          ], 8, Ze),
          $.value ? (r(), u("ul", {
            key: 0,
            class: "fsb-menu fsb-root-menu",
            onClick: e[3] || (e[3] = L(() => {
            }, ["stop"]))
          }, [
            (r(!0), u(c, null, R(t(i).roots, (l) => (r(), u("li", {
              key: l,
              class: "fsb-menu-item fsb-mono",
              onClick: (w) => se(l)
            }, [
              o("span", Qe, d(l === t(i).currentRoot ? "✓" : ""), 1),
              U(" " + d(t(S)(l, t(i).pathStyle)), 1)
            ], 8, Je))), 128))
          ])) : m("", !0)
        ])) : m("", !0),
        o("input", {
          class: "fsb-path-input fsb-mono",
          type: "text",
          value: x.value,
          placeholder: t(n)("toolbar.pathPlaceholder"),
          onInput: e[4] || (e[4] = (l) => x.value = l.target.value),
          onFocus: ee,
          onBlur: te,
          onKeydown: ne
        }, null, 40, _e),
        o("button", {
          type: "button",
          class: "fsb-btn fsb-btn-icon",
          title: t(n)("toolbar.newFolder"),
          onClick: e[5] || (e[5] = (l) => T())
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
        ])], 8, et),
        o("button", {
          type: "button",
          class: N(["fsb-btn fsb-btn-icon", { "fsb-btn-active": t(i).showHidden }]),
          title: t(i).showHidden ? t(n)("toolbar.hideHidden") : t(n)("toolbar.showHidden"),
          onClick: e[6] || (e[6] = (l) => t(a).toggleHidden())
        }, [
          (r(), u("svg", nt, [
            e[31] || (e[31] = o("path", { d: "M1.5 8 C3 4.8 5.3 3.2 8 3.2 S13 4.8 14.5 8 C13 11.2 10.7 12.8 8 12.8 S3 11.2 1.5 8 Z" }, null, -1)),
            e[32] || (e[32] = o("circle", {
              cx: "8",
              cy: "8",
              r: "2"
            }, null, -1)),
            t(i).showHidden ? m("", !0) : (r(), u("path", ot))
          ]))
        ], 10, tt)
      ]),
      o("div", st, [
        o("span", lt, d(t(n)("column.name")), 1),
        o("span", it, d(t(n)("column.size")), 1),
        o("span", rt, d(t(n)("column.modified")), 1)
      ]),
      o("div", {
        class: "fsb-list",
        onContextmenu: ue
      }, [
        t(i).loading && !t(i).ready ? (r(), u(c, { key: 0 }, R(6, (l) => o("div", {
          key: l,
          class: "fsb-row fsb-skeleton-row"
        }, [...e[33] || (e[33] = [
          o("span", { class: "fsb-skeleton fsb-skeleton-icon" }, null, -1),
          o("span", { class: "fsb-skeleton fsb-skeleton-text" }, null, -1)
        ])])), 64)) : t(i).ready && t(i).entries.length === 0 && t(i).newFolder === null ? (r(), u("div", ut, [
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
          o("p", at, d(t(n)("empty.title")), 1),
          o("p", dt, d(t(n)("empty.hint")), 1)
        ])) : (r(), u(c, { key: 2 }, [
          t(i).newFolder !== null ? (r(), u("div", ft, [
            A(W, { kind: "dir" }),
            o("input", {
              ref_key: "newFolderInput",
              ref: j,
              class: "fsb-inline-input",
              type: "text",
              value: t(i).newFolder.draft,
              placeholder: t(n)("newFolder.defaultName"),
              onInput: e[7] || (e[7] = (l) => t(a).setNewFolderDraft(l.target.value)),
              onKeydown: me,
              onBlur: e[8] || (e[8] = (l) => t(a).commitNewFolder())
            }, null, 40, ct),
            o("span", vt, d(t(n)("edit.hint")), 1)
          ])) : m("", !0),
          (r(!0), u(c, null, R(t(i).entries, (l) => (r(), u("div", {
            key: l.Path,
            class: N(["fsb-row", {
              "fsb-row-selected": t(i).selection.includes(l.Path),
              "fsb-row-hidden-item": l.Hidden,
              "fsb-row-disabled": !he(l) && !t(Y)(l),
              "fsb-row-dimmed": t(a).isEntryDimmed(l)
            }]),
            onClick: (w) => le(w, l),
            onDblclick: (w) => ie(l),
            onContextmenu: (w) => re(w, l)
          }, [
            A(W, {
              kind: t(q)(l),
              "is-link": l.IsLink,
              broken: t(Ne)(l)
            }, null, 8, ["kind", "is-link", "broken"]),
            t(i).rename !== null && t(i).rename.path === l.Path ? (r(), u(c, { key: 0 }, [
              o("input", {
                ref_for: !0,
                ref_key: "renameInput",
                ref: H,
                class: "fsb-inline-input",
                type: "text",
                value: t(i).rename.draft,
                onInput: e[9] || (e[9] = (w) => t(a).setRenameDraft(w.target.value)),
                onKeydown: be,
                onBlur: e[10] || (e[10] = (w) => t(a).commitRename()),
                onClick: e[11] || (e[11] = L(() => {
                }, ["stop"]))
              }, null, 40, mt),
              o("span", kt, d(t(n)("edit.hint")), 1)
            ], 64)) : (r(), u(c, { key: 1 }, [
              o("span", pt, d(l.Name), 1),
              o("span", ht, d(ke(l)), 1),
              o("span", wt, d(pe(l)), 1)
            ], 64))
          ], 42, bt))), 128))
        ], 64))
      ], 32),
      f.selectionMode === "save" ? (r(), u("div", yt, [
        o("input", {
          class: "fsb-save-input",
          type: "text",
          value: t(i).saveName,
          placeholder: t(n)("save.namePlaceholder"),
          onInput: e[12] || (e[12] = (l) => t(a).setSaveName(l.target.value)),
          onKeydown: we
        }, null, 40, gt),
        t(i).saveNameIssue === "invalid" ? (r(), u("span", Ct, d(t(n)("save.invalidName")), 1)) : t(i).saveNameIssue === "isDirectory" ? (r(), u("span", xt, d(t(n)("save.isDirectory", { name: t(i).saveName })), 1)) : m("", !0)
      ])) : m("", !0),
      h.value !== null ? (r(), u("ul", {
        key: 1,
        class: "fsb-menu fsb-context-menu",
        style: I({ left: `${h.value.x}px`, top: `${h.value.y}px` }),
        onClick: e[19] || (e[19] = L(() => {
        }, ["stop"]))
      }, [
        h.value.kind === "row" ? (r(), u(c, { key: 0 }, [
          o("li", {
            class: N(["fsb-menu-item", { "fsb-menu-item-disabled": !K.value }]),
            onClick: e[13] || (e[13] = (l) => ae())
          }, d(t(n)("menu.rename")), 3),
          o("li", {
            class: "fsb-menu-item fsb-menu-item-danger",
            onClick: e[14] || (e[14] = (l) => de())
          }, d(t(i).selection.length > 1 ? t(n)("menu.deleteCount", { count: t(i).selection.length }) : t(n)("menu.delete")), 1),
          o("li", {
            class: "fsb-menu-item",
            onClick: e[15] || (e[15] = (l) => fe())
          }, d(t(n)("menu.copyPath")), 1)
        ], 64)) : (r(), u(c, { key: 1 }, [
          o("li", {
            class: "fsb-menu-item",
            onClick: e[16] || (e[16] = (l) => T())
          }, d(t(n)("menu.newFolder")), 1),
          o("li", {
            class: "fsb-menu-item",
            onClick: e[17] || (e[17] = (l) => ce())
          }, d(t(n)("menu.refresh")), 1),
          o("li", {
            class: "fsb-menu-item",
            onClick: e[18] || (e[18] = (l) => ve())
          }, [
            o("span", Mt, d(t(i).showHidden ? "✓" : ""), 1),
            U(" " + d(t(n)("menu.showHidden")), 1)
          ])
        ], 64))
      ], 4)) : m("", !0),
      o("div", {
        class: N(["fsb-statusbar", `fsb-statusbar-${B.value}`])
      }, [
        o("div", St, [
          t(i).loading ? (r(), u("svg", $t, [...e[35] || (e[35] = [
            o("path", { d: "M8 1.5 a6.5 6.5 0 1 1 -6.5 6.5" }, null, -1)
          ])])) : B.value === "error" ? (r(), u("svg", Dt, [...e[36] || (e[36] = [
            o("circle", {
              cx: "8",
              cy: "8",
              r: "6.5"
            }, null, -1),
            o("path", { d: "M8 5 v4 M8 11 v.1" }, null, -1)
          ])])) : m("", !0),
          o("span", null, d(ge.value), 1),
          B.value === "error" ? (r(), u("button", {
            key: 2,
            type: "button",
            class: "fsb-status-dismiss",
            onClick: e[20] || (e[20] = (l) => t(a).dismissError())
          }, d(t(n)("button.dismissError")), 1)) : m("", !0)
        ]),
        o("div", Bt, [
          t(i).overwriteConfirm !== null ? (r(), u(c, { key: 0 }, [
            o("button", {
              type: "button",
              class: "fsb-btn",
              onClick: e[21] || (e[21] = (l) => t(a).cancelOverwrite())
            }, d(t(n)("button.cancel")), 1),
            o("button", {
              type: "button",
              class: "fsb-btn fsb-btn-danger",
              onClick: e[22] || (e[22] = (l) => t(a).confirmOverwrite())
            }, d(t(n)("button.overwrite")), 1)
          ], 64)) : B.value === "confirm" ? (r(), u(c, { key: 1 }, [
            o("button", {
              type: "button",
              class: "fsb-btn",
              onClick: e[23] || (e[23] = (l) => t(a).cancelDelete())
            }, d(t(n)("button.cancel")), 1),
            o("button", {
              type: "button",
              class: "fsb-btn fsb-btn-danger",
              onClick: e[24] || (e[24] = (l) => t(a).confirmDelete())
            }, d(t(n)("button.delete")), 1)
          ], 64)) : (r(), u(c, { key: 2 }, [
            o("button", {
              type: "button",
              class: "fsb-btn",
              onClick: e[25] || (e[25] = (l) => t(a).cancel())
            }, d(t(n)("button.cancel")), 1),
            o("button", {
              type: "button",
              class: "fsb-btn fsb-btn-primary",
              disabled: !t(i).canConfirmSelection,
              onClick: e[26] || (e[26] = (l) => t(a).confirmSelection())
            }, d(ye.value), 9, Lt)
          ], 64))
        ])
      ], 2)
    ], 4));
  }
}), Rt = /* @__PURE__ */ G(Nt, [["__scopeId", "data-v-93ae16ae"]]);
export {
  Rt as FsBrowser,
  ze as fsbClientKey,
  Ke as useBrowserStore
};
