import {
    ExportVariableType,
    FrontendVariableExport,
    VariableCollectionSnapshot,
    VariableExportIssue,
    VariableExportSnapshot,
    VariableTokenSnapshot,
} from "../typings/variableTokens";

type DtcgTokenValue = {
    pathSuffix: string[];
    type: string;
    value: unknown;
};

type ConvertedValue = {
    dtcgTokens: DtcgTokenValue[];
    cssDeclarations: Record<string, string>;
};

type NormalizedColor = {
    red: number;
    green: number;
    blue: number;
    alpha: number;
};

const DIMENSION_TYPES = new Set<ExportVariableType>([
    "STROKE_WIDTH",
    "RADIUS",
    "CORNER_RADIUS",
    "PADDING",
    "SPACING",
]);

function toKebabCase(value: string, fallback: string): string {
    const normalized = value
        .normalize("NFKC")
        .trim()
        .replace(/^--/, "")
        .replace(/[\\/\s_]+/g, "-")
        .replace(/[^\p{L}\p{N}-]+/gu, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
    return normalized || fallback;
}

function getCssVariableName(
    collection: VariableCollectionSnapshot,
    variable: VariableTokenSnapshot,
): string {
    const configuredName = variable.codeSyntax?.web || variable.alias;
    const sourceName = configuredName || `${collection.name}-${variable.name}`;
    return `--${toKebabCase(sourceName, `variable-${variable.id}`)}`;
}

function unwrapModeValue(values: ReadonlyArray<unknown> | undefined): unknown {
    if (!values || values.length === 0) return undefined;
    return values.length === 1 ? values[0] : values;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function getReferenceId(value: unknown): string | null {
    if (Array.isArray(value)) {
        return value.length === 1 ? getReferenceId(value[0]) : null;
    }

    const record = asRecord(value);
    if (!record) return null;

    const candidate =
        record.variableId ??
        record.referenceId ??
        record.reference ??
        (record.type === "VARIABLE_ALIAS" ? record.id : undefined);
    if (typeof candidate === "string" && candidate) return candidate;

    for (const key of [
        "value",
        "floatData",
        "colorData",
        "paintData",
        "textData",
        "effectData",
    ]) {
        if (record[key] === undefined) continue;
        const referenceId = getReferenceId(record[key]);
        if (referenceId) return referenceId;
    }
    return null;
}

function getDtcgType(type: ExportVariableType): string | null {
    if (type === "COLOR" || type === "PAINT") return "color";
    if (type === "NUMBER") return "number";
    if (DIMENSION_TYPES.has(type)) return "dimension";
    if (type === "STRING") return "string";
    if (type === "BOOLEAN") return "boolean";
    if (type === "TEXT") return "typography";
    if (type === "EFFECT") return "shadow";
    return null;
}

function clamp(value: number, min = 0, max = 1): number {
    return Math.max(min, Math.min(max, value));
}

function toNormalizedChannel(value: number): number {
    return clamp(value <= 1 ? value : value / 255);
}

function round(value: number, precision = 6): number {
    return Number(value.toFixed(precision));
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string" || value.trim() === "") return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function parseColorString(value: string): NormalizedColor | null {
    let normalized = value.trim().toLowerCase();
    if (normalized === "transparent") {
        return { red: 0, green: 0, blue: 0, alpha: 0 };
    }

    if (!normalized.startsWith("#") && /^[\da-f]{3,8}$/.test(normalized)) {
        normalized = `#${normalized}`;
    }
    const hex = normalized.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/);
    if (hex) {
        const source = hex[1];
        const expanded =
            source.length <= 4
                ? [...source].map((character) => character.repeat(2)).join("")
                : source;
        return {
            red: parseInt(expanded.slice(0, 2), 16) / 255,
            green: parseInt(expanded.slice(2, 4), 16) / 255,
            blue: parseInt(expanded.slice(4, 6), 16) / 255,
            alpha:
                expanded.length === 8
                    ? parseInt(expanded.slice(6, 8), 16) / 255
                    : 1,
        };
    }

    const rgb = normalized.match(
        /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/,
    );
    if (!rgb) return null;
    return {
        red: clamp(Number(rgb[1]) / 255),
        green: clamp(Number(rgb[2]) / 255),
        blue: clamp(Number(rgb[3]) / 255),
        alpha: clamp(rgb[4] === undefined ? 1 : Number(rgb[4])),
    };
}

function normalizeColor(
    value: unknown,
    alphaMultiplier = 1,
): NormalizedColor | null {
    if (typeof value === "string") {
        const color = parseColorString(value);
        return color
            ? { ...color, alpha: clamp(color.alpha * alphaMultiplier) }
            : null;
    }

    if (Array.isArray(value)) {
        const channels = value.map(toFiniteNumber);
        if (
            (channels.length === 3 || channels.length === 4) &&
            channels.every((channel): channel is number => channel !== null)
        ) {
            return {
                red: toNormalizedChannel(channels[0]),
                green: toNormalizedChannel(channels[1]),
                blue: toNormalizedChannel(channels[2]),
                alpha: clamp((channels[3] ?? 1) * alphaMultiplier),
            };
        }

        for (const item of value) {
            const color = normalizeColor(item, alphaMultiplier);
            if (color) return color;
        }
        return null;
    }

    const record = asRecord(value);
    if (!record) return null;

    if (record.isVisible === false) return null;

    const r = toFiniteNumber(record.r ?? record.red);
    const g = toFiniteNumber(record.g ?? record.green);
    const b = toFiniteNumber(record.b ?? record.blue);
    const alpha = toFiniteNumber(
        record.a ?? record.alpha ?? record.opacity ?? 1,
    );
    if (r !== null && g !== null && b !== null && alpha !== null) {
        return {
            red: toNormalizedChannel(r),
            green: toNormalizedChannel(g),
            blue: toNormalizedChannel(b),
            alpha: clamp(alpha * alphaMultiplier),
        };
    }

    if (record.color !== undefined) {
        const paintAlpha = toFiniteNumber(record.alpha ?? record.opacity) ?? 1;
        const color = normalizeColor(
            record.color,
            alphaMultiplier * paintAlpha,
        );
        if (color) return color;
    }

    const stringCandidates = [record.hex, record.hexValue];
    for (const candidate of stringCandidates) {
        if (typeof candidate !== "string") continue;
        const color = normalizeColor(candidate, alphaMultiplier);
        if (color) return color;
    }

    // 兼容 MasterGo 不同运行时对复合填充增加的包装字段。
    for (const key of [
        "value",
        "rgba",
        "rgb",
        "colorData",
        "paint",
        "paints",
        "paintData",
        "fill",
        "fills",
        "colors",
    ]) {
        if (record[key] === undefined) continue;
        const color = normalizeColor(record[key], alphaMultiplier);
        if (color) return color;
    }

    return null;
}

function colorHex(color: NormalizedColor): string {
    return `#${[color.red, color.green, color.blue]
        .map((channel) =>
            Math.round(clamp(channel) * 255)
                .toString(16)
                .padStart(2, "0"),
        )
        .join("")}`;
}

function formatColor(color: NormalizedColor): string {
    const red = Math.round(color.red * 255);
    const green = Math.round(color.green * 255);
    const blue = Math.round(color.blue * 255);
    return color.alpha < 1
        ? `rgba(${red}, ${green}, ${blue}, ${round(color.alpha, 4)})`
        : colorHex(color);
}

function toDtcgColor(color: NormalizedColor): Record<string, unknown> {
    return {
        colorSpace: "srgb",
        components: [round(color.red), round(color.green), round(color.blue)],
        alpha: round(color.alpha),
        hex: colorHex(color),
    };
}

function describeValueStructure(value: unknown, depth = 0): string {
    if (depth >= 2) return typeof value;
    if (Array.isArray(value)) {
        const first = value[0];
        return `数组(${value.length})${
            first === undefined
                ? ""
                : `，首项=${describeValueStructure(first, depth + 1)}`
        }`;
    }
    const record = asRecord(value);
    if (record) {
        const fields = Object.entries(record)
            .slice(0, 12)
            .map(
                ([key, item]) =>
                    `${key}:${describeValueStructure(item, depth + 1)}`,
            )
            .join(", ");
        return `对象{${fields}}`;
    }
    return value === null ? "null" : typeof value;
}

type NormalizedShadow = {
    css: string;
    dtcg: Record<string, unknown>;
};

function normalizeShadows(value: unknown): NormalizedShadow[] {
    const wrapper = asRecord(value);
    if (wrapper?.effectData !== undefined) {
        return normalizeShadows(wrapper.effectData);
    }

    const shadows = Array.isArray(value) ? value : [value];
    return shadows.flatMap((shadow): NormalizedShadow[] => {
        const record = asRecord(shadow);
        if (!record || record.isVisible === false) return [];

        const isShadow =
            record.type === 0 ||
            record.type === 1 ||
            record.type === "INNER_SHADOW" ||
            record.type === "DROP_SHADOW";
        if (!isShadow) return [];

        const offset = asRecord(record?.offset);
        const color = normalizeColor(record?.color);
        if (!color) return [];

        const x = toFiniteNumber(record.x ?? offset?.x) ?? 0;
        const y = toFiniteNumber(record.y ?? offset?.y) ?? 0;
        const blur = toFiniteNumber(record.radius) ?? 0;
        const spread = toFiniteNumber(record.spread) ?? 0;
        const inset = record.type === 0 || record.type === "INNER_SHADOW";
        return [
            {
                css: `${x}px ${y}px ${blur}px ${spread}px ${formatColor(
                    color,
                )}${inset ? " inset" : ""}`,
                dtcg: {
                    color: toDtcgColor(color),
                    offsetX: { value: x, unit: "px" },
                    offsetY: { value: y, unit: "px" },
                    blur: { value: blur, unit: "px" },
                    spread: { value: spread, unit: "px" },
                    ...(inset ? { inset: true } : {}),
                },
            },
        ];
    });
}

function formatCssLength(
    value: unknown,
    options: { allowPercent?: boolean } = {},
): string | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return `${value}px`;
    }
    if (typeof value !== "string") return null;

    const normalized = value.trim();
    if (options.allowPercent && /^-?\d+(?:\.\d+)?%$/.test(normalized)) {
        return normalized;
    }
    const numericValue = Number(normalized);
    return Number.isFinite(numericValue) ? `${numericValue}px` : null;
}

