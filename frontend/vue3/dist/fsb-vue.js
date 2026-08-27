import { shallowRef as me, onBeforeUnmount as X, defineComponent as Y, computed as y, openBlock as r, createElementBlock as u, normalizeStyle as P, Fragment as b, createElementVNode as t, createCommentVNode as h, inject as pe, onMounted as T, ref as C, watch as he, toDisplayString as a, unref as o, withModifiers as L, renderList as R, createTextVNode as K, normalizeClass as D, createVNode as j, nextTick as V } from "vue";
import { createBrowserStore as we, createTranslator as ye, themeToCssVars as ge, resolveTheme as Ce, toDisplayPath as M, formatErrorText as xe, baseName as Me, isDirectoryLike as O, isBrokenLink as $e, effectiveKind as U, fromDisplayPath as Be, formatSize as Se, formatDateTime as Le, isSelectableAs as De } from "@nexgus/fsb-core";
const Fe = Symbol("fsbClient");
function Ee(c) {
  const v = we(c), f = me(v.getSnapshot()), k = v.subscribe(() => {
    f.value = v.getSnapshot();
  });
  return X(k), { store: v, snapshot: f };
}
const Re = ["stroke"], Pe = {
  key: 1,
  d: "M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z"
}, Ne = {
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
}, ze = /* @__PURE__ */ Y({
  __name: "EntryIcon",
  props: {
    kind: {},
    isLink: { type: Boolean },
    broken: { type: Boolean }
  },
  setup(c) {
    const v = c, f = {
      socket: "#8a63d2",
      fifo: "#3f9c9c",
      device: "#b8860b"
    }, k = y(() => v.broken ? "var(--fsb-error-text)" : v.kind === "dir" ? "var(--fsb-folder-icon)" : f[v.kind] !== void 0 ? f[v.kind] : "var(--fsb-file-icon)"), x = y(() => v.broken ? 0.55 : 1);
    return (F, n) => (r(), u("span", {
      class: "fsb-icon",
      style: P({ opacity: x.value })
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
        c.broken ? (r(), u(b, { key: 0 }, [
          n[0] || (n[0] = t("path", { d: "M6 10 L4 12 a2 2 0 1 1 -2.8 -2.8 L3 7.4" }, null, -1)),
          n[1] || (n[1] = t("path", { d: "M10 6 L12 4 a2 2 0 1 1 2.8 2.8 L14 8.6" }, null, -1)),
          n[2] || (n[2] = t("path", {
            d: "M6.5 9.5 L9.5 6.5",
            "stroke-dasharray": "1.4 1.4"
          }, null, -1))
        ], 64)) : c.kind === "dir" ? (r(), u("path", Pe)) : c.kind === "socket" ? (r(), u(b, { key: 2 }, [
          n[3] || (n[3] = t("path", { d: "M5 2.5 v3 M11 2.5 v3 M4 5.5 h8 v3 a4 4 0 0 1 -8 0 z" }, null, -1)),
          n[4] || (n[4] = t("path", { d: "M8 12.5 v2" }, null, -1))
        ], 64)) : c.kind === "fifo" ? (r(), u(b, { key: 3 }, [
          n[5] || (n[5] = t("path", { d: "M2 6 h5 a2 2 0 0 1 2 2 a2 2 0 0 0 2 2 h3" }, null, -1)),
          n[6] || (n[6] = t("circle", {
            cx: "2",
            cy: "6",
            r: "1"
          }, null, -1)),
          n[7] || (n[7] = t("circle", {
            cx: "14",
            cy: "10",
            r: "1"
          }, null, -1))
        ], 64)) : c.kind === "device" ? (r(), u(b, { key: 4 }, [
          n[8] || (n[8] = t("rect", {
            x: "4",
            y: "4",
            width: "8",
            height: "8",
            rx: "1"
          }, null, -1)),
          n[9] || (n[9] = t("path", { d: "M6.5 4 v-1.5 M9.5 4 v-1.5 M6.5 12 v1.5 M9.5 12 v1.5 M4 6.5 h-1.5 M4 9.5 h-1.5 M12 6.5 h1.5 M12 9.5 h1.5" }, null, -1))
        ], 64)) : c.kind === "unknown" ? (r(), u(b, { key: 5 }, [
          n[10] || (n[10] = t("circle", {
            cx: "8",
            cy: "8",
            r: "6"
          }, null, -1)),
          n[11] || (n[11] = t("path", { d: "M6.3 6.3 a1.8 1.8 0 1 1 2.6 1.6 c-.6 .4 -.9 .8 -.9 1.5" }, null, -1)),
          n[12] || (n[12] = t("circle", {
            cx: "8",
            cy: "11.2",
            r: ".4",
            fill: "currentColor",
            stroke: "none"
          }, null, -1))
        ], 64)) : (r(), u(b, { key: 6 }, [
          n[13] || (n[13] = t("path", { d: "M4.5 1.5 h4.6 l2.4 2.4 v9.6 a1 1 0 0 1 -1 1 h-6 a1 1 0 0 1 -1 -1 v-11 a1 1 0 0 1 1 -1 z" }, null, -1)),
          n[14] || (n[14] = t("path", { d: "M9.1 1.5 v2.4 h2.4" }, null, -1))
        ], 64))
      ], 8, Re)),
      c.isLink && !c.broken ? (r(), u("svg", Ne, [...n[15] || (n[15] = [
        t("rect", {
          x: "0.5",
          y: "0.5",
          width: "8",
          height: "8",
          rx: "1.5",
          fill: "var(--fsb-text-secondary)",
          stroke: "none"
        }, null, -1),
        t("path", { d: "M3.2 5.8 L5.8 3.2 M4 3.2 h1.8 v1.8" }, null, -1)
      ])])) : h("", !0)
    ], 4));
  }
}), q = (c, v) => {
  const f = c.__vccOpts || c;
  for (const [k, x] of v)
    f[k] = x;
  return f;
}, A = /* @__PURE__ */ q(ze, [["__scopeId", "data-v-d916bc55"]]), He = { class: "fsb-titlebar" }, Ie = { class: "fsb-title" }, Te = { class: "fsb-mode-hint" }, Ke = { class: "fsb-toolbar" }, je = ["disabled", "title"], Ve = ["title"], Oe = {
  key: 0,
  class: "fsb-root-switcher"
}, Ue = ["title"], Ae = { class: "fsb-mono" }, Xe = ["onClick"], Ye = { class: "fsb-menu-check" }, qe = ["value", "placeholder"], We = ["title"], Ze = ["title"], Ge = {
  width: "16",
  height: "16",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.5",
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
}, Je = {
  key: 0,
  d: "M2.5 2.5 L13.5 13.5"
}, Qe = { class: "fsb-columns" }, _e = { class: "fsb-col-name" }, et = { class: "fsb-col-size" }, tt = { class: "fsb-col-modified" }, nt = {
  key: 1,
  class: "fsb-empty"
}, ot = { class: "fsb-empty-title" }, st = { class: "fsb-empty-hint" }, lt = {
  key: 0,
  class: "fsb-row fsb-row-editing"
}, it = ["value", "placeholder"], rt = { class: "fsb-edit-hint" }, ut = ["onClick", "onDblclick", "onContextmenu"], dt = ["value"], at = { class: "fsb-edit-hint" }, ft = { class: "fsb-name" }, ct = { class: "fsb-size fsb-mono" }, bt = { class: "fsb-modified fsb-mono" }, vt = { class: "fsb-menu-check" }, kt = { class: "fsb-status-text" }, mt = {
  key: 0,
  class: "fsb-spinner",
  width: "12",
  height: "12",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round"
}, pt = {
  key: 1,
  width: "12",
  height: "12",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.5",
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
}, ht = { class: "fsb-actions" }, wt = ["disabled"], yt = /* @__PURE__ */ Y({
  __name: "FsBrowser",
  props: {
    client: { default: void 0 },
    locale: { default: void 0 },
    theme: { default: void 0 },
    sizeUnit: { default: "si" },
    selectionMode: { default: "file" },
    returnMode: { default: "single" },
    initialDir: { default: void 0 }
  },
  emits: ["select", "cancel", "error"],
  setup(c, { emit: v }) {
    const f = c, k = v, x = pe(Fe, void 0), F = f.client ?? x;
    if (F === void 0)
      throw new Error(
        "FsBrowser: 需要 client, 請以 prop 傳入或以 provide(fsbClientKey, client) 注入 (計劃書第 5.3 節)."
      );
    const n = ye(f.locale), W = y(() => ge(Ce(f.theme))), { store: d, snapshot: i } = Ee({
      client: F,
      selectionMode: f.selectionMode,
      returnMode: f.returnMode,
      initialDir: f.initialDir,
      onSelect: (s) => k("select", s),
      onCancel: () => k("cancel"),
      onError: (s) => k("error", s)
    });
    T(() => {
      d.init();
    });
    const Z = y(() => f.selectionMode === "dir" ? n("mode.dir") : n("mode.file")), g = C(""), E = C(!1);
    he(
      () => i.value.currentDir,
      (s) => {
        E.value || (g.value = M(s, i.value.pathStyle));
      },
      { immediate: !0 }
    );
    function G() {
      E.value = !0;
    }
    function J() {
      E.value = !1, g.value = M(i.value.currentDir, i.value.pathStyle);
    }
    function Q(s) {
      s.key === "Enter" ? (d.navigateTo(Be(g.value)), s.target.blur()) : s.key === "Escape" && (g.value = M(i.value.currentDir, i.value.pathStyle), s.target.blur());
    }
    const $ = C(!1);
    function _() {
      $.value = !$.value;
    }
    function ee(s) {
      $.value = !1, d.switchRoot(s);
    }
    function te(s, e) {
      s.shiftKey ? d.selectRange(e.Path) : s.ctrlKey || s.metaKey ? d.toggleSelection(e.Path) : d.selectOnly(e.Path);
    }
    function ne(s) {
      O(s) && d.openEntry(s.Path);
    }
    const m = C(null);
    function oe(s, e) {
      s.preventDefault(), i.value.selection.includes(e.Path) || d.selectOnly(e.Path), m.value = { x: s.clientX, y: s.clientY, kind: "row" };
    }
    function se(s) {
      s.preventDefault(), m.value = { x: s.clientX, y: s.clientY, kind: "blank" };
    }
    function w() {
      m.value = null;
    }
    function B() {
      m.value !== null && w();
    }
    T(() => {
      window.addEventListener("click", B), window.addEventListener("contextmenu", B, !0);
    }), X(() => {
      window.removeEventListener("click", B), window.removeEventListener("contextmenu", B, !0);
    });
    const N = y(() => i.value.selection.length === 1);
    function le() {
      N.value && (w(), d.beginRename(), V(() => {
        var s;
        return (s = H.value) == null ? void 0 : s.focus();
      }));
    }
    function ie() {
      w(), d.requestDelete();
    }
    function re() {
      var e;
      w();
      const s = d.copyPathText();
      (e = navigator.clipboard) == null || e.writeText(s);
    }
    function z() {
      w(), d.beginNewFolder(), V(() => {
        var s;
        return (s = I.value) == null ? void 0 : s.focus();
      });
    }
    function ue() {
      w(), d.refresh();
    }
    function de() {
      w(), d.toggleHidden();
    }
    const H = C(null), I = C(null);
    function ae(s) {
      s.key === "Enter" ? d.commitRename() : s.key === "Escape" && d.cancelRename();
    }
    function fe(s) {
      s.key === "Enter" ? d.commitNewFolder() : s.key === "Escape" && d.cancelNewFolder();
    }
    function ce(s) {
      return U(s) === "dir" ? "" : Se(s.Size, f.sizeUnit);
    }
    function be(s) {
      return Le(s.ModTime);
    }
    function ve(s) {
      return De(s, f.selectionMode);
    }
    const ke = y(() => {
      const s = i.value;
      return s.error !== null ? xe(n, s.error) : s.deleteConfirm !== null ? n("status.deleteConfirm", { count: s.deleteConfirm.paths.length }) : s.deleting ? n("status.deleting", { count: s.selectedCount }) : s.rename !== null ? n("status.renaming", { name: s.rename.draft || s.rename.originalName }) : s.newFolder !== null ? n("status.creating", { name: s.newFolder.draft || n("newFolder.defaultName") }) : s.loading ? n("status.loading", { path: M(s.currentDir, s.pathStyle) }) : s.selectedCount > 0 ? n("status.itemsSelected", { count: s.itemCount, selected: s.selectedCount }) : n("status.items", { count: s.itemCount });
    }), S = y(() => i.value.error !== null ? "error" : i.value.deleteConfirm !== null ? "confirm" : "neutral");
    return (s, e) => (r(), u("div", {
      class: "fsb-root",
      style: P(W.value)
    }, [
      t("div", He, [
        t("span", Ie, a(o(n)("title")), 1),
        t("span", Te, a(Z.value), 1)
      ]),
      t("div", Ke, [
        t("button", {
          type: "button",
          class: "fsb-btn fsb-btn-icon",
          disabled: o(i).atRoot,
          title: o(n)("toolbar.up"),
          onClick: e[0] || (e[0] = (l) => o(d).goUp())
        }, [...e[24] || (e[24] = [
          t("svg", {
            width: "16",
            height: "16",
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "1.5",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }, [
            t("path", { d: "M8 12.5 V3.5 M4 7.5 L8 3.5 L12 7.5" })
          ], -1)
        ])], 8, je),
        t("button", {
          type: "button",
          class: "fsb-btn fsb-btn-icon",
          title: o(n)("toolbar.home"),
          onClick: e[1] || (e[1] = (l) => o(d).goHome())
        }, [...e[25] || (e[25] = [
          t("svg", {
            width: "16",
            height: "16",
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "1.5",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }, [
            t("path", { d: "M2 8 L8 2.5 L14 8 M4 6.5 V13 h8 V6.5" })
          ], -1)
        ])], 8, Ve),
        o(i).roots.length > 1 ? (r(), u("div", Oe, [
          t("button", {
            type: "button",
            class: "fsb-btn fsb-root-btn",
            title: o(n)("toolbar.root"),
            onClick: e[2] || (e[2] = L((l) => _(), ["stop"]))
          }, [
            t("span", Ae, a(o(Me)(o(i).currentRoot) || o(i).currentRoot), 1),
            e[26] || (e[26] = t("svg", {
              width: "10",
              height: "10",
              viewBox: "0 0 16 16",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "1.5",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            }, [
              t("path", { d: "M4 6 L8 10 L12 6" })
            ], -1))
          ], 8, Ue),
          $.value ? (r(), u("ul", {
            key: 0,
            class: "fsb-menu fsb-root-menu",
            onClick: e[3] || (e[3] = L(() => {
            }, ["stop"]))
          }, [
            (r(!0), u(b, null, R(o(i).roots, (l) => (r(), u("li", {
              key: l,
              class: "fsb-menu-item fsb-mono",
              onClick: (p) => ee(l)
            }, [
              t("span", Ye, a(l === o(i).currentRoot ? "✓" : ""), 1),
              K(" " + a(o(M)(l, o(i).pathStyle)), 1)
            ], 8, Xe))), 128))
          ])) : h("", !0)
        ])) : h("", !0),
        t("input", {
          class: "fsb-path-input fsb-mono",
          type: "text",
          value: g.value,
          placeholder: o(n)("toolbar.pathPlaceholder"),
          onInput: e[4] || (e[4] = (l) => g.value = l.target.value),
          onFocus: G,
          onBlur: J,
          onKeydown: Q
        }, null, 40, qe),
        t("button", {
          type: "button",
          class: "fsb-btn fsb-btn-icon",
          title: o(n)("toolbar.newFolder"),
          onClick: e[5] || (e[5] = (l) => z())
        }, [...e[27] || (e[27] = [
          t("svg", {
            width: "16",
            height: "16",
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "1.5",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }, [
            t("path", { d: "M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z" }),
            t("path", { d: "M8 7.5 v3.5 M6.25 9.25 h3.5" })
          ], -1)
        ])], 8, We),
        t("button", {
          type: "button",
          class: D(["fsb-btn fsb-btn-icon", { "fsb-btn-active": o(i).showHidden }]),
          title: o(i).showHidden ? o(n)("toolbar.hideHidden") : o(n)("toolbar.showHidden"),
          onClick: e[6] || (e[6] = (l) => o(d).toggleHidden())
        }, [
          (r(), u("svg", Ge, [
            e[28] || (e[28] = t("path", { d: "M1.5 8 C3 4.8 5.3 3.2 8 3.2 S13 4.8 14.5 8 C13 11.2 10.7 12.8 8 12.8 S3 11.2 1.5 8 Z" }, null, -1)),
            e[29] || (e[29] = t("circle", {
              cx: "8",
              cy: "8",
              r: "2"
            }, null, -1)),
            o(i).showHidden ? h("", !0) : (r(), u("path", Je))
          ]))
        ], 10, Ze)
      ]),
      t("div", Qe, [
        t("span", _e, a(o(n)("column.name")), 1),
        t("span", et, a(o(n)("column.size")), 1),
        t("span", tt, a(o(n)("column.modified")), 1)
      ]),
      t("div", {
        class: "fsb-list",
        onContextmenu: se
      }, [
        o(i).loading && !o(i).ready ? (r(), u(b, { key: 0 }, R(6, (l) => t("div", {
          key: l,
          class: "fsb-row fsb-skeleton-row"
        }, [...e[30] || (e[30] = [
          t("span", { class: "fsb-skeleton fsb-skeleton-icon" }, null, -1),
          t("span", { class: "fsb-skeleton fsb-skeleton-text" }, null, -1)
        ])])), 64)) : o(i).ready && o(i).entries.length === 0 && o(i).newFolder === null ? (r(), u("div", nt, [
          e[31] || (e[31] = t("svg", {
            width: "48",
            height: "48",
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "var(--fsb-text-muted)",
            "stroke-width": "1",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }, [
            t("path", { d: "M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z" })
          ], -1)),
          t("p", ot, a(o(n)("empty.title")), 1),
          t("p", st, a(o(n)("empty.hint")), 1)
        ])) : (r(), u(b, { key: 2 }, [
          o(i).newFolder !== null ? (r(), u("div", lt, [
            j(A, { kind: "dir" }),
            t("input", {
              ref_key: "newFolderInput",
              ref: I,
              class: "fsb-inline-input",
              type: "text",
              value: o(i).newFolder.draft,
              placeholder: o(n)("newFolder.defaultName"),
              onInput: e[7] || (e[7] = (l) => o(d).setNewFolderDraft(l.target.value)),
              onKeydown: fe,
              onBlur: e[8] || (e[8] = (l) => o(d).commitNewFolder())
            }, null, 40, it),
            t("span", rt, a(o(n)("edit.hint")), 1)
          ])) : h("", !0),
          (r(!0), u(b, null, R(o(i).entries, (l) => (r(), u("div", {
            key: l.Path,
            class: D(["fsb-row", {
              "fsb-row-selected": o(i).selection.includes(l.Path),
              "fsb-row-hidden-item": l.Hidden,
              "fsb-row-disabled": !ve(l) && !o(O)(l)
            }]),
            onClick: (p) => te(p, l),
            onDblclick: (p) => ne(l),
            onContextmenu: (p) => oe(p, l)
          }, [
            j(A, {
              kind: o(U)(l),
              "is-link": l.IsLink,
              broken: o($e)(l)
            }, null, 8, ["kind", "is-link", "broken"]),
            o(i).rename !== null && o(i).rename.path === l.Path ? (r(), u(b, { key: 0 }, [
              t("input", {
                ref_for: !0,
                ref_key: "renameInput",
                ref: H,
                class: "fsb-inline-input",
                type: "text",
                value: o(i).rename.draft,
                onInput: e[9] || (e[9] = (p) => o(d).setRenameDraft(p.target.value)),
                onKeydown: ae,
                onBlur: e[10] || (e[10] = (p) => o(d).commitRename()),
                onClick: e[11] || (e[11] = L(() => {
                }, ["stop"]))
              }, null, 40, dt),
              t("span", at, a(o(n)("edit.hint")), 1)
            ], 64)) : (r(), u(b, { key: 1 }, [
              t("span", ft, a(l.Name), 1),
              t("span", ct, a(ce(l)), 1),
              t("span", bt, a(be(l)), 1)
            ], 64))
          ], 42, ut))), 128))
        ], 64))
      ], 32),
      m.value !== null ? (r(), u("ul", {
        key: 0,
        class: "fsb-menu fsb-context-menu",
        style: P({ left: `${m.value.x}px`, top: `${m.value.y}px` }),
        onClick: e[18] || (e[18] = L(() => {
        }, ["stop"]))
      }, [
        m.value.kind === "row" ? (r(), u(b, { key: 0 }, [
          t("li", {
            class: D(["fsb-menu-item", { "fsb-menu-item-disabled": !N.value }]),
            onClick: e[12] || (e[12] = (l) => le())
          }, a(o(n)("menu.rename")), 3),
          t("li", {
            class: "fsb-menu-item fsb-menu-item-danger",
            onClick: e[13] || (e[13] = (l) => ie())
          }, a(o(i).selection.length > 1 ? o(n)("menu.deleteCount", { count: o(i).selection.length }) : o(n)("menu.delete")), 1),
          t("li", {
            class: "fsb-menu-item",
            onClick: e[14] || (e[14] = (l) => re())
          }, a(o(n)("menu.copyPath")), 1)
        ], 64)) : (r(), u(b, { key: 1 }, [
          t("li", {
            class: "fsb-menu-item",
            onClick: e[15] || (e[15] = (l) => z())
          }, a(o(n)("menu.newFolder")), 1),
          t("li", {
            class: "fsb-menu-item",
            onClick: e[16] || (e[16] = (l) => ue())
          }, a(o(n)("menu.refresh")), 1),
          t("li", {
            class: "fsb-menu-item",
            onClick: e[17] || (e[17] = (l) => de())
          }, [
            t("span", vt, a(o(i).showHidden ? "✓" : ""), 1),
            K(" " + a(o(n)("menu.showHidden")), 1)
          ])
        ], 64))
      ], 4)) : h("", !0),
      t("div", {
        class: D(["fsb-statusbar", `fsb-statusbar-${S.value}`])
      }, [
        t("div", kt, [
          o(i).loading ? (r(), u("svg", mt, [...e[32] || (e[32] = [
            t("path", { d: "M8 1.5 a6.5 6.5 0 1 1 -6.5 6.5" }, null, -1)
          ])])) : S.value === "error" ? (r(), u("svg", pt, [...e[33] || (e[33] = [
            t("circle", {
              cx: "8",
              cy: "8",
              r: "6.5"
            }, null, -1),
            t("path", { d: "M8 5 v4 M8 11 v.1" }, null, -1)
          ])])) : h("", !0),
          t("span", null, a(ke.value), 1),
          S.value === "error" ? (r(), u("button", {
            key: 2,
            type: "button",
            class: "fsb-status-dismiss",
            onClick: e[19] || (e[19] = (l) => o(d).dismissError())
          }, a(o(n)("button.dismissError")), 1)) : h("", !0)
        ]),
        t("div", ht, [
          S.value === "confirm" ? (r(), u(b, { key: 0 }, [
            t("button", {
              type: "button",
              class: "fsb-btn",
              onClick: e[20] || (e[20] = (l) => o(d).cancelDelete())
            }, a(o(n)("button.cancel")), 1),
            t("button", {
              type: "button",
              class: "fsb-btn fsb-btn-danger",
              onClick: e[21] || (e[21] = (l) => o(d).confirmDelete())
            }, a(o(n)("button.delete")), 1)
          ], 64)) : (r(), u(b, { key: 1 }, [
            t("button", {
              type: "button",
              class: "fsb-btn",
              onClick: e[22] || (e[22] = (l) => o(d).cancel())
            }, a(o(n)("button.cancel")), 1),
            t("button", {
              type: "button",
              class: "fsb-btn fsb-btn-primary",
              disabled: !o(i).canConfirmSelection,
              onClick: e[23] || (e[23] = (l) => o(d).confirmSelection())
            }, a(o(n)("button.select")), 9, wt)
          ], 64))
        ])
      ], 2)
    ], 4));
  }
}), xt = /* @__PURE__ */ q(yt, [["__scopeId", "data-v-0af11970"]]);
export {
  xt as FsBrowser,
  Fe as fsbClientKey,
  Ee as useBrowserStore
};
