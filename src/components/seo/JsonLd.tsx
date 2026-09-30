/**
 * Structured data for search engines, as JSON-LD. "<" is escaped so that no value can
 * ever close the script element early.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