function formatFontFamily(value: string): string {
    const genericFamilies = new Set([
        "serif",
        "sans-serif",
        "monospace",
        "cursive",
        "fantasy",
        "system-ui",
    ]);
    return genericFamilies.has(value.toLowerCase())
        ? value
        : `"${value.replaceAll('"', '\\"')}"`;
}

function getFontStyle(record: Record<string, unknown>): string | null {
    const fontName = asRecord(record.fontName);
    let style = typeof fontName?.style === "string" ? fontName.style : null;

    if (typeof record.fontStyle === "string") {
        try {
            const parsed = JSON.parse(record.fontStyle) as unknown;
            const parsedRecord = asRecord(parsed);
            style =
                typeof parsedRecord?.fontStyle === "string"
                    ? parsedRecord.fontStyle
                    : record.fontStyle;
        } catch {
            style = record.fontStyle;
        }
    }
    if (!style) return null;

    const normalized = style.toLowerCase();
    if (normalized.includes("italic")) return "italic";
    if (normalized.includes("oblique")) return "oblique";
    return "normal";
}

function getFontWeight(record: Record<string, unknown>): string | null {
    if (
        (typeof record.fontWeight === "number" ||
            typeof record.fontWeight === "string") &&
        String(record.fontWeight).trim()
    ) {
        return String(record.fontWeight).trim();
    }

    const fontName = asRecord(record.fontName);
    const source =
        typeof fontName?.style === "string"
            ? fontName.style
            : typeof record.fontStyle === "string"
              ? record.fontStyle
              : "";
    const normalized = source.toLowerCase();
    const weights: Array<[RegExp, string]> = [
        [/thin|hairline/, "100"],
        [/extra[ -]?light|ultra[ -]?light/, "200"],
        [/light/, "300"],
        [/medium/, "500"],
        [/semi[ -]?bold|demi[ -]?bold/, "600"],
        [/extra[ -]?bold|ultra[ -]?bold/, "800"],
        [/black|heavy/, "900"],
        [/bold/, "700"],
        [/regular|normal|book/, "400"],
    ];
    return weights.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function getDimensionValues(value: unknown): number[] | null {
    const numericValue = toFiniteNumber(value);
    if (numericValue !== null) return [numericValue];

    if (Array.isArray(value)) {
        const values = value.map(toFiniteNumber);
        if (
            values.length > 0 &&
            values.every((item): item is number => item !== null)
        ) {
            return values;
        }
        return value.length === 1 ? getDimensionValues(value[0]) : null;
    }

    const record = asRecord(value);
    if (!record) return null;
    for (const key of [
        "width",
        "radius",
        "padding",
        "spacing",
        "value",
        "floatData",
        "numberData",
        "widthData",
        "radiusData",
        "paddingData",
        "spacingData",
    ]) {
        const result = getDimensionValues(record[key]);
        if (result) return result;
    }
    return null;
}

function getNumberValue(value: unknown): number | null {
    const numericValue = toFiniteNumber(value);
    if (numericValue !== null) return numericValue;

    if (Array.isArray(value)) {
        return value.length === 1 ? getNumberValue(value[0]) : null;
    }

    const record = asRecord(value);
    if (!record) return null;
    for (const key of ["floatData", "numberData", "value"]) {
        const result = getNumberValue(record[key]);
        if (result !== null) return result;
    }
    return null;
}

function getBooleanValue(value: unknown): boolean | null {
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) {
        return value.length === 1 ? getBooleanValue(value[0]) : null;
    }

    const record = asRecord(value);
    if (!record) return null;
    for (const key of ["booleanData", "boolData", "value"]) {
        const result = getBooleanValue(record[key]);
        if (result !== null) return result;
    }
    return null;
}

