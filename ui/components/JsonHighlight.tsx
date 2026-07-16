import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import "highlight.js/styles/arta.css";

hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);

interface HighlightProps {
    children: string;
    language?: "json" | "css";
}

export default function JsonHighlight(props: HighlightProps) {
    const el = useRef<HTMLElement>(null);

    useEffect(() => {
        if (el.current) hljs.highlightElement(el.current);
    }, [props.children]);

    return (
        <pre>
            <code className={`language-${props.language ?? "json"}`} ref={el}>
                {props.children}
            </code>
        </pre>
    );
}
