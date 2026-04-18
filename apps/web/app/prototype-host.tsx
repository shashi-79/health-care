"use client";

import { useEffect, useMemo, useState } from "react";

function extractBody(rawHtml: string): string {
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const html = bodyMatch ? bodyMatch[1] : rawHtml;

  // Remove inline script include; scripts are injected in controlled order.
  return html.replace(/<script[^>]*src=["']app\.js["'][^>]*><\/script>/gi, "");
}

export default function PrototypeHost() {
  const [markup, setMarkup] = useState<string>("");

  useEffect(() => {
    let active = true;

    async function loadTemplate() {
      const res = await fetch("/demo-ui/index.html", { cache: "no-store" });
      const html = await res.text();
      if (!active) return;
      setMarkup(extractBody(html));
    }

    loadTemplate().catch(() => {
      if (!active) return;
      setMarkup("<div style='padding:20px'>Failed to load prototype template.</div>");
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!markup) return;

    const priorScripts = document.querySelectorAll("script[data-prototype-script='1']");
    priorScripts.forEach((s) => s.remove());

    const lucideScript = document.createElement("script");
    lucideScript.src = "https://unpkg.com/lucide@latest";
    lucideScript.async = true;
    lucideScript.dataset.prototypeScript = "1";

    lucideScript.onload = () => {
      const appScript = document.createElement("script");
      appScript.src = "/demo-ui/app.js";
      appScript.async = true;
      appScript.dataset.prototypeScript = "1";
      document.body.appendChild(appScript);
    };

    document.body.appendChild(lucideScript);

    return () => {
      const scripts = document.querySelectorAll("script[data-prototype-script='1']");
      scripts.forEach((s) => s.remove());
    };
  }, [markup]);

  const renderedMarkup = useMemo(() => ({ __html: markup }), [markup]);

  return <div className="prototype-host" dangerouslySetInnerHTML={renderedMarkup} />;
}