function getStringValue(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        return value.length === 1 ? getStringValue(value[0]) : null;
    }

    const record = asRecord(value);
    if (!record) return null;
    for (const key of ["stringData", "value"]) {
        const result = getStringValue(record[key]);
        if (result !== null) return result;
    }
    return null;
}

function getLetterSpacingValue(
    value: unknown,
    fontSize: number,
): number | null {
    const numericValue = toFiniteNumber(value);
    if (numericValue !== null) return numericValue;
    if (typeof value !== "string") return value === undefined ? 0 : null;

    const percent = value.trim().match(/^(-?\d+(?:\.\d+)?)%$/);
    return percent ? (fontSize * Number(percent[1])) / 100 : null;
}

function getLineHeightMultiplier(
    value: unknown,
    unit: unknown,
    fontSize: number,
): number | null {
    if (typeof value === "string") {
        const percent = value.trim().match(/^(-?\d+(?:\.\d+)?)%$/);
        if (percent) return Number(percent[1]) / 100;
    }

    const numericValue = toFiniteNumber(value);
    if (numericValue === null || fontSize === 0) return null;
    return unit === "PERCENT" ? numericValue / 100 : numericValue / fontSize;
}

function getDimensionComponentNames(type: ExportVariableType): string[] | null {
    if (type === "RADIUS" || type === "CORNER_RADIUS") {
        return ["top-left", "top-right", "bottom-right", "bottom-left"];
    }
    if (type === "PADDING" || type === "STROKE_WIDTH") {
        return ["top", "right", "bottom", "left"];
    }
    return null;
}

