import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize, { type Options } from "rehype-sanitize";
import { projectImageName } from "@/lib/blog/cover";
import { httpsOrigin } from "@/lib/blog/image-config";
import { sanitizeSchema } from "@/lib/markdown/sanitize-schema";

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function parseAbsolute(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null; // relativa, sin protocolo o inválida
  }
}

/** Solo enlaces absolutos http, https y mailto; todo lo demás se pinta como texto. */
function safeLink(href: string | undefined): URL | null {
  const url = parseAbsolute(href);
  return url && SAFE_LINK_PROTOCOLS.has(url.protocol) ? url : null;
}

function Anchor({ href, children }: { href?: string; children?: ReactNode }) {
  const url = safeLink(href);
  if (!url) return <>{children}</>;
  const external = url.protocol !== "mailto:";
  return (
    <a href={href} rel="noopener noreferrer" target={external ? "_blank" : undefined}>
      {children}
    </a>
  );
}

// Los títulos del contenido bajan un nivel: el único h1 de la página es el título de la entrada.
const heading = (Tag: "h2" | "h3" | "h4" | "h5" | "h6") =>
  function Heading({ children }: { children?: ReactNode }) {
    return <Tag>{children}</Tag>;
  };

type Props = { source: string; imageOrigin?: string | null };

/**
 * Markdown público. Sin HTML crudo (react-markdown lo descarta), con lista blanca propia sobre el
 * árbol resultante y con enlaces e imágenes restringidos. No usa ninguna inserción de HTML en bruto.
 */
export function Markdown({ source, imageOrigin }: Props) {
  const origin = httpsOrigin(imageOrigin);

  const components: Components = {
    a: Anchor,
    // Un bloque de código que se desplaza en horizontal debe poder enfocarse con el teclado (WCAG 2.1.1).
    // Se añade después del sanitizado: el contenido del autor nunca puede fijar tabindex.
    pre({ children }: ComponentProps<"pre">) {
      return <pre tabIndex={0}>{children}</pre>;
    },
    // Sin clase válida de lenguaje no se escribe ningún atributo (nada de class="").
    code({ className, children }: ComponentProps<"code">) {
      return <code className={className || undefined}>{children}</code>;
    },
    h1: heading("h2"),
    h2: heading("h3"),
    h3: heading("h4"),
    h4: heading("h5"),
    h5: heading("h6"),
    h6: heading("h6"),
    img({ src, alt }: ComponentProps<"img">) {
      const value = typeof src === "string" ? src : undefined;
      if (!value || projectImageName(value, origin) === null) return null; // cualquier otra imagen se descarta
      return (
        <span className="relative my-4 block aspect-video w-full">
          <Image src={value} alt={alt ?? ""} fill sizes="(min-width: 768px) 700px, 100vw" className="object-contain" />
        </span>
      );
    },
  };

  return (
    <ReactMarkdown rehypePlugins={[[rehypeSanitize, sanitizeSchema as Options]]} components={components}>
      {source}
    </ReactMarkdown>
  );
}
