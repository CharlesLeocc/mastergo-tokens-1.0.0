export function collectSceneNodes(
    roots: ReadonlyArray<SceneNode>,
): SceneNode[] {
    const nodes: SceneNode[] = [];
    const stack = [...roots].reverse();
    const visited = new Set<string>();

    while (stack.length > 0) {
        const node = stack.pop()!;
        if (visited.has(node.id)) continue;

        visited.add(node.id);
        nodes.push(node);

        if ("children" in node) {
            // 逆序压栈以保持画布中的原始遍历顺序。
            for (let index = node.children.length - 1; index >= 0; index--) {
                stack.push(node.children[index]);
            }
        }
    }

    return nodes;
}

export function splitTokenTheme(tokenName: string): {
    themeName: string | null;
    tokenName: string;
} {
    const separatorIndex = tokenName.indexOf("/");
    if (separatorIndex <= 0 || separatorIndex === tokenName.length - 1) {
        return { themeName: null, tokenName };
    }

    return {
        themeName: tokenName.slice(0, separatorIndex),
        tokenName: tokenName.slice(separatorIndex + 1),
    };
}

export function convertTokenNameToTheme(
    tokenName: string,
    themeName: string,
): string | null {
    const tokenPath = splitTokenTheme(tokenName);
    if (!tokenPath.themeName || !themeName.trim()) return null;

    return `${themeName}/${tokenPath.tokenName}`;
}

export async function mapWithConcurrency<T, R>(
    values: T[],
    concurrency: number,
    mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(values.length);
    let nextIndex = 0;

    // 固定数量的 worker 限制团队样式导入并发，避免大页面瞬时请求过多。
    const workers = Array.from(
        { length: Math.min(Math.max(concurrency, 1), values.length) },
        async () => {
            while (nextIndex < values.length) {
                const currentIndex = nextIndex++;
                results[currentIndex] = await mapper(
                    values[currentIndex],
                    currentIndex,
                );
            }
        },
    );

    await Promise.all(workers);
    return results;
}