function expandFourValues(values: number[]): number[] | null {
    if (values.length === 1) return Array(4).fill(values[0]) as number[];
    if (values.length === 2) {
        return [values[0], values[1], values[0], values[1]];
    }
    if (values.length === 3) {
        return [values[0], values[1], values[2], values[1]];
    }
    return values.length === 4 ? values : null;
}

function convertDimensionValue(
    type: ExportVariableType,
    values: number[],
): DtcgTokenValue[] | null {
    const componentNames = getDimensionComponentNames(type);
    if (!componentNames) {
        return values.length === 1
            ? [
                  {
                      pathSuffix: [],
                      type: "dimension",
                      value: { value: values[0], unit: "px" },
                  },
              ]
            : null;
    }

    // DTCG dimension 只能表示单值，四边和四角必须拆成稳定的子 Token。
    const expandedValues = expandFourValues(values);
    if (!expandedValues) return null;
    return componentNames.map((component, index) => ({
        pathSuffix: [component],
        type: "dimension",
        value: { value: expandedValues[index], unit: "px" },
    }));
}

function convertTextValue(
    value: unknown,
    cssName: string,
): ConvertedValue | null {
    const wrapper = asRecord(value);
    const textValue = wrapper?.textData ?? value;
    const normalizedValue =
        Array.isArray(textValue) && textValue.length === 1
            ? textValue[0]
            : textValue;
    const record = asRecord(normalizedValue);
    if (!record) return null;

    const fontName = asRecord(record.fontName);
    const lineHeight = asRecord(record.lineHeight);
    const declarations: Record<string, string> = {};
    const fontFamily =
        typeof record.fontFamily === "string"
            ? record.fontFamily
            : typeof fontName?.family === "string"
              ? fontName.family
              : null;
    if (fontFamily) {
        declarations[`${cssName}-font-family`] = formatFontFamily(fontFamily);
    }
    const fontSize = toFiniteNumber(record.fontSize);
    if (fontSize !== null) {
        declarations[`${cssName}-font-size`] = `${fontSize}px`;
    }
    const lineHeightValue = lineHeight?.value ?? record.height;
    const formattedLineHeight =
        lineHeight?.unit === "PERCENT" && typeof lineHeightValue === "number"
            ? `${lineHeightValue}%`
            : formatCssLength(lineHeightValue, { allowPercent: true });
    if (formattedLineHeight) {
        declarations[`${cssName}-line-height`] = formattedLineHeight;
    }

    const letterSpacing = formatCssLength(record.letterSpacing ?? 0, {
        allowPercent: true,
    });
    if (letterSpacing) {
        declarations[`${cssName}-letter-spacing`] = letterSpacing;
    }

    const fontStyle = getFontStyle(record);
    if (fontStyle) {
        declarations[`${cssName}-font-style`] = fontStyle;
    }
    const fontWeight = getFontWeight(record);
    if (fontWeight) {
        declarations[`${cssName}-font-weight`] = fontWeight;
    }

    if (!fontFamily || fontSize === null || !fontWeight) return null;
    const dtcgLetterSpacing = getLetterSpacingValue(
        record.letterSpacing,
        fontSize,
    );
    const dtcgLineHeight = getLineHeightMultiplier(
        lineHeightValue,
        lineHeight?.unit,
        fontSize,
    );
    if (dtcgLetterSpacing === null || dtcgLineHeight === null) return null;

    const numericFontWeight = toFiniteNumber(fontWeight);

    return Object.keys(declarations).length > 0
        ? {
              dtcgTokens: [
                  {
                      pathSuffix: [],
                      type: "typography",
                      value: {
                          fontFamily,
                          fontSize: { value: fontSize, unit: "px" },
                          fontWeight: numericFontWeight ?? fontWeight,
                          letterSpacing: {
                              value: dtcgLetterSpacing,
                              unit: "px",
                          },
                          lineHeight: round(dtcgLineHeight),
                      },
                  },
              ],
              cssDeclarations: declarations,
          }
        : null;
}

