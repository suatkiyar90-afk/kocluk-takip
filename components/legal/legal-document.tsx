import type { LegalDocumentModel } from "@/lib/legal/types";

interface LegalDocumentProps {
  doc: LegalDocumentModel;
}

export function LegalDocument({ doc }: LegalDocumentProps) {
  return (
    <div className="mt-5 space-y-6 text-sm leading-relaxed text-gray-800 print:text-black">
      {doc.sections.map((section, sectionIndex) => {
        const isTitleSection = section.heading === doc.title;
        return (
          <section
            key={`${section.heading}-${sectionIndex}`}
            className="print:break-inside-avoid"
          >
            {isTitleSection ? null : (
              <h2 className="text-base font-bold leading-snug text-gray-900 print:text-black">
                {section.heading}
              </h2>
            )}
            <div className={isTitleSection ? "" : "mt-2 space-y-3"}>
              {section.blocks.map((block, blockIndex) =>
                block.type === "p" ? (
                  <p key={blockIndex}>{block.text}</p>
                ) : (
                  <ul
                    key={blockIndex}
                    className="list-disc space-y-2 pl-5 marker:text-gray-400"
                  >
                    {block.items.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
