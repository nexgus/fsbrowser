import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function SaveNameRow({ name, issue, t, onChange, onCommit }) {
    return (_jsxs("div", { className: "fsb-savename", children: [_jsx("input", { className: "fsb-savename-input", value: name, placeholder: t("save.namePlaceholder"), onChange: (event) => onChange(event.target.value), onKeyDown: (event) => {
                    if (event.key === "Enter")
                        onCommit();
                } }), issue === "invalid" ? _jsx("span", { className: "fsb-savename-issue", children: t("save.invalidName") }) : null, issue === "isDirectory" ? (_jsx("span", { className: "fsb-savename-issue", children: t("save.isDirectory", { name }) })) : null] }));
}
//# sourceMappingURL=SaveNameRow.js.map