function convertValue(
    variable: VariableTokenSnapshot,
    value: unknown,
    cssName: string,
    modeKey: string,
    cssNameByVariableId: Map<string, string>,
    dtcgReferenceByVariableId: Map<string, string>,
): ConvertedValue | null {
    const referenceId = getReferenceId(value);
    if (referenceId) {
        const targetCssName = cssNameByVariableId.get(referenceId);
        const targetDtcgBase = dtcgReferenceByVariableId.get(referenceId);
        if (!targetCssName || !targetDtcgBase) return null;
        const [targetCollection, ...targetPath] = targetDtcgBase.split(".");
        const componentNames = getDimensionComponentNames(variable.type);
        const pathSuffixes = componentNames?.map((component) => [
            component,
        ]) ?? [[]];
        return {
            dtcgTokens: pathSuffixes.map((pathSuffix) => ({
                pathSuffix,
                type: getDtcgType(variable.type) ?? "string",
                value: `{${[
                    targetCollection,
                    modeKey,
                    ...targetPath,
                    ...pathSuffix,
                ].join(".")}}`,
            })),
            cssDeclarations: { [cssName]: `var(${targetCssName})` },
        };
    }

    if (variable.type === "COLOR" || variable.type === "PAINT") {
        // PAINT 的模式值是填充数组，取第一个可见且可转换的纯色填充。
        const color = normalizeColor(value);
        return color
            ? {
                  dtcgTokens: [
                      {
                          pathSuffix: [],
                          type: "color",
                          value: toDtcgColor(color),
                      },
                  ],
                  cssDeclarations: { [cssName]: formatColor(color) },
              }
            : null;
    }

    if (variable.type === "NUMBER") {
        const numberValue = getNumberValue(value);
        if (numberValue === null) return null;
        return {
            dtcgTokens: [
                { pathSuffix: [], type: "number", value: numberValue },
            ],
            cssDeclarations: { [cssName]: String(numberValue) },
        };
    }

    if (DIMENSION_TYPES.has(variable.type)) {
        const dimensions = getDimensionValues(value);
        if (!dimensions) return null;
        const cssValue = dimensions.map((item) => `${item}px`).join(" ");
        const dtcgTokens = convertDimensionValue(variable.type, dimensions);
        if (!dtcgTokens) return null;
        return {
            dtcgTokens,
            cssDeclarations: { [cssName]: cssValue },
        };
    }

    if (variable.type === "STRING") {
        const stringValue = getStringValue(value);
        if (stringValue === null) return null;
        return {
            dtcgTokens: [
                { pathSuffix: [], type: "string", value: stringValue },
            ],
            cssDeclarations: { [cssName]: stringValue },
        };
    }

    if (variable.type === "BOOLEAN") {
        const booleanValue = getBooleanValue(value);
        if (booleanValue === null) return null;
        return {
            dtcgTokens: [
                { pathSuffix: [], type: "boolean", value: booleanValue },
            ],
            cssDeclarations: { [cssName]: booleanValue ? "1" : "0" },
        };
    }

    if (variable.type === "TEXT") {
        return convertTextValue(value, cssName);
    }

    if (variable.type === "EFFECT") {
        const shadows = normalizeShadows(value);
        return shadows.length > 0
            ? {
                  dtcgTokens: [
                      {
                          pathSuffix: [],
                          type: "shadow",
                          value:
                              shadows.length === 1
                                  ? shadows[0].dtcg
                                  : shadows.map((shadow) => shadow.dtcg),
                      },
                  ],
                  cssDeclarations: {
                      [cssName]: shadows.map((shadow) => shadow.css).join(", "),
                  },
              }
            : null;
    }

    return null;
}

function setDtcgToken(
    root: Record<string, unknown>,
    path: string[],
    token: Record<string, unknown>,
): void {
    let current = root;
    for (let index = 0; index < path.length; index++) {
        const segment = path[index];
        const last = index === path.length - 1;
        const existing = current[segment];

        if (last) {
            if (
                existing &&
                typeof existing === "object" &&
                !("$value" in existing)
            ) {
                (existing as Record<string, unknown>).$root = token;
            } else {
                current[segment] = token;
            }
            continue;
        }

        if (!existing) {
            current[segment] = {};
        } else if (
            typeof existing === "object" &&
            existing !== null &&
            "$value" in existing
        ) {
            current[segment] = { $root: existing };
        }
        current = current[segment] as Record<string, unknown>;
    }
}

function formatCssBlock(
    selector: string,
    declarations: Map<string, string>,
): string {
    const lines = [...declarations.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => `    ${name}: ${value};`);
    return `${selector} {\n${lines.join("\n")}\n}`;
}

export function buildFrontendVariableExport(
    snapshot: VariableExportSnapshot,
): FrontendVariableExport {
    const issues: VariableExportIssue[] = [];
    const rootDeclarations = new Map<string, string>();
    const declarationsByTheme = new Map<string, Map<string, string>>();
    const cssNameByVariableId = new Map<string, string>();
    const dtcgReferenceByVariableId = new Map<string, string>();
    const collectionsNode: Record<string, unknown> = {};

    for (const collection of snapshot.collections) {
        const collectionKey = toKebabCase(
            collection.name,
            `collection-${collection.id}`,
        );
        for (const variable of collection.variables) {
            cssNameByVariableId.set(
                variable.id,
                getCssVariableName(collection, variable),
            );
            const variablePath = variable.name
                .split("/")
                .map((segment, index) =>
                    toKebabCase(segment, `token-${index + 1}`),
                );
            dtcgReferenceByVariableId.set(
                variable.id,
                [collectionKey, ...variablePath].join("."),
            );
        }
    }

    let declarationCount = 0;
    for (const collection of snapshot.collections) {
        const collectionKey = toKebabCase(
            collection.name,
            `collection-${collection.id}`,
        );
        const collectionNode: Record<string, unknown> = {
            $extensions: {
                "com.mastergo": {
                    id: collection.id,
                    name: collection.name,
                    external: collection.isExternal,
                },
            },
        };
        collectionsNode[collectionKey] = collectionNode;

        for (const [modeIndex, mode] of collection.modes.entries()) {
            const modeKey = toKebabCase(mode.name, `mode-${mode.id}`);
            const modeNode: Record<string, unknown> = {};
            collectionNode[modeKey] = modeNode;
            const themeDeclarations =
                declarationsByTheme.get(modeKey) ?? new Map<string, string>();
            declarationsByTheme.set(modeKey, themeDeclarations);

            for (const variable of collection.variables) {
                const value = unwrapModeValue(variable.modes[mode.id]);
                const cssName = cssNameByVariableId.get(variable.id)!;
                const converted = convertValue(
                    variable,
                    value,
                    cssName,
                    modeKey,
                    cssNameByVariableId,
                    dtcgReferenceByVariableId,
                );
                if (!converted) {
                    issues.push({
                        collectionName: collection.name,
                        modeName: mode.name,
                        variableName: variable.name,
                        reason:
                            value === undefined
                                ? "当前模式没有变量值"
                                : `暂不支持 ${variable.type} 类型的当前值结构：${describeValueStructure(
                                      value,
                                  )}`,
                    });
                    continue;
                }

                const variablePath = variable.name
                    .split("/")
                    .map((segment, index) =>
                        toKebabCase(segment, `token-${index + 1}`),
                    );
                for (const dtcgToken of converted.dtcgTokens) {
                    setDtcgToken(
                        modeNode,
                        [...variablePath, ...dtcgToken.pathSuffix],
                        {
                            $type: dtcgToken.type,
                            $value: dtcgToken.value,
                            $description: variable.description || undefined,
                            $extensions: {
                                "com.mastergo": {
                                    id: variable.id,
                                    name: variable.name,
                                    alias: variable.alias || undefined,
                                    component:
                                        dtcgToken.pathSuffix.join("/") ||
                                        undefined,
                                    rawValue: value,
                                },
                            },
                        },
                    );
                }

                for (const [name, cssValue] of Object.entries(
                    converted.cssDeclarations,
                )) {
                    if (themeDeclarations.has(name)) {
                        issues.push({
                            collectionName: collection.name,
                            modeName: mode.name,
                            variableName: variable.name,
                            reason: `CSS 变量名冲突：${name}`,
                        });
                        continue;
                    }
                    themeDeclarations.set(name, cssValue);
                    declarationCount++;
                    if (modeIndex === 0) {
                        if (
                            rootDeclarations.has(name) &&
                            rootDeclarations.get(name) !== cssValue
                        ) {
                            issues.push({
                                collectionName: collection.name,
                                modeName: mode.name,
                                variableName: variable.name,
                                reason: `默认主题 CSS 变量名冲突：${name}`,
                            });
                        } else {
                            rootDeclarations.set(name, cssValue);
                        }
                    }
                }
            }
        }
    }

    const cssBlocks = [
        "/* 由 MasterGo Variables 生成，请勿直接修改。 */",
        formatCssBlock(":root", rootDeclarations),
        ...[...declarationsByTheme.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([theme, declarations]) =>
                formatCssBlock(`[data-theme="${theme}"]`, declarations),
            ),
    ];

    return {
        css: `${cssBlocks.join("\n\n")}\n`,
        dtcg: {
            $extensions: {
                "com.mastergo": {
                    schemaVersion: snapshot.schemaVersion,
                    dtcgSpecVersion: "2025.10",
                    generatedFor: "frontend-theme-variables",
                },
            },
            ...collectionsNode,
        },
        stats: {
            collections: snapshot.collections.length,
            modes: snapshot.collections.reduce(
                (total, collection) => total + collection.modes.length,
                0,
            ),
            variables: snapshot.collections.reduce(
                (total, collection) => total + collection.variables.length,
                0,
            ),
            declarations: declarationCount,
            skipped: issues.length,
        },
        issues,
    };
}
